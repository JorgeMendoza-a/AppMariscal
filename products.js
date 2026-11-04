// =====================================================================
//  CONFIGURACIÓN DE LA TIENDA  —  edita aquí los datos del negocio
// =====================================================================
window.STORE_CONFIG = {
  name: 'Multiservicios Mariscal',
  school: 'U.E. "Mariscal de Ayacucho"',
  slogan: 'Formamos hoy, líderes del mañana',
  // Número de WhatsApp del negocio en formato internacional, sin "+" ni espacios
  whatsapp: '593900000000',
  currency: 'USD',
  currencySymbol: '$',
  // Costo de entrega dentro del colegio (0 = gratis)
  deliveryFee: 0,
  // Pedidos sobre este monto tienen un regalo / mensaje especial
  freeGiftOver: 15,
};

window.CATEGORIES = [
  { id: 'escritura', name: 'Escritura', icon: '✏️' },
  { id: 'cuadernos', name: 'Cuadernos', icon: '📒' },
  { id: 'arte', name: 'Arte y colores', icon: '🎨' },
  { id: 'geometria', name: 'Geometría', icon: '📐' },
  { id: 'oficina', name: 'Oficina', icon: '📎' },
  { id: 'servicios', name: 'Servicios', icon: '🖨️' },
  { id: 'combos', name: 'Combos', icon: '🎒' },
];

// Catálogo inicial. Con Firebase, el administrador lo carga una sola vez
// desde Admin → Productos → "Cargar catálogo inicial" y luego lo edita ahí.
window.DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Pluma azul BIC Cristal', cat: 'escritura', price: 0.35, oldPrice: 0.45, emoji: '🖊️', stock: 120, rating: 4.8, sold: 540, desc: 'Pluma de punta media 1.0 mm, tinta azul de secado rápido.' },
  { id: 'p2', name: 'Pluma roja BIC Cristal', cat: 'escritura', price: 0.35, emoji: '🖊️', stock: 80, rating: 4.7, sold: 310, desc: 'Ideal para correcciones y subrayados.' },
  { id: 'p3', name: 'Lápiz HB #2 (unidad)', cat: 'escritura', price: 0.25, emoji: '✏️', stock: 200, rating: 4.6, sold: 820, desc: 'Lápiz de grafito HB con borrador.' },
  { id: 'p4', name: 'Portaminas 0.5 mm', cat: 'escritura', price: 1.50, oldPrice: 2.00, emoji: '✏️', stock: 30, rating: 4.5, sold: 95, desc: 'Portaminas con agarre de goma y clip metálico.' },
  { id: 'p5', name: 'Borrador blanco', cat: 'escritura', price: 0.30, emoji: '🧽', stock: 150, rating: 4.7, sold: 410, desc: 'Borrador suave que no mancha el papel.' },
  { id: 'p6', name: 'Corrector líquido', cat: 'escritura', price: 1.00, emoji: '🧴', stock: 40, rating: 4.3, sold: 120, desc: 'Corrector de secado rápido con aplicador.' },
  { id: 'p7', name: 'Resaltadores x4 colores', cat: 'escritura', price: 2.50, oldPrice: 3.20, emoji: '🖍️', stock: 35, rating: 4.9, sold: 260, desc: 'Amarillo, verde, rosado y naranja fluorescentes.' },

  { id: 'p8', name: 'Cuaderno universitario 100 hojas', cat: 'cuadernos', price: 1.75, emoji: '📓', stock: 90, rating: 4.8, sold: 600, desc: 'Cuadriculado, espiral doble, pasta dura.' },
  { id: 'p9', name: 'Cuaderno escolar líneas 60 hojas', cat: 'cuadernos', price: 0.90, emoji: '📒', stock: 140, rating: 4.6, sold: 700, desc: 'Cuaderno cosido de líneas, tamaño escolar.' },
  { id: 'p10', name: 'Cuaderno de dibujo A4', cat: 'cuadernos', price: 1.40, emoji: '📔', stock: 50, rating: 4.5, sold: 150, desc: '20 hojas de cartulina blanca para dibujo.' },
  { id: 'p11', name: 'Resma papel bond A4', cat: 'cuadernos', price: 5.50, emoji: '📄', stock: 25, rating: 4.7, sold: 80, desc: '500 hojas, 75 g.' },

  { id: 'p12', name: 'Marcadores x12 colores', cat: 'arte', price: 3.00, oldPrice: 3.80, emoji: '🖍️', stock: 45, rating: 4.8, sold: 330, desc: 'Marcadores lavables punta gruesa.' },
  { id: 'p13', name: 'Pinturas de madera x12', cat: 'arte', price: 2.20, emoji: '🖍️', stock: 60, rating: 4.7, sold: 450, desc: 'Lápices de colores largos de alta pigmentación.' },
  { id: 'p14', name: 'Témperas x6', cat: 'arte', price: 2.75, emoji: '🎨', stock: 30, rating: 4.6, sold: 140, desc: 'Témperas escolares no tóxicas.' },
  { id: 'p15', name: 'Goma en barra 21 g', cat: 'arte', price: 0.80, emoji: '🧴', stock: 100, rating: 4.7, sold: 380, desc: 'Pegamento en barra lavable.' },
  { id: 'p16', name: 'Tijera escolar punta roma', cat: 'arte', price: 1.10, emoji: '✂️', stock: 55, rating: 4.6, sold: 210, desc: 'Segura para niños, mango ergonómico.' },
  { id: 'p17', name: 'Cartulina (pliego)', cat: 'arte', price: 0.40, emoji: '🟩', stock: 200, rating: 4.5, sold: 500, desc: 'Varios colores, tamaño pliego.' },
  { id: 'p18', name: 'Marcador de pizarra', cat: 'arte', price: 1.00, emoji: '🖊️', stock: 70, rating: 4.6, sold: 230, desc: 'Borrable en seco, negro/azul/rojo.' },

  { id: 'p19', name: 'Juego de geometría', cat: 'geometria', price: 2.50, emoji: '📐', stock: 40, rating: 4.7, sold: 190, desc: 'Regla 30 cm, escuadras y transportador.' },
  { id: 'p20', name: 'Compás metálico', cat: 'geometria', price: 2.80, emoji: '🧭', stock: 25, rating: 4.4, sold: 90, desc: 'Compás de precisión con mina de repuesto.' },
  { id: 'p21', name: 'Calculadora científica', cat: 'geometria', price: 14.99, oldPrice: 18.00, emoji: '🧮', stock: 10, rating: 4.9, sold: 60, desc: '240 funciones, ideal para bachillerato.' },
  { id: 'p22', name: 'Sacapuntas con depósito', cat: 'geometria', price: 0.60, emoji: '🔧', stock: 120, rating: 4.5, sold: 350, desc: 'Sacapuntas doble con contenedor.' },

  { id: 'p23', name: 'Carpeta plástica con vincha', cat: 'oficina', price: 0.75, emoji: '📁', stock: 90, rating: 4.5, sold: 260, desc: 'Tamaño A4, varios colores.' },
  { id: 'p24', name: 'Clips x100', cat: 'oficina', price: 0.70, emoji: '📎', stock: 40, rating: 4.4, sold: 70, desc: 'Clips metálicos #1.' },
  { id: 'p25', name: 'Cinta adhesiva transparente', cat: 'oficina', price: 0.60, emoji: '🎞️', stock: 80, rating: 4.5, sold: 160, desc: 'Cinta de 18 mm x 30 m.' },
  { id: 'p26', name: 'Grapadora mini + grapas', cat: 'oficina', price: 3.50, emoji: '📌', stock: 15, rating: 4.6, sold: 45, desc: 'Incluye 1000 grapas.' },

  { id: 'p27', name: 'Copia blanco y negro', cat: 'servicios', price: 0.05, emoji: '🖨️', stock: 9999, rating: 4.8, sold: 3000, desc: 'Por hoja. Envía tu archivo y retíralo en la tienda.' },
  { id: 'p28', name: 'Impresión a color', cat: 'servicios', price: 0.25, emoji: '🖨️', stock: 9999, rating: 4.7, sold: 900, desc: 'Por hoja A4 a color.' },
  { id: 'p29', name: 'Anillado', cat: 'servicios', price: 1.50, emoji: '📚', stock: 9999, rating: 4.6, sold: 200, desc: 'Anillado hasta 100 hojas.' },
  { id: 'p30', name: 'Plastificado A4', cat: 'servicios', price: 0.75, emoji: '🪪', stock: 9999, rating: 4.6, sold: 180, desc: 'Plastificado de documentos o carnés.' },

  { id: 'p31', name: 'Combo Inicial / Elemental', cat: 'combos', price: 9.90, oldPrice: 12.50, emoji: '🎒', stock: 20, rating: 4.9, sold: 75, desc: '4 cuadernos, pinturas x12, lápices x3, borrador, sacapuntas, goma y tijera.' },
  { id: 'p32', name: 'Combo Básica Superior', cat: 'combos', price: 14.50, oldPrice: 18.00, emoji: '🎒', stock: 20, rating: 4.8, sold: 60, desc: '6 cuadernos universitarios, plumas x4, juego de geometría, resaltadores y carpeta.' },
  { id: 'p33', name: 'Combo Bachillerato', cat: 'combos', price: 27.90, oldPrice: 34.00, emoji: '🎓', stock: 12, rating: 4.9, sold: 40, desc: 'Calculadora científica, 6 cuadernos, plumas x4, portaminas y resaltadores.' },
];
