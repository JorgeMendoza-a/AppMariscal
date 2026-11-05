# 🎒 Mariscal Shop — Multiservicios Mariscal

Tienda en línea (estilo Temu / Amazon) para el multiservicios de la
**U.E. "Mariscal de Ayacucho"**, con los colores del colegio: **verde, blanco y amarillo**.

Estudiantes, padres y docentes piden útiles escolares desde el celular y el pedido
llega al negocio por **WhatsApp**.

## 👥 Cuentas y permisos

Al abrir la app **todos deben iniciar sesión** (o crear su cuenta).

| | Cliente (estudiante, representante, docente) | Administrador |
|---|:---:|:---:|
| Ver productos, buscar, favoritos | ✅ | ✅ |
| Carrito y hacer pedidos | ✅ | ✅ |
| Ver **sus** pedidos y su estado en vivo | ✅ | ✅ |
| Cancelar un pedido mientras está pendiente | ✅ | ✅ |
| Crear / editar / eliminar productos, precios, stock y fotos | ❌ | ✅ |
| Ver **todos** los pedidos y cambiar su estado | ❌ | ✅ |
| Dar o quitar permisos de administrador | ❌ | ✅ |
| Ajustes de la tienda (WhatsApp, costo de entrega) | ❌ | ✅ |

- Toda cuenta nueva es **cliente**. Solo un administrador puede convertir a alguien en administrador
  (⚙️ → Usuarios → *Hacer admin*).
- Los permisos no solo se ocultan en la pantalla: las **reglas de seguridad de Firebase**
  (`firestore.rules`) impiden en el servidor que un cliente modifique productos o pedidos ajenos.

## ✨ Funciones

**Clientes**
- Inicio con ofertas, combos por nivel y lo más vendido; categorías y buscador
- Carrito, retiro en tienda o **entrega en el aula**, efectivo o transferencia
- El pedido llega al instante al panel del negocio (y opcionalmente por WhatsApp)
- Aviso cuando el pedido cambia de estado: pendiente → preparando → listo → entregado
- Mi cuenta: editar nombre, curso, paralelo y celular; recuperar contraseña por correo

**Administradores (botón ⚙️)**
- Pedidos en tiempo real con aviso 🔔 de pedido nuevo; botón para escribir al cliente por WhatsApp
- El stock se descuenta al aceptar el pedido y se devuelve si se cancela
- Productos: crear, editar, eliminar, foto desde el celular, ofertas
- Usuarios: dar o quitar rol de administrador
- Ajustes del negocio

## 🚀 Cómo probarla

No necesita instalar nada. Sirve los archivos con cualquier servidor estático:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

### Publicarla gratis (GitHub Pages)
1. En GitHub: **Settings → Pages**
2. Source: *Deploy from a branch* → elige la rama y la carpeta `/ (root)`
3. Comparte el enlace `https://<usuario>.github.io/AppMariscal/` con la comunidad educativa

## 🔥 Configurar Firebase (para usarla de verdad)

Sin Firebase la app funciona en **modo demo**: las cuentas viven solo en ese dispositivo.
Administrador de prueba: `admin@mariscal.edu` / `Mariscal2026`.

Para que todos compartan el mismo catálogo y pedidos (gratis en el plan Spark):

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto** (ej. `mariscal-shop`).
2. **Authentication** → *Comenzar* → *Sign-in method* → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → *Crear base de datos* → modo **producción** → región cercana (ej. `southamerica-east1`).
4. Firestore → pestaña **Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.
5. ⚙️ *Configuración del proyecto* → *Tus apps* → ícono **Web `</>`** → registra la app y copia el objeto
   `firebaseConfig` dentro de [`firebase-config.js`](firebase-config.js) (reemplazando `null`).
6. Si la publicas en GitHub Pages: Authentication → *Configuración* → **Dominios autorizados** →
   agrega `<usuario>.github.io`.
7. **Crea el primer administrador:**
   - Abre la app y regístrate normalmente con tu correo.
   - En Firestore → colección `users` → abre tu documento → cambia `role` de `student` a **`admin`**.
   - Recarga la app: aparecerá el botón ⚙️. Desde ahí puedes nombrar a otros administradores.
8. En ⚙️ → **Productos** pulsa **📥 Cargar catálogo inicial** y luego ajusta precios y stock.
9. En ⚙️ → **Ajustes** pon el número de WhatsApp real del negocio.

## 📲 App Android (APK)

Cada vez que cambia algo en `android/`, **GitHub Actions** compila la APK y la publica en
*Releases*. Enlace fijo de descarga:

**https://github.com/JorgeMendoza-a/AppMariscal/releases/download/apk/MariscalShop.apk**

- La app Android abre la tienda publicada en GitHub Pages, así que **los cambios de la tienda
  llegan solos**, sin reinstalar la APK.
- En la tienda hay un botón **"📲 Descargar app para Android"** (inicio de sesión en Android y *Mi cuenta*).
- Recompilar a mano: pestaña **Actions → Construir APK Android → Run workflow**.
- Para instalar, Android pedirá permitir "Instalar apps desconocidas".
- **Firma:** sin configurar nada, la APK se firma con una clave de prueba distinta en cada
  compilación (para actualizar la APK habría que desinstalar primero). Para una firma fija
  (necesaria para Google Play) guarda en GitHub → *Settings → Secrets and variables → Actions*:
  `ANDROID_KEYSTORE_BASE64` (archivo .keystore en base64), `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
  y `KEY_ALIAS`. **Nunca subas el archivo .keystore al repositorio.**

## 🔔 Notificaciones con la app cerrada

Una **Cloud Function** (`functions/index.js`) envía notificaciones push con Firebase Cloud
Messaging: al cliente cuando su pedido pasa a **Listo** y a los administradores cuando entra un
**pedido nuevo**. Cada dispositivo guarda su token en `users/{uid}.fcmTokens`.

Requisitos (una sola vez):
1. Plan **Blaze** en Firebase (pide tarjeta; con el uso de un colegio el costo es $0).
   Recomendado: crear una alerta de presupuesto de $1.
2. **Android:** registrar la app Android (`ec.edu.mariscal.shop`) en Firebase y poner su
   `google-services.json` en `android/app/`.
3. **Navegador:** Cloud Messaging → *Certificados push web* → generar clave y ponerla en
   `self.FIREBASE_VAPID_KEY` dentro de `firebase-config.js`.
4. **Publicar la función** desde Google Cloud Shell:
   ```bash
   git clone -b claude/school-marketplace-app-nj259f https://github.com/JorgeMendoza-a/AppMariscal.git
   cd AppMariscal/functions && npm install && cd ..
   npx firebase-tools login --no-localhost
   npx firebase-tools deploy --only functions --project mariscal-shop --force
   ```

## 📁 Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño con los colores del colegio |
| `app.js` | Pantallas: acceso, tienda, carrito, pedidos, cuenta, administración |
| `backend.js` | Datos: Firebase (Auth + Firestore) o modo demo local |
| `firebase-config.js` | Credenciales de tu proyecto Firebase |
| `functions/` | Cloud Functions que envían las notificaciones push |
| `firestore.rules` | Reglas de seguridad (quién puede leer/escribir qué) |
| `products.js` | Datos del negocio, categorías y catálogo inicial |
| `manifest.webmanifest`, `sw.js` | App web instalable |
| `android/`, `.github/workflows/android.yml` | App Android y su compilación automática |

## 🛣️ Ideas para después
- Pagos en línea (PayPhone / DeUna / tarjeta)
- Notificaciones push cuando el pedido esté listo
- Reportes de ventas por semana y productos más vendidos
- Lista de útiles por curso para comprar todo con un toque
