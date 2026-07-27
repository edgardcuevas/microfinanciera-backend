const db = require("../config/db");
const {
  registrarAuditoria
} = require("../services/auditoria.service");

/**
 * GET /api/clientes
 * Lista todos los clientes
 */
exports.listarClientes = (req, res) => {
  const usuario = req.usuario;

  let sql = `
    SELECT 
      c.id,
      c.nombre,
      c.cedula,
      c.sexo,
      c.telefono,
      c.estado_civil,
      d.nombre AS departamento,
      m.nombre AS municipio,
      b.nombre AS barrio,
      t.nombre AS trabajo,
      c.direccion
    FROM clientes c
    LEFT JOIN departamentos d ON c.departamento_id = d.id
    LEFT JOIN municipios m ON c.municipio_id = m.id
    LEFT JOIN barrios b ON c.barrio_id = b.id
    LEFT JOIN trabajos t ON c.trabajo_id = t.id
  `;

  const params = [];

  // ✅ Si NO es admin, solo sus clientes
  if (usuario.rol !== "administrador") {
    sql += " WHERE c.usuario_id = ?";
    params.push(usuario.id);
  }

  sql += " ORDER BY c.id DESC";

  db.query(sql, params, (error, rows) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al listar clientes" });
    }

    res.json(rows);
  });
};

/**
 * POST /api/clientes
 * Crear un cliente
 */

exports.crearCliente = (req, res) => {
  const {
    nombre,
    cedula,
    sexo,
    telefono,
    departamento_id,
    municipio_id,
    barrio_id,
    direccion,
    trabajo_id,
    estado_civil
  } = req.body;

  const usuario_id = req.usuario.id; // ✅ usuario real logueado

  const sql = `
  INSERT INTO clientes
  (
    nombre,
    cedula,
    sexo,
    telefono,
    departamento_id,
    municipio_id,
    barrio_id,
    direccion,
    trabajo_id,
    usuario_id,
    estado_civil
  )
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`;

  db.query(
    sql,
    [
      nombre,
      cedula,
      sexo,
      telefono,
      departamento_id,
      municipio_id,
      barrio_id,
      direccion,
      trabajo_id,
      usuario_id,
      estado_civil
    ],
          (error, result) => {
            if (error) {
              console.error(error);
              return res.status(500).json({
                mensaje: "Error al crear cliente"
              });
            }


        console.log(
        "AUDITORIA",
        req.usuario.id,
        result.insertId,
        nombre
      );

      registrarAuditoria(
        req.usuario.id,
        "CREAR",
        "CLIENTE",
        result.insertId,
        `Creó el cliente ${nombre}`
      );

      res.json({
        mensaje: "Cliente creado correctamente ✅",
        clienteId: result.insertId
      });
    }
  );
};



/**
 * DELETE /api/clientes/:id
 * Eliminar cliente y dependencias
 */
const eliminarCliente = async (req, res) => {

  const { id } = req.params;
  const usuario = req.usuario;

  if (usuario.rol !== "administrador") {
    return res.status(403).json({
      mensaje: "No tienes permisos para eliminar clientes"
    });
  }

  const conn = await db.promise().getConnection();

  try {

    await conn.beginTransaction();

    const [clienteRows] = await conn.execute(
      `
      SELECT nombre
      FROM clientes
      WHERE id = ?
      `,
      [id]
    );

    const nombreCliente =
      clienteRows.length > 0
        ? clienteRows[0].nombre
        : "Cliente desconocido";

    // ✅ 1 eliminar cuotas
    await conn.execute(`
      DELETE c FROM cuotas c
      JOIN prestamos p ON c.prestamo_id = p.id
      WHERE p.cliente_id = ?
    `, [id]);

    // ✅ 2 eliminar fiadores
    await conn.execute(`
      DELETE f FROM fiadores f
      JOIN prestamos p ON f.prestamo_id = p.id
      WHERE p.cliente_id = ?
    `, [id]);

    // ✅ 3 eliminar anulaciones
    await conn.execute(`
      DELETE ap
      FROM anulaciones_prestamos ap
      JOIN prestamos p
        ON ap.prestamo_id = p.id
      WHERE p.cliente_id = ?
    `, [id]);

    // ✅ 4 eliminar préstamos
    await conn.execute(`
      DELETE FROM prestamos
      WHERE cliente_id = ?
    `, [id]);

    // ✅ 5 eliminar comentarios
    await conn.execute(`
      DELETE FROM comentarios_clientes
      WHERE cliente_id = ?
    `, [id]);

    // ✅ 6 eliminar recordatorios
    await conn.execute(`
      DELETE FROM recordatorios
      WHERE cliente_id = ?
    `, [id]);

    // ✅ 7 eliminar cliente
    await conn.execute(`
      DELETE FROM clientes
      WHERE id = ?
    `, [id]);

    await conn.commit();

    registrarAuditoria(
      req.usuario.id,
      "ELIMINAR",
      "CLIENTE",
      id,
      `Eliminó el cliente ${nombreCliente}`
    );

    res.json({
      mensaje: "Cliente eliminado correctamente ✅"
    });

  } catch (error) {

    await conn.rollback();

    console.error(
      "Error eliminando cliente:",
      error
    );

    res.status(500).json({
      mensaje: "Error eliminando cliente"
    });

  } finally {

    conn.release();

  }

};

/**
 * GET /api/clientes/frecuentes
 */
exports.obtenerClientesFrecuentes = (req, res) => {
  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;

  let sql = `
    SELECT c.id, c.nombre, COUNT(p.id) AS prestamos_completados
    FROM clientes c
    JOIN prestamos p ON p.cliente_id = c.id
    WHERE p.estado = 'finalizado'
  `;

  const params = [];

  // 👷 si NO es admin, filtrar por el usuario
  if (rol !== "administrador") {
    sql += " AND c.usuario_id = ?";
    params.push(usuarioId);
  }

  sql += `
    GROUP BY c.id
    HAVING prestamos_completados >= 3
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ mensaje: "Error" });
    }
    res.json(rows);
  });
};
exports.actualizarCliente = (req, res) => {

  const { id } = req.params;

  const {
    nombre,
    cedula,
    sexo,
    telefono,
    departamento_id,
    municipio_id,
    trabajo_id,
    barrio_id,
    direccion,
    estado_civil
  } = req.body;

  const sql = `
    UPDATE clientes
    SET
      nombre = ?,
      cedula = ?,
      sexo = ?,
      telefono = ?,
      departamento_id = ?,
      municipio_id = ?,
      trabajo_id = ?,
      barrio_id = ?,
      direccion = ?,
      estado_civil = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      nombre,
      cedula,
      sexo,
      telefono,
      departamento_id,
      municipio_id,
      trabajo_id,
      barrio_id,
      direccion,
      estado_civil,
      id
    ],
    err => {

      if (err) {
        console.error(err);

        return res.status(500).json({
          mensaje: "Error al actualizar cliente"
        });
      }

      registrarAuditoria(
        req.usuario.id,
        "EDITAR",
        "CLIENTE",
        id,
        `Editó el cliente ${nombre}`
      );

      res.json({
        mensaje: "Cliente actualizado ✅"
      });

    }
  );

};

const obtenerClientesDashboard = (req, res) => {
  const usuarioId = req.usuario.id;
  const rol = req.usuario.rol;

  // ✅ detectar admin correctamente
  const esAdmin = String(rol).toLowerCase() === "administrador";

  let sql = `
    SELECT 
      c.id,
      c.nombre,
      MAX(p.id) AS prestamo_id
    FROM clientes c
    LEFT JOIN prestamos p 
      ON p.cliente_id = c.id 
      AND p.estado = 'activo'
  `;

  let params = [];

  // ✅ SOLO filtrar si no es admin
  if (!esAdmin) {
    sql += " WHERE c.usuario_id = ?";
    params.push(usuarioId);
  }

  sql += `
    GROUP BY c.id, c.nombre
    ORDER BY c.nombre ASC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error clientes dashboard:", err);
      return res.status(500).json(err);
    }

    res.json(rows);
  });
};
const obtenerRegistroCliente = async (req, res) => {
  const { id } = req.params;

  try {

    const [prestamosFinalizados] = await db.promise().execute(
      `
      SELECT COUNT(*) AS total
      FROM prestamos
      WHERE cliente_id = ?
      AND estado = 'finalizado'
      `,
      [id]
    );

    const [prestamosActivos] = await db.promise().execute(
      `
      SELECT COUNT(*) AS total
      FROM prestamos
      WHERE cliente_id = ?
      AND estado = 'activo'
      `,
      [id]
    );

    const [totalPrestado] = await db.promise().execute(
      `
      SELECT IFNULL(SUM(monto),0) AS total
      FROM prestamos
      WHERE cliente_id = ?
      `,
      [id]
    );

    const [totalRecuperado] = await db.promise().execute(
      `
      SELECT IFNULL(SUM(c.pagado),0) AS total
      FROM prestamos p
      JOIN cuotas c ON c.prestamo_id = p.id
      WHERE p.cliente_id = ?
      `,
      [id]
    );

    const [mora] = await db.promise().execute(
      `
      SELECT
      IFNULL(SUM(mc.monto_asignado),0) AS mora_total,
      COUNT(DISTINCT mc.cuota_id) AS cuotas_atrasadas
      FROM prestamos p
      LEFT JOIN moras_mensuales mm
        ON mm.prestamo_id = p.id
      LEFT JOIN moras_mensuales_cuotas mc
        ON mc.mora_mensual_id = mm.id
      WHERE p.cliente_id = ?
      `,
      [id]
    );

    const cuotasAtrasadas =
      Number(mora[0].cuotas_atrasadas || 0);

    const moraTotal =
      Number(mora[0].mora_total || 0);

    let evaluacion = "🆕 Cliente nuevo";

    if (
      moraTotal === 0 &&
      cuotasAtrasadas === 0 &&
      prestamosFinalizados[0].total >= 3
    ) {
      evaluacion = "🟢 Excelente";
    } else if (cuotasAtrasadas <= 2) {
      evaluacion = "🔵 Bueno";
    } else if (cuotasAtrasadas <= 5) {
      evaluacion = "🟠 Regular";
    } else {
      evaluacion = "🔴 Riesgoso";
    }

    res.json({
      prestamos_completados:
        prestamosFinalizados[0].total,

      prestamos_activos:
        prestamosActivos[0].total,

      total_prestado:
        totalPrestado[0].total,

      total_recuperado:
        totalRecuperado[0].total,

      cuotas_atrasadas:
        cuotasAtrasadas,

      mora_total:
        moraTotal,

      evaluacion
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error obteniendo registro"
    });
  }
};

//exports
module.exports = {
  listarClientes: exports.listarClientes,
  crearCliente: exports.crearCliente,
  obtenerClientesFrecuentes: exports.obtenerClientesFrecuentes,
  actualizarCliente: exports.actualizarCliente,
  eliminarCliente,
  obtenerClientesDashboard,
  obtenerRegistroCliente
};