const express = require("express");
const cors = require("cors");
const path = require("path");

// ✅ SEGURIDAD
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// ==============================
// 🌐 CORS — orígenes permitidos
// ==============================
// Lista separada por comas en la variable CORS_ORIGINS.
// Sin esa variable se permiten los orígenes estándar de
// desarrollo (localhost), nunca "*" en producción.
// ==============================
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DESARROLLO = [
  "http://localhost:3000",
  "http://localhost:5500",
  "http://localhost:8080",
  "http://127.0.0.1:3000"
];

const origenesPermitidos = CORS_ORIGINS.length
  ? CORS_ORIGINS
  : DESARROLLO;

const opcionesCors = {
  origin: (origen, callback) => {
    // Sin encabezado Origin (móvil, curl, server-to-server): permitido
    if (!origen) return callback(null, true);

    if (origenesPermitidos.includes(origen)) {
      return callback(null, true);
    }

    // false = no se envía cabecera Access-Control-Allow-Origin,
    // el navegador bloquea la respuesta. No se genera error 500.
    return callback(null, false);
  },
  credentials: true
};

const wrap = (r) => r.router || r;

const clientesRoutes = wrap(require("./routes/clientes.routes"));
const municipiosRoutes = wrap(require("./routes/municipios.routes"));
const trabajosRoutes = wrap(require("./routes/trabajos.routes"));
const comentariosRoutes = wrap(require("./routes/comentarios.routes"));
const prestamosRoutes = wrap(require("./routes/prestamos.routes"));
const cuotasRoutes = wrap(require("./routes/cuotas.routes"));
const barriosRoutes = wrap(require("./routes/barrios.routes"));
const authRoutes = wrap(require("./routes/auth.routes"));
const usuariosRoutes = wrap(require("./routes/usuarios.routes"));
const recordatoriosRoutes = wrap(require("./routes/recordatorios.routes"));
const departamentosRoutes = wrap(require("./routes/departamentos.routes"));
const mensajesRoutes = wrap(require("./routes/mensajes.routes"));
const auditoriaRoutes = wrap(require("./routes/auditoria.routes"));


const app = express();

// 🔐 Helmet
app.use(helmet());

// 🌐 CORS
app.use(cors(opcionesCors));

// 📦 JSON
app.use(express.json());

// ==========================================
// 🚀 RUTA DE MONITOREO (UptimeRobot)
// Se coloca aquí para saltarse los Rate Limits
// ==========================================
app.get("/ping", (req, res) => {
  return res.status(200).send("pong");
});

// 📁 ARCHIVOS ESTÁTICOS (Frontend)
app.use(express.static(path.join(__dirname, "../../frontend")));

// 🚫 RATE LIMIT GENERAL
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    mensaje: "Demasiadas solicitudes, intenta más tarde"
  }
});

// 🔐 RATE LIMIT LOGIN
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    mensaje: "Demasiados intentos de login, intenta más tarde"
  }
});

// ✅ aplicar protección
app.use("/api", limiter);
app.use("/api/auth", loginLimiter, authRoutes);

// Rutas
app.use("/api/clientes", clientesRoutes);
app.use("/api/prestamos", prestamosRoutes);
app.use("/api/municipios", municipiosRoutes);
app.use("/api/trabajos", trabajosRoutes);
app.use("/api/comentarios", comentariosRoutes);
app.use("/api/cuotas", cuotasRoutes);
app.use("/api/barrios", barriosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/recordatorios", recordatoriosRoutes);
app.use("/api/departamentos", departamentosRoutes);
app.use("/api/mensajes", mensajesRoutes);
app.use("/api/auditoria", auditoriaRoutes);
require("./jobs/mora.job");
require("./jobs/notificaciones.job");

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("✅ API Microfinanciera activa");
});

module.exports = app;