const db = require("../config/db");
const {
  registrarAuditoria
} = require("../services/auditoria.service");

/*
====================================================
FERIADOS NACIONALES NICARAGUA (MM-DD)
====================================================
*/
const FERIADOS_FIJOS_NI = [
  "01-01", // Año Nuevo
  "01-18", // Rubén Darío
  "02-02", // Día de la Reconciliación y la Paz
  "02-21", // General Augusto C. Sandino
  "05-01", // Día del Trabajo
  "05-30", // Día de la Madre
  "07-19", // Revolución Sandinista
  "09-14", // Batalla de San Jacinto
  "09-15", // Independencia de Centroamérica
  "11-08", // Carlos Fonseca Amador
  "12-08", // Inmaculada Concepción
  "12-25"  // Navidad
];
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(anio, mes - 1, dia);
}

function esSemanaSanta(fecha) {
  const anio = fecha.getFullYear();
  const pascua = calcularPascua(anio);

  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(pascua.getDate() - 3);

  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(pascua.getDate() - 2);

  const sabadoSanto = new Date(pascua);
  sabadoSanto.setDate(pascua.getDate() - 1);

  return (
    fecha.toDateString() === juevesSanto.toDateString() ||
    fecha.toDateString() === viernesSanto.toDateString() ||
    fecha.toDateString() === sabadoSanto.toDateString()
  );
}

function esFeriadoNicaragua(fecha) {
  const mmdd =
    String(fecha.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(fecha.getDate()).padStart(2, "0");

  return FERIADOS_FIJOS_NI.includes(mmdd) || esSemanaSanta(fecha);
}
function ajustarAFechaHabil(fecha) {
  while (true) {
    const esDomingo = fecha.getDay() === 0;
    const esFeriado = esFeriadoNicaragua(fecha);

    if (!esDomingo && !esFeriado) {
      return fecha;
    }

    // ➕ Avanza al siguiente día
    fecha.setDate(fecha.getDate() + 1);
  }
}
/*
====================================================
CREAR PRÉSTAMO
- Calcula el total
- Guarda el préstamo con usuario_id
- Luego llamará a generarCuotas
====================================================
*/
const sql = `
  SELECT
    p.id,
    p.monto,
    p.interes,
    p.total,
    p.plazo,
    p.tipo_cuota,
    p.fecha_inicio,
    p.estado,
    p.tipo_respaldo,
    p.garantia,
    f.nombre AS fiador_nombre,
    f.telefono AS fiador_telefono,
    f.parentesco
  FROM prestamos p
  LEFT JOIN fiadores f ON f.prestamo_id = p.id
  WHERE p.cliente_id = ?
    AND p.estado = 'activo'
  ORDER BY p.fecha_inicio DESC
`;
const crearPrestamo = (req, res) => {

  const {
    cliente_id,
    monto,
    interes,
    plazo,
    tipo_cuota,
    tipo_respaldo,
    fiador,
    garantia
  } = req.body;

  // 🛑 Validaciones básicas
  if (!cliente_id || !monto || !interes || !plazo || !tipo_cuota) {
    return res.status(400).json({
      mensaje: "Datos incompletos"
    });
  }

  // ✅ Validaciones de respaldo
  if (!tipo_respaldo) {
    return res.status(400).json({
      mensaje: "Tipo de respaldo requerido"
    });
  }

  if (tipo_respaldo === "fiador") {

    if (!fiador || !fiador.nombre || !fiador.cedula) {

      return res.status(400).json({
        mensaje: "Datos del fiador incompletos"
      });

    }

  }

  if (tipo_respaldo === "garantia") {

    if (!garantia) {

      return res.status(400).json({
        mensaje: "Debe especificar la garantía"
      });

    }

  }

  const usuario_id = req.usuario.id;

  db.query(
    "SELECT id FROM prestamos WHERE cliente_id = ? AND estado = 'activo' LIMIT 1",
    [cliente_id],
    (err, rows) => {

      if (err) {

        console.error(
          "Error validando préstamo activo:",
          err
        );

        return res.status(500).json({
          mensaje: "Error validando préstamo activo"
        });

      }

      if (rows.length > 0) {

        return res.status(400).json({
          mensaje: "Este cliente ya tiene un préstamo activo"
        });

      }

      crearPrestamoInterno();

    }
  );

  function crearPrestamoInterno() {

    const montoNum = Number(monto);
    const interesNum = Number(interes);

    const total =
      montoNum +
      (montoNum * (interesNum / 100));

    const sqlPrestamo = `
      INSERT INTO prestamos
      (
        cliente_id,
        usuario_id,
        monto,
        interes,
        total,
        plazo,
        tipo_cuota,
        tipo_respaldo,
        garantia,
        fecha_inicio,
        estado
      )
      VALUES
      (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURDATE(),
        'activo'
      )
    `;

    db.query(
      sqlPrestamo,
      [
        cliente_id,
        usuario_id,
        monto,
        interes,
        total,
        plazo,
        tipo_cuota,
        tipo_respaldo,
        tipo_respaldo === "garantia"
          ? garantia
          : null
      ],
      (err, result) => {

        if (err) {

          console.error(
            "Error al crear préstamo:",
            err
          );

          return res.status(500).json({
            mensaje: "Error al crear préstamo"
          });

        }

        const prestamoId =
          result.insertId;

        registrarAuditoria(
          req.usuario.id,
          "CREAR",
          "PRESTAMO",
          prestamoId,
          `Creó préstamo por C$ ${monto}`
        );

        if (
          tipo_respaldo === "fiador" &&
          fiador
        ) {

          const sqlFiador = `
            INSERT INTO fiadores
            (
              prestamo_id,
              nombre,
              cedula,
              telefono,
              direccion,
              sexo,
              estado_civil,
              parentesco
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            sqlFiador,
            [
              prestamoId,
              fiador.nombre,
              fiador.cedula,
              fiador.telefono,
              fiador.direccion,
              fiador.sexo,
              fiador.estado_civil,
              fiador.parentesco
            ],
            err => {

              if (err) {

                console.error(
                  "Error guardando fiador:",
                  err
                );

                return res.status(500).json({
                  mensaje:
                    "Error guardando fiador"
                });

              }

              generarCuotas(
                prestamoId,
                total,
                plazo,
                tipo_cuota,
                res
              );

            }
          );

        } else {

          generarCuotas(
            prestamoId,
            total,
            plazo,
            tipo_cuota,
            res
          );

        }

      }
    );

  }

};

const crearPrestamoExistente = (req, res) => {
  const {
    cliente_id,
    monto,
    interes,
    plazo,
    tipo_cuota,
    tipo_respaldo,
    fiador,
    garantia,
    fecha_inicio,
    cuotas_pagadas
  } = req.body;

  if (
    !cliente_id ||
    !monto ||
    !interes ||
    !plazo ||
    !tipo_cuota ||
    !fecha_inicio
  ) {
    return res.status(400).json({
      mensaje: "Datos incompletos"
    });
  }

  if (!tipo_respaldo) {
    return res.status(400).json({
      mensaje: "Tipo de respaldo requerido"
    });
  }

  if (tipo_respaldo === "fiador") {
    if (!fiador || !fiador.nombre || !fiador.cedula) {
      return res.status(400).json({
        mensaje: "Datos del fiador incompletos"
      });
    }
  }

  if (tipo_respaldo === "garantia") {
    if (!garantia) {
      return res.status(400).json({
        mensaje: "Debe especificar la garantía"
      });
    }
  }

  const fechaInicio = new Date(fecha_inicio);

  if (isNaN(fechaInicio.getTime())) {
    return res.status(400).json({
      mensaje: "Fecha de inicio inválida"
    });
  }

  const usuario_id = req.usuario.id;

  db.query(
    "SELECT id FROM prestamos WHERE cliente_id = ? AND estado = 'activo' LIMIT 1",
    [cliente_id],
    (err, rows) => {

      if (err) {
        console.error(
          "Error validando préstamo activo:",
          err
        );

        return res.status(500).json({
          mensaje: "Error validando préstamo activo"
        });
      }

      if (rows.length > 0) {
        return res.status(400).json({
          mensaje: "Este cliente ya tiene un préstamo activo"
        });
      }

      crearPrestamoExistenteInterno();
    }
  );

  function crearPrestamoExistenteInterno() {

    const montoNum = Number(monto);
    const interesNum = Number(interes);

    const cuotasPagadasNum = Math.max(
      0,
      Math.floor(Number(cuotas_pagadas) || 0)
    );

    const total =
      montoNum +
      montoNum * (Number(interesNum) / 100);

    const sqlPrestamo = `
      INSERT INTO prestamos
        (
          cliente_id,
          usuario_id,
          monto,
          interes,
          total,
          plazo,
          tipo_cuota,
          tipo_respaldo,
          garantia,
          fecha_inicio,
          estado
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')
    `;

    db.query(
      sqlPrestamo,
      [
        cliente_id,
        usuario_id,
        monto,
        interes,
        total,
        plazo,
        tipo_cuota,
        tipo_respaldo,
        tipo_respaldo === "garantia"
          ? garantia
          : null,
        fechaInicio
      ],
      (err, result) => {

        if (err) {
          console.error(
            "Error al crear préstamo existente:",
            err
          );

          return res.status(500).json({
            mensaje:
              "Error al crear préstamo existente"
          });
        }

        const prestamoId = result.insertId;

        registrarAuditoria(
          req.usuario.id,
          "CREAR",
          "PRESTAMO",
          prestamoId,
          `Creó préstamo existente por C$ ${monto}`
        );

        if (
          tipo_respaldo === "fiador" &&
          fiador
        ) {

          const sqlFiador = `
            INSERT INTO fiadores
              (
                prestamo_id,
                nombre,
                cedula,
                telefono,
                direccion,
                sexo,
                estado_civil,
                parentesco
              )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            sqlFiador,
            [
              prestamoId,
              fiador.nombre,
              fiador.cedula,
              fiador.telefono,
              fiador.direccion,
              fiador.sexo,
              fiador.estado_civil,
              fiador.parentesco
            ],
            (err) => {

              if (err) {
                console.error(
                  "Error guardando fiador:",
                  err
                );

                return res.status(500).json({
                  mensaje:
                    "Error guardando fiador"
                });
              }

              generarCuotasExistente(
                prestamoId,
                total,
                plazo,
                tipo_cuota,
                fechaInicio,
                cuotasPagadasNum,
                res
              );

            }
          );

        } else {

          generarCuotasExistente(
            prestamoId,
            total,
            plazo,
            tipo_cuota,
            fechaInicio,
            cuotasPagadasNum,
            res
          );

        }

      }
    );
  }
};

function generarCuotasExistente(prestamoId, total, plazo, tipoCuota, fechaInicio, cuotasPagadas, res) {
  let numeroCuotas = plazo;

  if (tipoCuota === "diaria") numeroCuotas = plazo * 30;
  if (tipoCuota === "semanal") numeroCuotas = plazo * 4;
  if (tipoCuota === "quincenal") numeroCuotas = plazo * 2;
  if (tipoCuota === "mensual") numeroCuotas = plazo;

  if (!numeroCuotas || numeroCuotas <= 0) {
    return res.status(400).json({ mensaje: "Error en cálculo de cuotas" });
  }

  const montoCuota = total / numeroCuotas;
  const cuotas = [];
  let fechaBase = new Date(fechaInicio);
  const pagadas = Math.min(cuotasPagadas, numeroCuotas);

  for (let i = 1; i <= numeroCuotas; i++) {
    let fechaPago = new Date(fechaBase);

    if (tipoCuota === "diaria") {
      fechaPago.setDate(fechaPago.getDate() + 1);
    }
    if (tipoCuota === "semanal") {
      fechaPago.setDate(fechaPago.getDate() + 7);
    }
    if (tipoCuota === "quincenal") {
      fechaPago.setDate(fechaPago.getDate() + 15);
    }
    if (tipoCuota === "mensual") {
      fechaPago.setMonth(fechaPago.getMonth() + 1);
    }

    fechaPago = ajustarAFechaHabil(fechaPago);

    const esPagada = i <= pagadas;
    const pagado = esPagada ? montoCuota : 0;
    const saldo = esPagada ? 0 : montoCuota;
    const estado = esPagada ? "pagada" : "pendiente";

    cuotas.push([
      prestamoId,
      i,
      fechaPago,
      montoCuota,
      pagado,
      saldo,
      estado
    ]);

    fechaBase = new Date(fechaPago);
  }

  const sqlCuotas = `
    INSERT INTO cuotas
      (prestamo_id, numero, fecha_pago, monto, pagado, saldo, estado)
    VALUES ?
  `;

  db.query(sqlCuotas, [cuotas], err => {
    if (err) {
      console.error("Error al generar cuotas existentes:", err);
      return res.status(500).json({ mensaje: "Error al generar cuotas" });
    }

    res.json({ mensaje: "Préstamo existente registrado correctamente ✅" });
  });
}
/*
====================================================
GENERAR CUOTAS
- Respeta tipo de cuota
- NO genera domingos
- NO genera feriados (incluye Semana Santa)
- Ajusta automáticamente al siguiente día hábil
====================================================
*/
function generarCuotas(prestamoId, total, plazo, tipoCuota, res) {

  // 🔢 Número real de cuotas según tipo
  let numeroCuotas = plazo;

  if (tipoCuota === "diaria") numeroCuotas = plazo * 30;
  if (tipoCuota === "semanal") numeroCuotas = plazo * 4;
  if (tipoCuota === "quincenal") numeroCuotas = plazo * 2;
  if (tipoCuota === "mensual") numeroCuotas = plazo;

  // 💰 Monto por cuota

    if (!numeroCuotas || numeroCuotas <= 0) {
  return res.status(400).json({
    mensaje: "Error en cálculo de cuotas"
  });
}
  const montoCuota = total / numeroCuotas;


  // 📅 Fecha base inicial (hoy)
  let fechaBase = new Date();

  const cuotas = [];

  for (let i = 1; i <= numeroCuotas; i++) {

    let fechaPago = new Date(fechaBase);

    // ➕ Avanzar desde la última cuota
    if (tipoCuota === "diaria") {
      fechaPago.setDate(fechaPago.getDate() + 1);
    }

    if (tipoCuota === "semanal") {
      fechaPago.setDate(fechaPago.getDate() + 7);
    }

    if (tipoCuota === "quincenal") {
      fechaPago.setDate(fechaPago.getDate() + 15);
    }

    if (tipoCuota === "mensual") {
      fechaPago.setMonth(fechaPago.getMonth() + 1);
    }

    // ✅ Ajustar domingos y feriados (incluye Semana Santa)
    fechaPago = ajustarAFechaHabil(fechaPago);

    // ✅ Guardar cuota
    cuotas.push([
      prestamoId,
      i,
      fechaPago,
      montoCuota
    ]);

    // ✅ La próxima cuota parte desde aquí
    fechaBase = new Date(fechaPago);
  }

  // 🗃 Guardar todas las cuotas
  const sqlCuotas = `
    INSERT INTO cuotas
      (prestamo_id, numero, fecha_pago, monto)
    VALUES ?
  `;

  db.query(sqlCuotas, [cuotas], err => {
    if (err) {
      console.error("Error al generar cuotas:", err);
      return res.status(500).json({ mensaje: "Error al generar cuotas" });
    }

    res.json({
      mensaje: "Préstamo y cuotas creadas correctamente ✅"
    });
  });
}
/*
====================================================
OBTENER PRÉSTAMOS POR CLIENTE
====================================================
*/
const obtenerPrestamosPorCliente = (req, res) => {
  const { clienteId } = req.params;

  

  db.query(sql, [clienteId], (err, rows) => {
    if (err) {
      console.error("Error al obtener préstamos:", err);
      return res.status(500).json({ mensaje: "Error al obtener préstamos" });
    }

    res.json(rows);
  });
};
/*
====================================================
TOTAL PAGADO POR CLIENTE
====================================================
*/
const obtenerTotalPagadoPorCliente = (req, res) => {
  const { clienteId } = req.params;

  const sql = `
    SELECT IFNULL(SUM(c.pagado), 0) AS total_pagado
    FROM prestamos p
    JOIN cuotas c ON c.prestamo_id = p.id
    WHERE p.cliente_id = ?
  `;

  db.query(sql, [clienteId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: "Error al obtener total pagado" });
    }

    res.json(rows[0]);
  });
};

/*
====================================================
HISTORIAL DE PRÉSTAMOS FINALIZADOS
====================================================
*/
const obtenerHistorialPrestamos = (req, res) => {
  const { clienteId } = req.params;

  const sql = `
    SELECT *
    FROM prestamos
    WHERE cliente_id = ?
    AND estado = 'finalizado'
    ORDER BY fecha_inicio DESC
  `;

  db.query(sql, [clienteId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: "Error al obtener historial" });
    }

    res.json(rows);
  });
};
const obtenerResumenMoraCliente = async (req, res) => {
  const { clienteId } = req.params;

  try {
    // 1️⃣ Buscar el préstamo activo del cliente
    const [prestamos] = await db.promise().execute(
      `
      SELECT id
      FROM prestamos
      WHERE cliente_id = ?
        AND estado = 'activo'
      LIMIT 1
      `,
      [clienteId]
    );

    if (prestamos.length === 0) {
      return res.json({
        moroso: false,
        mora_total: 0,
        cuotas_atrasadas: 0
      });
    }

    const prestamoId = prestamos[0].id;

    // 2️⃣ Leer la MORA MENSUAL YA APLICADA (FUENTE ÚNICA DE VERDAD)
    const [moras] = await db.promise().execute(
      `
      SELECT
        COALESCE(SUM(mc.monto_asignado), 0) AS mora_total,
        COUNT(DISTINCT mc.cuota_id) AS cuotas_atrasadas
      FROM moras_mensuales mm
      JOIN moras_mensuales_cuotas mc
        ON mc.mora_mensual_id = mm.id
      WHERE mm.prestamo_id = ?
        AND mm.estado = 'aplicada'
      `,
      [prestamoId]
    );

    const moraTotal = Number(moras[0].mora_total || 0);
    const cuotasAtrasadas = Number(moras[0].cuotas_atrasadas || 0);

    // 3️⃣ RESPUESTA FINAL
    res.json({
      moroso: moraTotal > 0,
      mora_total: moraTotal,
      cuotas_atrasadas: cuotasAtrasadas
    });

  } catch (error) {
    console.error("Error resumen mora:", error);
    res.status(500).json({ mensaje: "Error al obtener resumen de mora" });
  }
};
const obtenerPrestamosCompletadosCliente = (req, res) => {
  const { clienteId } = req.params;

  const sql = `
    SELECT COUNT(*) AS prestamos_completados
    FROM prestamos
    WHERE cliente_id = ?
    AND estado = 'finalizado'
  `;

  db.query(sql, [clienteId], (err, rows) => {
    if (err) {
      console.error("Error obteniendo préstamos completados:", err);
      return res.status(500).json({ mensaje: "Error al obtener préstamos completados" });
    }

    res.json(rows[0]);
  });
};

const anularPrestamo = (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  if (!motivo || motivo.trim() === "") {
    return res.status(400).json({
      mensaje: "Debe indicar el motivo de la anulación"
    });
  }

  const usuarioId = req.usuario.id;
  const rol = String(req.usuario.rol || "").toLowerCase();

  db.query(
    `
    SELECT
      id,
      creado_en,
      estado
    FROM prestamos
    WHERE id = ?
    `,
    [id],
    (err, prestamos) => {

      if (err) {
        console.error(err);

        return res.status(500).json({
          mensaje: "Error consultando préstamo"
        });
      }

      if (prestamos.length === 0) {
        return res.status(404).json({
          mensaje: "Préstamo no encontrado"
        });
      }

      const prestamo = prestamos[0];

      if (prestamo.estado !== "activo") {
        return res.status(400).json({
          mensaje: "Solo se pueden anular préstamos activos"
        });
      }

      db.query(
        `
        SELECT COUNT(*) AS total
        FROM pagos p
        JOIN cuotas c
          ON c.id = p.cuota_id
        WHERE c.prestamo_id = ?
        `,
        [id],
        (err, pagos) => {

          if (err) {
            console.error(err);

            return res.status(500).json({
              mensaje: "Error verificando pagos"
            });
          }

          if (Number(pagos[0].total) > 0) {
            return res.status(400).json({
              mensaje:
                "Este préstamo ya posee pagos registrados y no puede ser anulado"
            });
          }

          if (rol !== "administrador") {

            const creadoEn = new Date(
              prestamo.creado_en
            );

            const ahora = new Date();

            const diferenciaMinutos =
              (ahora - creadoEn) / (1000 * 60);

            if (diferenciaMinutos > 60) {

              return res.status(403).json({
                mensaje:
                  "Este préstamo ya no puede ser anulado. Comuníquese con un administrador."
              });

            }

          }

          db.query(
            `
            INSERT INTO anulaciones_prestamos
            (
              prestamo_id,
              usuario_id,
              motivo
            )
            VALUES (?, ?, ?)
            `,
            [id, usuarioId, motivo],
            (err) => {

              if (err) {
                console.error(err);

                return res.status(500).json({
                  mensaje: "Error registrando la anulación"
                });
              }

              db.query(
                `
                UPDATE prestamos
                SET estado = 'anulado'
                WHERE id = ?
                `,
                [id],
                (err) => {

                  if (err) {
                    console.error(err);

                    return res.status(500).json({
                      mensaje: "Error anulando préstamo"
                    });
                  }

                  registrarAuditoria(
                    req.usuario.id,
                    "ANULAR",
                    "PRESTAMO",
                    id,
                    `Anuló préstamo. Motivo: ${motivo}`
                  );

                  res.json({
                    mensaje:
                      "Préstamo anulado correctamente ✅"
                  });

                }
              );

            }
          );

        }
      );

    }
  );
};
const obtenerPrestamosActivos = (req, res) => {

  const sql = `
    SELECT
      p.id,
      c.nombre AS cliente,
      p.monto,
      p.total,
      p.plazo,
      p.tipo_cuota,
      p.fecha_inicio,
      p.creado_en
    FROM prestamos p
    JOIN clientes c
      ON c.id = p.cliente_id
    WHERE p.estado = 'activo'
    ORDER BY p.creado_en DESC
  `;

  db.query(sql, (err, rows) => {

    if (err) {
      console.error(err);
      return res.status(500).json({
        mensaje: "Error obteniendo préstamos activos"
      });
    }

    res.json(rows);

  });
};


    const obtenerAuditoriaAnulaciones = (req, res) => {

  const sql = `
    SELECT
      ap.id,
      ap.motivo,
      ap.fecha,

      u.nombre AS usuario,

      c.nombre AS cliente,

      p.monto,
      p.total

    FROM anulaciones_prestamos ap

    INNER JOIN usuarios u
      ON u.id = ap.usuario_id

    INNER JOIN prestamos p
      ON p.id = ap.prestamo_id

    INNER JOIN clientes c
      ON c.id = p.cliente_id

    ORDER BY ap.fecha DESC
  `;

  db.query(sql, (err, rows) => {

    if (err) {
      console.error(err);

      return res.status(500).json({
        mensaje: "Error obteniendo auditoría"
      });
    }

    res.json(rows);

  });

};
//exports
module.exports = {
  crearPrestamo,
  crearPrestamoExistente,
  obtenerPrestamosPorCliente,
  obtenerPrestamosActivos,
  obtenerTotalPagadoPorCliente,
  obtenerHistorialPrestamos,
  obtenerResumenMoraCliente,
  obtenerPrestamosCompletadosCliente,
  esFeriadoNicaragua,
  anularPrestamo,
  obtenerAuditoriaAnulaciones
};

