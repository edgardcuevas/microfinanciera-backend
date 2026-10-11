const express = require("express");

const router = express.Router();

const {
  obtenerAuditoria,
    obtenerAuditoriaCompleta
} = require("../controllers/auditoria.controller");

const verificarToken =
  require("../middlewares/auth");

const soloAdmin =
  require("../middlewares/soloAdmin");

// 🔒 Solo administradores: el historial de acciones es información sensible
router.get(
  "/",
  verificarToken,
  soloAdmin,
  obtenerAuditoria
);

router.get(
  "/completa",
  verificarToken,
  soloAdmin,
  obtenerAuditoriaCompleta
);

module.exports = router;