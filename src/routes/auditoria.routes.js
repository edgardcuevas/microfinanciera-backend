const express = require("express");

const router = express.Router();

const {
  obtenerAuditoria,
    obtenerAuditoriaCompleta
} = require("../controllers/auditoria.controller");

const verificarToken =
  require("../middlewares/auth");

router.get(
  "/",
  verificarToken,
  obtenerAuditoria
);

router.get(
  "/completa",
  verificarToken,
  obtenerAuditoriaCompleta
);

module.exports = router;