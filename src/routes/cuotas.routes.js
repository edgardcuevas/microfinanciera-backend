const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const cuotasController = require("../controllers/cuotas.controller");

// ✅ Requiere token: expone saldos, pagos y moras del préstamo
router.get(
  "/prestamo/:prestamoId",
  auth,
  cuotasController.obtenerCuotasPorPrestamo
);
router.get("/cobros-hoy", auth, cuotasController.obtenerCobrosHoy);
router.get("/pagos-hoy", auth, cuotasController.obtenerPagosHoy);
router.get("/meta-hoy", auth, cuotasController.obtenerMetaHoy);
router.get("/metas-anteriores", auth, cuotasController.obtenerMetasAnteriores);

router.post(
  "/:id/pago",
  auth,
  cuotasController.registrarPagoCuota
);

module.exports = router;