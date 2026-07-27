const db = require("../config/db");
const { calcularMoraMensual } = require("../services/moraMensual.service");
const {
  registrarAuditoria
} = require("../services/auditoria.service");

// mysql2 en modo promise
const pool = db.promise();

// ✅ Importamos ambas funciones de mora
const { calcularMoraCuota } = require("../utils/mora.utils");
const obtenerCuotasPorPrestamo = async (req, res) => {
  try {
    const { prestamoId } = req.params;
    const hoy = new Date();

// mes actual
const mesActual = hoy.getMonth() + 1;
const anioActual = hoy.getFullYear();

// mes anterior
const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

// este es el ciclo que debes calcular
const cicloAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}`;





    /*
    ==================================================
    1️⃣ PRIMER SELECT
    - TRAER CUOTAS
    - SALDO NUNCA PUEDE SER NULL  ← ESTE ERA EL BUG REAL
    ==================================================
    */
    const [cuotas] = await pool.execute(
      `
      SELECT
        c.id,
        c.numero,
        c.fecha_pago,
        c.monto,
        c.pagado,
        COALESCE(c.saldo, c.monto - c.pagado) AS saldo,
        c.estado
      FROM cuotas c
      WHERE c.prestamo_id = ?
      ORDER BY c.numero
      `,
      [prestamoId]
    );


    

    /*
    ==================================================
    3️⃣ SEGUNDO SELECT
    - LEER CUOTAS YA CON MORA MENSUAL APLICADA
    ==================================================
    */
    const [cuotasActualizadas] = await pool.execute(
      `
      SELECT
        c.id,
        c.numero,
        c.fecha_pago,
        c.monto,
        c.pagado,
        COALESCE(c.saldo, c.monto - c.pagado) AS saldo,
        c.estado,
        p.total AS total_prestamo,
        IFNULL(SUM(mm.monto_asignado), 0) AS mora
    FROM cuotas c
      JOIN prestamos p
        ON p.id = c.prestamo_id
      LEFT JOIN moras_mensuales_cuotas mm
      ON mm.cuota_id = c.id
      WHERE c.prestamo_id = ?
      GROUP BY c.id
      ORDER BY c.numero
      `,
      [prestamoId]
    );

    /*
    ==================================================
    4️⃣ RESPUESTA FINAL
    - días de atraso: informativo
    - mora: SOLO mensual
    ==================================================
    */
    const resultado = cuotasActualizadas.map(cuota => {
      const info = calcularMoraCuota(cuota);

      return {
        ...cuota,
        dias_mora: info.dias_mora,
        estado_mora: info.estado,
        mora: Number(cuota.mora),
        total_pagar: Number(cuota.saldo) + Number(cuota.mora)
      };
    });

    res.json(resultado);

  } catch (error) {
    console.error("❌ Error al obtener cuotas:", error);
    res.status(500).json({ mensaje: "Error al obtener cuotas" });
  }
};

module.exports = {
  obtenerCuotasPorPrestamo
};


/**
 * ✅ REGISTRAR PAGO PARCIAL
 */
const registrarPagoCuota = async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;

  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ mensaje: "Monto inválido" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Obtener cuota
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        prestamo_id,
        numero,
        monto,
        pagado,
        COALESCE(saldo, monto - pagado) AS saldo,
        estado
      FROM cuotas
      WHERE id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (rows.length === 0) {
      throw new Error("Cuota no encontrada");
    }

    const cuota = rows[0];

    // ✅ Validar saldo pendiente total del préstamo
    const [saldoPrestamoRows] = await conn.execute(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN saldo IS NULL THEN monto - pagado
              ELSE saldo
            END
          ),
          0
        ) AS saldo_pendiente
      FROM cuotas
      WHERE prestamo_id = ?
        AND estado = 'pendiente'
      `,
      [cuota.prestamo_id]
    );

    const saldoPrestamo =
      Number(saldoPrestamoRows[0].saldo_pendiente);

    if (Number(monto) > saldoPrestamo) {
      throw new Error(
        "El monto excede el saldo pendiente del préstamo"
      );
    }

    if (cuota.estado === "pagada") {
      throw new Error("Esta cuota ya está pagada");
    }

    // ✅ Excedente real contra el saldo pendiente
    const excedente =
      Number(monto) - Number(cuota.saldo);

    let pagoRestante = Number(monto);

    // ✅ Si pagó más que el saldo de esta cuota
    if (excedente > 0) {

      await conn.execute(
        `
        UPDATE cuotas
        SET monto = ?
        WHERE id = ?
        `,
        [Number(cuota.monto) + excedente, id]
      );

      cuota.monto =
        Number(cuota.monto) + excedente;
    }

    // ✅ Redistribuir excedente a cuotas futuras
    if (excedente > 0) {

      let restante = excedente;

      const [cuotasFuturas] = await conn.execute(
        `
        SELECT
          id,
          monto,
          numero
        FROM cuotas
        WHERE prestamo_id = ?
          AND numero > ?
          AND estado = 'pendiente'
        ORDER BY numero ASC
        FOR UPDATE
        `,
        [cuota.prestamo_id, cuota.numero]
      );

      for (const futura of cuotasFuturas) {

        if (restante <= 0) break;

        const montoActual = Number(futura.monto);

        const descuento = Math.min(
          restante,
          montoActual
        );

        const nuevoMonto =
          montoActual - descuento;

        if (nuevoMonto <= 0) {

          await conn.execute(
            `
            UPDATE cuotas
            SET
              pagado = monto,
              saldo = 0,
              estado = 'pagada'
            WHERE id = ?
            `,
            [futura.id]
          );

        } else {

          await conn.execute(
            `
            UPDATE cuotas
            SET
              monto = ?,
              saldo = ?,
              estado = 'pendiente'
            WHERE id = ?
            `,
            [
              nuevoMonto,
              nuevoMonto,
              futura.id
            ]
          );

        }

        restante -= descuento;
      }
    }

    // ✅ Registrar pago
    await conn.execute(
      `
      INSERT INTO pagos (cuota_id, usuario_id, monto)
      VALUES (?, ?, ?)
      `,
      [id, req.usuario.id, monto]
    );

    // ✅ Pagar mora
    const [moras] = await conn.execute(
      `
      SELECT id, monto_asignado
      FROM moras_mensuales_cuotas
      WHERE cuota_id = ?
        AND monto_asignado > 0
      ORDER BY id ASC
      `,
      [id]
    );

    for (const mora of moras) {

      if (pagoRestante <= 0) break;

      const aplicar = Math.min(
        pagoRestante,
        mora.monto_asignado
      );

      await conn.execute(
        `
        UPDATE moras_mensuales_cuotas
        SET monto_asignado = monto_asignado - ?
        WHERE id = ?
        `,
        [aplicar, mora.id]
      );

      pagoRestante -= aplicar;
    }

    // ✅ Resumen
    const [resumen] = await conn.execute(
      `
      SELECT
        COALESCE(SUM(p.monto), 0) AS total_pagado,
        (
          SELECT COALESCE(SUM(monto_asignado), 0)
          FROM moras_mensuales_cuotas
          WHERE cuota_id = ?
        ) AS mora_restante
      FROM pagos p
      WHERE p.cuota_id = ?
      `,
      [id, id]
    );

    const totalPagado =
      Number(resumen[0].total_pagado);

    const moraRestante =
      Number(resumen[0].mora_restante);

    let nuevoSaldo =
      (Number(cuota.monto) + moraRestante) -
      totalPagado;

    if (nuevoSaldo < 0) {
      nuevoSaldo = 0;
    }

    const nuevoEstado =
      nuevoSaldo === 0
        ? "pagada"
        : "pendiente";

    // ✅ Actualizar cuota actual
    await conn.execute(
      `
      UPDATE cuotas
      SET pagado = ?, saldo = ?, estado = ?
      WHERE id = ?
      `,
      [totalPagado, nuevoSaldo, nuevoEstado, id]
    );

    // ✅ Cerrar préstamo
    await conn.execute(
      `
      UPDATE prestamos
      SET estado = 'finalizado'
      WHERE id = (
        SELECT prestamo_id
        FROM cuotas
        WHERE id = ?
      )
      AND NOT EXISTS (
        SELECT 1
        FROM cuotas
        WHERE prestamo_id = prestamos.id
          AND estado = 'pendiente'
      )
      `,
      [id]
    );

    await conn.commit();

    registrarAuditoria(
    req.usuario.id,
    "PAGO",
    "PRESTAMO",
    cuota.prestamo_id,
    `Registró pago de C$ ${monto} en la cuota #${cuota.numero}`
  );

    res.json({
      mensaje: "Pago registrado correctamente ✅",
      saldo_restante: nuevoSaldo
    });

  } catch (error) {

    await conn.rollback();

    console.error(
      "❌ Error registrando pago:",
      error
    );

    res.status(500).json({
      mensaje:
        error.message ||
        "Error registrando el pago"
    });

  } finally {

    conn.release();

  }
};

const obtenerCobrosHoy = (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);

  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;

  // ✅ detectar admin correctamente
  const esAdmin = String(rol).toLowerCase() === "administrador";

  let sql = `
    SELECT DISTINCT 
      cli.nombre AS nombre,
      u.nombre AS usuario
    FROM pagos pag
    JOIN cuotas c ON c.id = pag.cuota_id
    JOIN prestamos p ON p.id = c.prestamo_id
    JOIN clientes cli ON cli.id = p.cliente_id
    JOIN usuarios u ON u.id = pag.usuario_id
    WHERE DATE(pag.fecha) = ?
      AND p.estado = 'activo'
  `;

  let params = [hoy];

  // ✅ SOLO filtrar si NO es admin
  if (!esAdmin) {
    sql += " AND cli.usuario_id = ?";
    params.push(usuarioId);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error cobros hoy:", err);
      return res.status(500).json(err);
    }

    res.json(rows);
  });
};



const obtenerMetaHoy = (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;

  const esAdmin = String(rol).toLowerCase() === "administrador";

  let sql = `
    SELECT 
      IFNULL(SUM(c.monto), 0) AS totalHoy,
      IFNULL(SUM(c.pagado), 0) AS cobradoHoy
    FROM cuotas c
    JOIN prestamos p ON p.id = c.prestamo_id
    JOIN clientes cli ON cli.id = p.cliente_id
    WHERE DATE(c.fecha_pago) = ?
      AND p.estado = 'activo'
  `;

  let params = [hoy];

  if (!esAdmin) {
    sql += " AND cli.usuario_id = ?";
    params.push(usuarioId);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error meta hoy:", err);
      return res.status(500).json(err);
    }

    const resultado = rows && rows[0] ? rows[0] : { totalHoy: 0, cobradoHoy: 0 };
    res.json(resultado);
  });
};

const obtenerPagosHoy = (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;
  const esAdmin = String(rol).toLowerCase() === "administrador";

  let sql = `
    SELECT
      u.nombre AS usuario,
      COUNT(p.id) AS pagosHoy,
      IFNULL(SUM(p.monto), 0) AS totalPagadoHoy
    FROM pagos p
    JOIN usuarios u ON u.id = p.usuario_id
    JOIN cuotas c ON c.id = p.cuota_id
    JOIN prestamos pr ON pr.id = c.prestamo_id
    JOIN clientes cli ON cli.id = pr.cliente_id
    WHERE DATE(p.fecha) = ?
      AND pr.estado = 'activo'
  `;

  const params = [hoy];

  if (!esAdmin) {
    sql += " AND cli.usuario_id = ?";
    params.push(usuarioId);
  }

  sql += `
    GROUP BY u.id, u.nombre
    ORDER BY pagosHoy DESC, totalPagadoHoy DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error pagos hoy:", err);
      return res.status(500).json(err);
    }

    res.json(rows || []);
  });
};

const obtenerMetasAnteriores = (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;
  const esAdmin = String(rol).toLowerCase() === "administrador";

  let sql = `
    SELECT
      DATE(c.fecha_pago) AS fecha,
      IFNULL(SUM(c.monto), 0) AS meta,
      IFNULL(SUM(c.pagado), 0) AS cobrado
    FROM cuotas c
    JOIN prestamos p ON p.id = c.prestamo_id
    JOIN clientes cli ON cli.id = p.cliente_id
    WHERE DATE(c.fecha_pago) < ?
      AND p.estado = 'activo'
  `;

  const params = [hoy];

  if (!esAdmin) {
    sql += " AND cli.usuario_id = ?";
    params.push(usuarioId);
  }

  sql += `
    GROUP BY DATE(c.fecha_pago)
    ORDER BY fecha DESC
    LIMIT 10
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error metas anteriores:", err);
      return res.status(500).json(err);
    }

    res.json(rows || []);
  });
};


// ✅ EXPORT ÚNICO Y CLARO
module.exports = {
  obtenerCuotasPorPrestamo,
  registrarPagoCuota,
  obtenerCobrosHoy,
  obtenerPagosHoy,
  obtenerMetaHoy,
  obtenerMetasAnteriores
};
