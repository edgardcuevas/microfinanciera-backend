const db = require("../config/db");

const registrarAuditoria = (
  usuarioId,
  accion,
  entidad,
  entidadId,
  descripcion
) => {

  const sql = `
    INSERT INTO auditoria
    (
      usuario_id,
      accion,
      entidad,
      entidad_id,
      descripcion
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      usuarioId,
      accion,
      entidad,
      entidadId,
      descripcion
    ],
    err => {

            if (err) {

            console.error(
                "Error registrando auditoría:",
                err
            );

            }
            else {

            console.log(
                "✅ Auditoría registrada"
            );

            }

    }
  );

};

module.exports = {
  registrarAuditoria
};