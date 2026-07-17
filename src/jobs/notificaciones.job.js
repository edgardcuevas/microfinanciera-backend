const cron = require("node-cron");
const db = require("../config/db");

// 🧹 Elimina mensajes con más de 30 días
const limpiarMensajesVencidos = () => {

  console.log("🧹 Revisando mensajes vencidos...");

  const sqlDestinatarios = `
    DELETE md
    FROM mensajes_destinatarios md
    INNER JOIN mensajes m
      ON m.id = md.mensaje_id
    WHERE m.fecha < DATE_SUB(
      NOW(),
      INTERVAL 30 DAY
    )
  `;

  db.query(sqlDestinatarios, (err) => {

    if (err) {
      console.error(
        "❌ Error eliminando destinatarios:",
        err
      );
      return;
    }

    const sqlMensajes = `
      DELETE
      FROM mensajes
      WHERE fecha < DATE_SUB(
        NOW(),
        INTERVAL 30 DAY
      )
    `;

    db.query(sqlMensajes, (err, result) => {

      if (err) {
        console.error(
          "❌ Error eliminando mensajes:",
          err
        );
        return;
      }

      console.log(
        `✅ Mensajes vencidos eliminados: ${result.affectedRows}`
      );

    });

  });

};

// ⏰ Todos los días a las 2:00 AM
cron.schedule("0 2 * * *", () => {

  limpiarMensajesVencidos();

});

