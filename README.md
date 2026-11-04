# 🎒 Mariscal Shop — Multiservicios Mariscal

Tienda en línea (estilo Temu / Amazon) para el multiservicios de la
**U.E. "Mariscal de Ayacucho"**, con los colores del colegio: **verde, blanco y amarillo**.

Estudiantes, padres y docentes piden útiles escolares desde el celular y el pedido
llega al negocio por **WhatsApp**.

## ✨ Funciones

**Para los clientes**
- Inicio con ofertas, combos por nivel (Inicial, Básica, Bachillerato) y lo más vendido
- Categorías: escritura, cuadernos, arte, geometría, oficina, servicios (copias, impresiones, anillado) y combos
- Buscador (sin importar tildes) y ordenar por precio, ventas o calificación
- Detalle de producto con descuentos, stock y productos relacionados
- Carrito con cantidades, ahorro total y meta de "regalo sorpresa"
- Checkout: nombre, curso, paralelo, celular, **retiro en tienda o entrega en el aula**, efectivo o transferencia
- El pedido se envía por WhatsApp al negocio con todo el detalle
- "Mis pedidos" con estado y botón **Volver a pedir**
- Se puede **instalar en el celular** como app (PWA) y funciona sin internet para ver el catálogo

**Para el negocio (⚙️ arriba a la derecha, PIN inicial `2026`)**
- Agregar, editar y eliminar productos (con foto desde el celular)
- Control de stock (se descuenta solo con cada pedido)
- Ver pedidos y cambiar su estado: pendiente → preparando → listo → entregado / cancelado
- Ajustes: nombre del negocio, número de WhatsApp, costo de entrega, PIN

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

## ⚙️ Configuración

Edita `products.js`:
- `STORE_CONFIG.whatsapp` → **pon aquí el número real del negocio** (ej. `593991234567`)
- `STORE_CONFIG.adminPin` → cambia el PIN
- `DEFAULT_PRODUCTS` → precios y productos iniciales

## 📁 Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño con los colores del colegio |
| `app.js` | Lógica: catálogo, carrito, pedidos, admin |
| `products.js` | Configuración del negocio y catálogo |
| `manifest.webmanifest`, `sw.js` | App instalable y modo sin conexión |

## ⚠️ Limitaciones actuales y siguiente paso

Esta versión guarda los datos **en cada dispositivo** (localStorage). Por eso:
- Los pedidos le llegan al negocio por **WhatsApp**. El panel admin solo ve los pedidos hechos en ese mismo dispositivo.
- Los productos que cambie el administrador solo se ven en su dispositivo. Para que todos vean
  los cambios hay que editar `products.js` y volver a publicar.

**Siguiente paso recomendado:** conectar una base de datos en la nube (por ejemplo Firebase o Supabase)
para tener catálogo compartido, pedidos en tiempo real, cuentas de usuario y pagos en línea.
