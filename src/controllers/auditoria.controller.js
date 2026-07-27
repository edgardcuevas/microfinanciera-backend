const db = require("../config/db");

const obtenerAuditoria = (req, res) => {

  const sql = `
    SELECT
      a.id,
      a.fecha,
      u.nombre AS usuario,
      a.accion,
      a.entidad,
      a.entidad_id,
      a.descripcion
    FROM auditoria a
    INNER JOIN usuarios u
      ON u.id = a.usuario_id
    ORDER BY a.fecha DESC
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

const obtenerAuditoriaCompleta = async (req, res) => {

  try {

    const sqlGeneral = `
      SELECT
        a.id,
        a.fecha,
        u.nombre AS usuario,
        a.accion,
        a.entidad,
        a.entidad_id,
        a.descripcion
      FROM auditoria a
      INNER JOIN usuarios u
        ON u.id = a.usuario_id
      ORDER BY a.fecha DESC
    `;

    const sqlAnulaciones = `
      SELECT
        ap.id,
        ap.fecha,
        ap.motivo,
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

    db.query(
      sqlGeneral,
      (err, general) => {

        if (err) {
          return res.status(500).json({
            mensaje: "Error auditoría general"
          });
        }

        db.query(
          sqlAnulaciones,
          (err2, anulaciones) => {

            if (err2) {
              return res.status(500).json({
                mensaje: "Error anulaciones"
              });
            }

            res.json({
              general,
              anulaciones
            });

          }
        );

      }
    );

  } catch (error) {

    console.error(error);

    res.status(500).json({
      mensaje: "Error interno"
    });

  }

};

module.exports = {
  obtenerAuditoria,
  obtenerAuditoriaCompleta
};