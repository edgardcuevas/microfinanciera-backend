# ACTIVATE — Backend

Backend de **ACTIVATE**, un sistema de gestión financiera desarrollado para administrar clientes, préstamos, cuotas y pagos, incorporando control de acceso, reglas de negocio, auditoría y procesos automatizados.

El proyecto comenzó como una aplicación CRUD y evolucionó progresivamente hasta convertirse en una solución orientada a la gestión de operaciones financieras. El sistema llegó a utilizarse durante aproximadamente tres meses en un negocio familiar, permitiendo identificar necesidades reales y ampliar sus funcionalidades.

> Este repositorio contiene exclusivamente el backend. El frontend se encuentra en un repositorio independiente.

**Frontend:** [microfinanciera-frontend](https://github.com/edgardcuevas/microfinanciera-frontend)

---

##  Características principales

* Autenticación de usuarios mediante JWT.
* Control de acceso basado en roles.
* Gestión de usuarios y permisos.
* Gestión de clientes.
* Gestión de préstamos.
* Administración de cuotas y pagos.
* Pagos totales y parciales.
* Gestión y cálculo de mora.
* Anulación de préstamos bajo condiciones específicas.
* Gestión de barrios, municipios y departamentos.
* Sistema de auditoría de operaciones.
* Gestión de comentarios, mensajes y recordatorios.
* Procesos automatizados mediante tareas programadas.
* Protección mediante rate limiting y cabeceras de seguridad.
* Uso de transacciones para operaciones que requieren integridad de datos.

---

##  Arquitectura

El backend está organizado siguiendo una separación por responsabilidades:

```text
src/
├── config/
├── controllers/
├── jobs/
├── middlewares/
├── routes/
├── services/
├── utils/
├── app.js
└── server.js
```

### Principales responsabilidades

**Controllers**

Gestionan las solicitudes HTTP y coordinan las operaciones correspondientes.

**Routes**

Definen los endpoints disponibles para cada módulo del sistema.

**Services**

Contienen lógica reutilizable y operaciones específicas de negocio.

**Middlewares**

Gestionan aspectos transversales como autenticación y restricciones de acceso.

**Jobs**

Contienen procesos automatizados que se ejecutan de forma programada.

**Config**

Centraliza la configuración necesaria para la conexión y funcionamiento del sistema.

---

##  Tecnologías

### Backend

* Node.js
* Express.js

### Base de datos

* MySQL
* mysql2

### Autenticación y seguridad

* JSON Web Tokens (JWT)
* bcrypt
* Helmet
* CORS
* express-rate-limit
* dotenv

### Automatización

* node-cron

---

##  Autenticación y control de acceso

ACTIVATE utiliza **JWT** para gestionar las sesiones de los usuarios.

El sistema diferencia principalmente entre:

* **Administradores**
* **Trabajadores**

Los trabajadores mantienen aisladas sus operaciones y clientes respecto a otros trabajadores, mientras que los administradores disponen de una visión global de la información y de las actividades realizadas dentro del sistema.

Las rutas protegidas utilizan middleware de autenticación para verificar la validez del token y controlar el acceso a los recursos correspondientes.

---

##  Gestión financiera

El backend contiene módulos específicos para las principales operaciones del sistema:

### Clientes

Permite registrar, consultar y administrar la información de los clientes.

### Préstamos

Gestiona la creación y administración de préstamos, incluyendo sus condiciones y estados.

### Cuotas y pagos

Permite administrar las cuotas asociadas a los préstamos y registrar pagos totales o parciales.

### Mora

El sistema incorpora un proceso automatizado para calcular y distribuir la mora sobre los saldos pendientes.

Este proceso se ejecuta mediante tareas programadas y aplica las reglas de negocio correspondientes para evitar que el incremento de una cuota supere los límites establecidos.

Las operaciones que requieren múltiples modificaciones relacionadas utilizan **transacciones de base de datos** para mantener la integridad de la información.

---

##  Auditoría

ACTIVATE incorpora un sistema de auditoría que permite registrar y consultar operaciones realizadas dentro de la aplicación.

Esto proporciona trazabilidad sobre las acciones ejecutadas por los usuarios y facilita la supervisión de las actividades del sistema.

---

##  Seguridad

Entre las medidas implementadas se encuentran:

* Contraseñas almacenadas mediante hashing con bcrypt.
* Autenticación mediante JWT.
* Middleware para protección de rutas.
* Control de acceso según el rol del usuario.
* Rate limiting para limitar solicitudes excesivas.
* Helmet para establecer cabeceras HTTP de seguridad.
* Variables sensibles gestionadas mediante variables de entorno.
* CORS configurado para controlar el acceso desde el frontend.

> Las credenciales, claves secretas y demás información sensible no forman parte del repositorio.

---

##  Requisitos

Para ejecutar el backend localmente necesitas:

* Node.js
* npm
* MySQL
* Git

---

##  Instalación

Clona el repositorio:

```bash
git clone https://github.com/edgardcuevas/microfinanciera-backend.git
```

Entra al proyecto:

```bash
cd microfinanciera-backend
```

Instala las dependencias:

```bash
npm install
```

Configura las variables de entorno utilizando `.env.example` como referencia.

Después inicia el servidor:

```bash
npm start
```

El servidor se iniciará utilizando la configuración definida en las variables de entorno.

---

##  Variables de entorno

El proyecto incluye un archivo `.env.example` para mostrar las variables necesarias sin exponer credenciales reales.

Configura las variables relacionadas con:

* Conexión a MySQL.
* Puerto del servidor.
* Secreto utilizado para JWT.
* Configuración necesaria para el funcionamiento del sistema.

**Nunca publiques valores reales de `.env` en el repositorio.**

---

##  Frontend

El frontend de ACTIVATE se mantiene en un repositorio independiente:

**[ACTIVATE — Frontend](https://github.com/edgardcuevas/microfinanciera-frontend)**

La aplicación frontend consume la API proporcionada por este backend.

---

##  Estado del proyecto

**Proyecto desarrollado y utilizado durante aproximadamente tres meses en un negocio familiar.**

Actualmente se mantiene como proyecto de portafolio y aprendizaje, y representa la evolución de una aplicación CRUD inicial hacia un sistema con gestión financiera, autenticación, autorización, automatización, auditoría y reglas de negocio.

---

##  Autor

**Edgard Cuevas**

* GitHub: [@edgardcuevas](https://github.com/edgardcuevas)
* LinkedIn: [Edgard Cuevas](https://www.linkedin.com/in/edgardcuevas-dev/)
