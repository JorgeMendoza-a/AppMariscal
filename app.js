/* Mariscal Shop — tienda escolar con cuentas (estudiante / administrador) */
import { createBackend, errorText, DEMO_ADMIN } from './backend.js';

// ------------------------------------------------------------------
// Estado
// ------------------------------------------------------------------
const CATS = window.CATEGORIES;
const GRADES = ['Inicial 1', 'Inicial 2', '1ro EGB', '2do EGB', '3ro EGB', '4to EGB', '5to EGB', '6to EGB', '7mo EGB', '8vo EGB', '9no EGB', '10mo EGB', '1ro BGU', '2do BGU', '3ro BGU', 'Docente', 'Representante', 'Personal'];
const APK_URL = 'https://github.com/JorgeMendoza-a/AppMariscal/releases/download/apk/MariscalShop.apk';
const IN_APP = /MariscalShopApp/.test(navigator.userAgent);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const STATUSES = ['pendiente', 'preparando', 'listo', 'entregado'];
const STATUS_LABEL = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };

let api;
let user;              // undefined = cargando · null = sin sesión
let products = [];
let orders = [];
let users = [];
let config = { ...window.STORE_CONFIG };
let cart = [];
let favorites = [];
let unsubs = [];
let sortMode = 'popular';
let adminTab = 'pedidos';
let pendingModal = null;
let busy = false;

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => config.currencySymbol + Number(n || 0).toFixed(2);
const byId = id => products.find(p => p.id === id);
const catName = id => (CATS.find(c => c.id === id) || {}).name || id;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isAdmin = () => user?.role === 'admin';
const local = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } },
};
const cartKey = () => 'ms_cart_' + (user?.uid || 'x');
const saveCart = () => { local.set(cartKey(), cart); updateBadge(); };

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

const thumb = p => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.emoji || '📦');
const discount = p => p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

async function run(fn, okMsg) {
  if (busy) return;
  busy = true;
  document.body.classList.add('busy');
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { console.error(e); toast('⚠️ ' + errorText(e)); return false; }
  finally { busy = false; document.body.classList.remove('busy'); }
}

// ------------------------------------------------------------------
// Carrito
// ------------------------------------------------------------------
const cartLines = () => cart.map(l => ({ ...l, p: byId(l.id) })).filter(l => l.p);
const cartCount = () => cartLines().reduce((a, l) => a + l.qty, 0);
function cartTotals(delivery) {
  const lines = cartLines();
  const subtotal = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
  const savings = lines.reduce((a, l) => a + (l.p.oldPrice ? (l.p.oldPrice - l.p.price) * l.qty : 0), 0);
  const fee = delivery === 'aula' ? Number(config.deliveryFee || 0) : 0;
  return { subtotal, savings, fee, total: subtotal + fee };
}
function addToCart(id, qty = 1) {
  const p = byId(id);
  if (!p || p.stock <= 0) return toast('Producto agotado');
  const line = cart.find(l => l.id === id);
  if ((line ? line.qty : 0) + qty > p.stock) return toast(`Solo hay ${p.stock} disponibles`);
  if (line) line.qty += qty; else cart.push({ id, qty });
  saveCart();
  toast('✅ Agregado al carrito');
}
function setQty(id, qty) {
  const p = byId(id);
  const line = cart.find(l => l.id === id);
  if (!line) return;
  if (qty <= 0) cart = cart.filter(l => l.id !== id);
  else line.qty = Math.min(qty, p ? p.stock : qty);
  saveCart();
}
function updateBadge() {
  const n = cartCount();
  const b = $('#cartBadge');
  b.hidden = n === 0;
  b.textContent = n > 99 ? '99+' : n;
}

// ------------------------------------------------------------------
// Componentes
// ------------------------------------------------------------------
function productCard(p) {
  const d = discount(p);
  const out = p.stock <= 0;
  return `
    <article class="product">
      ${d ? `<span class="badge">-${d}%</span>` : ''}
      ${p.sold > 400 ? `<span class="badge gold">🔥 Top</span>` : ''}
      <button class="thumb" data-open="${esc(p.id)}" aria-label="Ver ${esc(p.name)}">${thumb(p)}</button>
      <div class="info">
        <div class="name">${esc(p.name)}</div>
        <div class="price">${money(p.price)}${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ''}</div>
        <div class="meta"><span class="star">★</span> ${Number(p.rating || 0).toFixed(1)} · ${p.sold || 0} vendidos</div>
        <button class="add-btn" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'Agotado' : '+ Agregar'}</button>
      </div>
    </article>`;
}
const grid = list => list.length
  ? `<div class="grid">${list.map(productCard).join('')}</div>`
  : `<div class="empty"><div class="big">🔎</div><p class="muted">No hay productos para mostrar.</p></div>`;

const catStrip = active => `<div class="cats">${CATS.map(c => `
  <a class="cat ${c.id === active ? 'active' : ''}" href="#/categoria/${c.id}"><span class="ico">${c.icon}</span>${esc(c.name)}</a>`).join('')}</div>`;

const footer = () => `<footer class="foot"><b>${esc(config.name)}</b> · ${esc(config.school)}<br><em>${esc(config.slogan)}</em></footer>`;

const gradeOptions = sel => ['', ...GRADES].map(g => `<option value="${g}" ${sel === g ? 'selected' : ''}>${g || 'Selecciona…'}</option>`).join('');

// ------------------------------------------------------------------
// Pantallas de acceso
// ------------------------------------------------------------------
function authShell(inner) {
  return `
    <div class="auth-wrap">
      <div class="auth-brand">
        <img src="assets/icon.svg" alt="" width="84" height="84">
        <h1>${esc(config.name)}</h1>
        <p>${esc(config.school)}</p>
      </div>
      <div class="card auth-card">${inner}</div>
      ${api.mode === 'demo' ? `
        <div class="notice demo-note">
          🧪 <b>Modo demo</b> (sin Firebase): las cuentas se guardan solo en este dispositivo.<br>
          Administrador de prueba: <code>${DEMO_ADMIN.email}</code> / <code>${DEMO_ADMIN.password}</code>
        </div>` : ''}
      ${IS_ANDROID && !IN_APP ? `<a class="btn apk-btn block" href="${APK_URL}">📲 Descargar app para Android</a>` : ''}
      <p class="foot"><em>${esc(config.slogan)}</em></p>
    </div>`;
}

function viewLogin() {
  return authShell(`
    <h2>Iniciar sesión</h2>
    <form id="loginForm" class="form" novalidate>
      <div class="field"><label for="l-email">Correo</label>
        <input id="l-email" name="email" type="email" autocomplete="email" required placeholder="tucorreo@gmail.com"></div>
      <div class="field"><label for="l-pass">Contraseña</label>
        <input id="l-pass" name="password" type="password" autocomplete="current-password" required placeholder="••••••"></div>
      <button class="btn gold block">Entrar</button>
    </form>
    <p class="auth-links">
      <a href="#/recuperar">¿Olvidaste tu contraseña?</a><br>
      ¿No tienes cuenta? <a href="#/registro"><b>Crear cuenta</b></a>
    </p>`);
}

function viewRegister() {
  return authShell(`
    <h2>Crear cuenta</h2>
    <form id="registerForm" class="form" novalidate>
      <div class="field"><label for="r-name">Nombre completo *</label>
        <input id="r-name" name="name" required maxlength="60" autocomplete="name" placeholder="Ej. María Pérez"></div>
      <div class="row-2">
        <div class="field"><label for="r-grade">Curso *</label><select id="r-grade" name="grade" required>${gradeOptions('')}</select></div>
        <div class="field"><label for="r-par">Paralelo</label><input id="r-par" name="parallel" maxlength="3" placeholder="A"></div>
      </div>
      <div class="field"><label for="r-phone">Celular (WhatsApp) *</label>
        <input id="r-phone" name="phone" type="tel" inputmode="tel" required maxlength="15" placeholder="09XXXXXXXX"></div>
      <div class="field"><label for="r-email">Correo *</label>
        <input id="r-email" name="email" type="email" autocomplete="email" required></div>
      <div class="row-2">
        <div class="field"><label for="r-pass">Contraseña *</label>
          <input id="r-pass" name="password" type="password" autocomplete="new-password" required minlength="6" placeholder="Mín. 6"></div>
        <div class="field"><label for="r-pass2">Repetir *</label>
          <input id="r-pass2" name="password2" type="password" autocomplete="new-password" required></div>
      </div>
      <button class="btn gold block">Crear mi cuenta</button>
    </form>
    <p class="auth-links">¿Ya tienes cuenta? <a href="#/login"><b>Inicia sesión</b></a></p>`);
}

function viewRecover() {
  return authShell(`
    <h2>Recuperar contraseña</h2>
    <p class="muted" style="font-size:.85rem">Te enviaremos un enlace a tu correo para crear una nueva contraseña.</p>
    <form id="recoverForm" class="form" novalidate>
      <div class="field"><label for="rc-email">Correo</label><input id="rc-email" name="email" type="email" required></div>
      <button class="btn block">Enviar enlace</button>
    </form>
    <p class="auth-links"><a href="#/login">← Volver a iniciar sesión</a></p>`);
}

// ------------------------------------------------------------------
// Tienda
// ------------------------------------------------------------------
function viewHome() {
  const offers = products.filter(p => discount(p)).sort((a, b) => discount(b) - discount(a));
  const best = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 10);
  const combos = products.filter(p => p.cat === 'combos');
  return `
    <section class="hero">
      <span class="tag">AÑO LECTIVO 2026 – 2027</span>
      <h1>¡Hola, ${esc((user.name || '').split(' ')[0])}! 👋<br>Todo para tus clases, sin salir del colegio</h1>
      <p>Pide desde tu celular y retira en el multiservicios o recíbelo en tu aula.</p>
      <a href="#/categoria/combos" class="btn gold">🎒 Ver combos escolares</a>
      <span class="hero-emoji" aria-hidden="true">📚</span>
    </section>
    <div class="perks">
      <div class="perk"><span>⚡</span>Pedido rápido</div>
      <div class="perk"><span>🏫</span>Entrega en aula</div>
      <div class="perk"><span>💵</span>Paga al retirar</div>
    </div>
    ${!products.length ? `<div class="notice" style="margin-top:16px">🛠️ La tienda aún no tiene productos. ${isAdmin() ? 'Entra a <a href="#/admin"><b>Administración → Productos</b></a> y carga el catálogo.' : 'Vuelve pronto.'}</div>` : ''}
    <h2 class="section">Categorías <a href="#/categorias">Ver todas</a></h2>
    ${catStrip()}
    ${offers.length ? `<h2 class="section">🔥 Ofertas del día <a href="#/ofertas">Ver más</a></h2>${grid(offers.slice(0, 10))}` : ''}
    ${combos.length ? `<h2 class="section">🎒 Combos por nivel</h2>${grid(combos)}` : ''}
    ${best.length ? `<h2 class="section">⭐ Lo más vendido</h2>${grid(best)}` : ''}
    ${footer()}`;
}

function viewCategories() {
  return `<h2 class="section">Categorías</h2>
    <div class="cat-grid">${CATS.map(c => `
      <a class="cat-tile" href="#/categoria/${c.id}"><span class="ico">${c.icon}</span>
        <div>${esc(c.name)}<small>${products.filter(p => p.cat === c.id).length} productos</small></div></a>`).join('')}
    </div>${footer()}`;
}

function sortList(list) {
  const l = [...list];
  if (sortMode === 'low') l.sort((a, b) => a.price - b.price);
  else if (sortMode === 'high') l.sort((a, b) => b.price - a.price);
  else if (sortMode === 'rating') l.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else l.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  return l;
}
const toolbar = count => `<div class="toolbar"><span class="muted">${count} producto${count === 1 ? '' : 's'}</span>
  <select id="sortSel" aria-label="Ordenar">
    ${[['popular', 'Más vendidos'], ['low', 'Precio: menor a mayor'], ['high', 'Precio: mayor a menor'], ['rating', 'Mejor calificados']]
      .map(([v, t]) => `<option value="${v}" ${sortMode === v ? 'selected' : ''}>${t}</option>`).join('')}
  </select></div>`;

function viewCategory(id) {
  const c = CATS.find(x => x.id === id);
  if (!c) return viewNotFound();
  const list = sortList(products.filter(p => p.cat === id));
  return `${catStrip(id)}<h2 class="section">${c.icon} ${esc(c.name)}</h2>${toolbar(list.length)}${grid(list)}`;
}
function viewOffers() {
  const list = sortList(products.filter(p => discount(p)));
  return `<h2 class="section">🔥 Ofertas</h2>${toolbar(list.length)}${grid(list)}`;
}
function viewFavorites() {
  const list = products.filter(p => favorites.includes(p.id));
  return `<h2 class="section">💚 Mis favoritos</h2>${grid(list)}`;
}
function viewSearch(q) {
  const nq = norm(q);
  const list = sortList(products.filter(p => norm(p.name + ' ' + p.desc + ' ' + catName(p.cat)).includes(nq)));
  return `<h2 class="section">Resultados para “${esc(q)}”</h2>${toolbar(list.length)}${grid(list)}`;
}

function viewCart() {
  const lines = cartLines();
  if (!lines.length) {
    return `<div class="empty"><div class="big">🛒</div><h3>Tu carrito está vacío</h3>
      <p class="muted">Agrega plumas, cuadernos, marcadores y más.</p><a href="#/" class="btn">Ir a comprar</a></div>`;
  }
  const t = cartTotals();
  const missing = config.freeGiftOver - t.subtotal;
  return `
    <h2 class="section">Mi carrito (${cartCount()})</h2>
    <div class="layout-2">
      <div class="card">${lines.map(l => `
        <div class="cart-item">
          <div class="thumb-sm">${thumb(l.p)}</div>
          <div><div class="t">${esc(l.p.name)}</div><div class="price">${money(l.p.price)}</div>
            <button class="link-btn" data-remove="${esc(l.id)}">Eliminar</button></div>
          <div class="right">
            <div class="qty"><button data-dec="${esc(l.id)}" aria-label="Menos">−</button><span>${l.qty}</span><button data-inc="${esc(l.id)}" aria-label="Más">+</button></div>
            <b>${money(l.qty * l.p.price)}</b>
          </div>
        </div>`).join('')}
      </div>
      <div class="card sticky">
        ${config.freeGiftOver > 0 ? (missing > 0
          ? `<div class="notice">🎁 Te faltan <b>${money(missing)}</b> para llevarte un regalo sorpresa.</div>`
          : `<div class="notice">🎁 ¡Genial! Tu pedido incluye un <b>regalo sorpresa</b>.</div>`) : ''}
        <div class="summary">
          <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
          ${t.savings > 0 ? `<div class="row save"><span>Ahorras</span><span>-${money(t.savings)}</span></div>` : ''}
          <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
        </div>
        <a href="#/checkout" class="btn gold block" style="margin-top:14px">Continuar con el pedido →</a>
        <a href="#/" class="btn ghost block" style="margin-top:8px">Seguir comprando</a>
      </div>
    </div>`;
}

function viewCheckout() {
  if (!cartLines().length) return viewCart();
  const delivery = local.get('ms_delivery', 'retiro');
  const t = cartTotals(delivery);
  const fee = Number(config.deliveryFee || 0);
  return `
    <h2 class="section">Finalizar pedido</h2>
    <div class="layout-2">
      <form class="card form" id="checkoutForm" novalidate>
        <div class="who">
          <div class="avatar">${esc((user.name || '?')[0].toUpperCase())}</div>
          <div><b>${esc(user.name)}</b><div class="muted">${esc(user.grade)} ${esc(user.parallel || '')} · 📱 ${esc(user.phone)}</div></div>
          <a href="#/cuenta" class="small-link">Editar</a>
        </div>
        <div class="field"><label>¿Cómo lo recibes?</label>
          <div class="options">
            <label class="option"><input type="radio" name="delivery" value="retiro" ${delivery !== 'aula' ? 'checked' : ''}>
              <div>🏪 Retiro en el multiservicios<small>Gratis · te avisamos cuando esté listo</small></div></label>
            <label class="option"><input type="radio" name="delivery" value="aula" ${delivery === 'aula' ? 'checked' : ''}>
              <div>🏫 Entrega en mi aula<small>${fee ? money(fee) : 'Gratis'} · en el recreo</small></div></label>
          </div></div>
        <div class="field"><label>Forma de pago</label>
          <div class="options">
            <label class="option"><input type="radio" name="pay" value="Efectivo" checked><div>💵 Efectivo al recibir</div></label>
            <label class="option"><input type="radio" name="pay" value="Transferencia"><div>🏦 Transferencia / DeUna<small>Envía el comprobante por WhatsApp</small></div></label>
          </div></div>
        <div class="field"><label for="f-notes">Notas (opcional)</label>
          <textarea id="f-notes" name="notes" rows="2" maxlength="200" placeholder="Ej. color de cuaderno, archivo para imprimir…"></textarea></div>
        <button class="btn gold block" type="submit">✅ Confirmar pedido</button>
      </form>
      <div class="card sticky">
        <h3 style="margin-top:0">Resumen</h3>
        <div class="summary">
          ${cartLines().map(l => `<div class="row"><span>${l.qty} × ${esc(l.p.name)}</span><span>${money(l.qty * l.p.price)}</span></div>`).join('')}
          <div class="row" style="margin-top:6px"><span>Entrega</span><span id="feeLbl">${t.fee ? money(t.fee) : 'Gratis'}</span></div>
          <div class="row total"><span>Total</span><span id="totalLbl">${money(t.total)}</span></div>
        </div>
      </div>
    </div>`;
}

function orderCard(o, admin = false) {
  const idx = STATUSES.indexOf(o.status);
  const c = o.customer || {};
  return `
    <div class="card order ${admin && o.status === 'pendiente' ? 'is-new' : ''}">
      <div class="order-head">
        <div><b>Pedido #${esc(o.code)}</b><div class="muted" style="font-size:.75rem">${new Date(o.date).toLocaleString('es-EC')}</div></div>
        <span class="status ${esc(o.status)}">${STATUS_LABEL[o.status] || esc(o.status)}</span>
      </div>
      ${o.status !== 'cancelado' ? `<div class="steps">${STATUSES.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)} — ${money(i.qty * i.price)}</li>`).join('')}</ul>
      <div class="muted" style="font-size:.78rem">
        ${admin ? `👤 <b>${esc(c.name)}</b> · ${esc(c.grade)} ${esc(c.parallel || '')} · 📱 ${esc(c.phone)}<br>` : ''}
        ${o.delivery === 'aula' ? '🏫 Entrega en aula' : '🏪 Retiro en tienda'} · ${esc(o.pay)}
        ${o.notes ? `<br>📝 ${esc(o.notes)}` : ''}
      </div>
      <div class="order-head" style="margin-top:10px">
        <b class="price">${money(o.total)}</b>
        <div class="small-btns">
          ${admin ? `
            ${c.phone ? `<button data-wacust="${esc(o.id)}" title="Escribir al cliente">💬</button>` : ''}
            <select data-status="${esc(o.id)}" aria-label="Cambiar estado">
              ${[...STATUSES, 'cancelado'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
            </select>` : `
            ${o.status === 'pendiente' ? `<button class="del" data-cancel="${esc(o.id)}">Cancelar</button>` : ''}
            <button data-reorder="${esc(o.id)}">🔁 Volver a pedir</button>
            <button data-wa="${esc(o.id)}" title="Enviar por WhatsApp">💬</button>`}
        </div>
      </div>
    </div>`;
}

function viewOrders() {
  if (!orders.length) {
    return `<div class="empty"><div class="big">📦</div><h3>Aún no tienes pedidos</h3>
      <p class="muted">Tus pedidos aparecerán aquí y verás cuando estén listos.</p><a href="#/" class="btn">Empezar a comprar</a></div>`;
  }
  const mine = isAdmin() ? orders.filter(o => o.uid === user.uid) : orders;
  const hasOpen = mine.some(o => ['pendiente', 'preparando'].includes(o.status));
  return `<h2 class="section">Mis pedidos</h2>
    ${hasOpen ? notifNotice('cuando tu pedido esté listo') : ''}
    ${isAdmin() ? `<div class="notice">Eres administrador: los pedidos de todos los clientes están en <a href="#/admin"><b>Administración</b></a>.</div>` : ''}
    ${mine.length ? mine.map(o => orderCard(o)).join('') : '<p class="muted">No has hecho pedidos con esta cuenta.</p>'}`;
}

function viewAccount() {
  return `
    <h2 class="section">Mi cuenta</h2>
    <div class="card">
      <div class="who">
        <div class="avatar big">${esc((user.name || '?')[0].toUpperCase())}</div>
        <div><b>${esc(user.name)}</b><div class="muted">${esc(user.email)}</div>
          <span class="role ${isAdmin() ? 'admin' : ''}">${isAdmin() ? '⭐ Administrador' : '🎓 Cliente'}</span></div>
      </div>
      <form id="profileForm" class="form" style="margin-top:14px" novalidate>
        <div class="field"><label for="a-name">Nombre</label><input id="a-name" name="name" required maxlength="60" value="${esc(user.name)}"></div>
        <div class="row-2">
          <div class="field"><label for="a-grade">Curso</label><select id="a-grade" name="grade">${gradeOptions(user.grade)}</select></div>
          <div class="field"><label for="a-par">Paralelo</label><input id="a-par" name="parallel" maxlength="3" value="${esc(user.parallel)}"></div>
        </div>
        <div class="field"><label for="a-phone">Celular</label><input id="a-phone" name="phone" type="tel" maxlength="15" value="${esc(user.phone)}"></div>
        <button class="btn">Guardar cambios</button>
      </form>
    </div>
    <div class="card" style="margin-top:12px;display:grid;gap:8px">
      ${notifSupported() ? (notifGranted()
        ? `<div class="notice" style="margin:0">🔔 Notificaciones activadas</div>`
        : `<button class="btn ghost block" data-asknotif>🔔 Activar notificaciones</button>`) : ''}
      <a href="#/favoritos" class="btn ghost block">💚 Mis favoritos</a>
      ${!IN_APP ? `<a href="${APK_URL}" class="btn ghost block">📲 Descargar app para Android</a>
        <p class="muted" style="font-size:.72rem;margin:0;text-align:center">Comparte este enlace con estudiantes y padres:<br><code style="word-break:break-all">${APK_URL}</code></p>` : ''}
      ${isAdmin() ? `<a href="#/admin" class="btn ghost block">⚙️ Administración</a>` : ''}
      <button class="btn danger block" data-logout>Cerrar sesión</button>
    </div>
    ${footer()}`;
}

const viewNotFound = () => `<div class="empty"><div class="big">🧭</div><h3>Página no encontrada</h3><a href="#/" class="btn">Volver al inicio</a></div>`;
const viewDenied = () => `<div class="empty"><div class="big">🔒</div><h3>Solo para administradores</h3>
  <p class="muted">Tu cuenta es de cliente. Puedes ver productos y hacer pedidos.</p><a href="#/" class="btn">Ir a la tienda</a></div>`;

// ------------------------------------------------------------------
// Administración
// ------------------------------------------------------------------
function viewAdmin() {
  if (!isAdmin()) return viewDenied();
  const active = orders.filter(o => o.status !== 'cancelado');
  const today = new Date().toDateString();
  const todaySales = active.filter(o => new Date(o.date).toDateString() === today).reduce((a, o) => a + o.total, 0);
  const pending = orders.filter(o => o.status === 'pendiente' || o.status === 'preparando').length;
  const low = products.filter(p => p.stock < 10);
  let body = '';

  if (adminTab === 'pedidos') {
    const open = orders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status));
    const closed = orders.filter(o => !['pendiente', 'preparando', 'listo'].includes(o.status));
    body = !orders.length ? `<p class="muted">Todavía no hay pedidos.</p>` : `
      <h3 class="sub">En curso (${open.length})</h3>
      ${open.length ? open.map(o => orderCard(o, true)).join('') : '<p class="muted">¡Todo al día! 🎉</p>'}
      ${closed.length ? `<details><summary class="sub">Historial (${closed.length})</summary>${closed.map(o => orderCard(o, true)).join('')}</details>` : ''}`;
  } else if (adminTab === 'productos') {
    body = `
      <div class="toolbar"><span class="muted">${products.length} productos${low.length ? ` · <b class="low">${low.length} con stock bajo</b>` : ''}</span>
        <div class="small-btns">
          ${!products.length ? `<button data-seed>📥 Cargar catálogo inicial</button>` : ''}
          <button class="btn" data-newprod style="padding:8px 14px">+ Nuevo</button>
        </div></div>
      <div class="admin-list">
        ${[...products].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)).map(p => `
          <div class="admin-row">
            <div class="e">${p.img ? `<img src="${esc(p.img)}" alt="">` : esc(p.emoji)}</div>
            <div><div class="t">${esc(p.name)}</div>
              <div class="s">${money(p.price)} · ${esc(catName(p.cat))} · <span class="${p.stock < 10 ? 'low' : ''}">Stock: ${p.stock}</span></div></div>
            <div class="small-btns">
              <button data-edit="${esc(p.id)}">Editar</button>
              <button class="del" data-del="${esc(p.id)}" aria-label="Eliminar">🗑</button>
            </div>
          </div>`).join('')}
      </div>`;
  } else if (adminTab === 'usuarios') {
    const sorted = [...users].sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1) || String(a.name).localeCompare(b.name));
    body = `
      <p class="muted" style="font-size:.82rem">Los nuevos registros entran como <b>cliente</b>. Aquí puedes dar o quitar permisos de administrador.</p>
      <div class="admin-list">${sorted.map(u => `
        <div class="admin-row">
          <div class="avatar">${esc((u.name || '?')[0].toUpperCase())}</div>
          <div><div class="t">${esc(u.name)} ${u.role === 'admin' ? '<span class="role admin">Admin</span>' : ''}</div>
            <div class="s">${esc(u.email)} · ${esc(u.grade)} ${esc(u.parallel || '')}</div></div>
          <div class="small-btns">${u.uid === user.uid ? '<span class="s">(tú)</span>' : u.role === 'admin'
            ? `<button class="del" data-role="${esc(u.uid)}" data-to="student">Quitar admin</button>`
            : `<button data-role="${esc(u.uid)}" data-to="admin">Hacer admin</button>`}</div>
        </div>`).join('')}</div>`;
  } else {
    body = `
      <form class="card form" id="settingsForm">
        <div class="field"><label for="s-name">Nombre del negocio</label><input id="s-name" name="name" value="${esc(config.name)}" maxlength="40"></div>
        <div class="field"><label for="s-wa">WhatsApp del negocio (con código de país, sin +)</label><input id="s-wa" name="whatsapp" value="${esc(config.whatsapp)}" inputmode="numeric" maxlength="15"></div>
        <div class="row-2">
          <div class="field"><label for="s-fee">Costo entrega en aula ($)</label><input id="s-fee" name="deliveryFee" type="number" step="0.05" min="0" value="${esc(config.deliveryFee)}"></div>
          <div class="field"><label for="s-gift">Regalo desde ($, 0 = no)</label><input id="s-gift" name="freeGiftOver" type="number" step="0.5" min="0" value="${esc(config.freeGiftOver)}"></div>
        </div>
        <button class="btn">Guardar ajustes</button>
      </form>`;
  }
  return `
    <h2 class="section">⚙️ Administración</h2>
    ${notifNotice('de cada pedido nuevo')}
    <div class="stats">
      <div class="stat"><b>${pending}</b><small>Por atender</small></div>
      <div class="stat"><b>${money(todaySales)}</b><small>Ventas de hoy</small></div>
      <div class="stat"><b>${active.length}</b><small>Pedidos totales</small></div>
      <div class="stat"><b>${low.length}</b><small>Stock bajo</small></div>
    </div>
    <div class="tabs">${[['pedidos', '📦', 'Pedidos'], ['productos', '🏷️', 'Productos'], ['usuarios', '👥', 'Usuarios'], ['ajustes', '🔧', 'Ajustes']]
      .map(([t, i, l]) => `<button data-tab="${t}" class="${adminTab === t ? 'active' : ''}"><span>${i}${t === 'pedidos' && pending ? `<b class="pill">${pending}</b>` : ''}</span>${l}</button>`).join('')}</div>
    ${body}`;
}

function productForm(p) {
  const isNew = !p;
  p = p || { name: '', cat: CATS[0].id, price: '', oldPrice: '', emoji: '📦', stock: 10, desc: '', img: '' };
  openModal(`
    <h3 style="margin-top:0">${isNew ? 'Nuevo producto' : 'Editar producto'}</h3>
    <form class="form" id="prodForm">
      <div class="field"><label for="p-name">Nombre *</label><input id="p-name" name="name" required maxlength="60" value="${esc(p.name)}"></div>
      <div class="row-2">
        <div class="field"><label for="p-cat">Categoría</label><select id="p-cat" name="cat">
          ${CATS.map(c => `<option value="${c.id}" ${c.id === p.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-emoji">Emoji</label><input id="p-emoji" name="emoji" maxlength="4" value="${esc(p.emoji)}"></div>
      </div>
      <div class="row-2">
        <div class="field"><label for="p-price">Precio *</label><input id="p-price" name="price" type="number" step="0.01" min="0" required value="${esc(p.price)}"></div>
        <div class="field"><label for="p-old">Precio antes (oferta)</label><input id="p-old" name="oldPrice" type="number" step="0.01" min="0" value="${esc(p.oldPrice || '')}"></div>
      </div>
      <div class="field"><label for="p-stock">Stock</label><input id="p-stock" name="stock" type="number" min="0" step="1" value="${esc(p.stock)}"></div>
      <div class="field"><label for="p-desc">Descripción</label><textarea id="p-desc" name="desc" rows="2" maxlength="200">${esc(p.desc)}</textarea></div>
      <div class="field"><label for="p-img">Foto (opcional)</label><input id="p-img" type="file" accept="image/*">
        ${p.img ? `<label class="option" style="margin-top:6px"><input type="checkbox" name="removeImg"> Quitar foto actual</label>` : ''}</div>
      <button class="btn gold">${isNew ? 'Crear producto' : 'Guardar cambios'}</button>
    </form>`);

  $('#prodForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name')).trim();
    const price = parseFloat(f.get('price'));
    if (!name || !(price >= 0)) return toast('Completa nombre y precio');
    const file = $('#p-img').files[0];
    let img = f.get('removeImg') ? '' : (p.img || '');
    if (file) img = await resizeImage(file, 400);
    const data = {
      ...(isNew ? { rating: 5, sold: 0 } : { id: p.id, rating: p.rating ?? 5, sold: p.sold ?? 0 }),
      name, price,
      cat: f.get('cat'),
      emoji: String(f.get('emoji') || '📦').trim() || '📦',
      oldPrice: parseFloat(f.get('oldPrice')) || null,
      stock: Math.max(0, parseInt(f.get('stock'), 10) || 0),
      desc: String(f.get('desc') || '').trim(),
      img,
    };
    if (await run(() => api.saveProduct(data), 'Producto guardado')) closeModal();
  });
}

function resizeImage(file, max) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve('');
      img.src = reader.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------------------------------
// Avisos: notificación del sistema, sonido, vibración y ventana
// ------------------------------------------------------------------
const bridge = window.AndroidBridge; // existe solo dentro de la app Android
const notifiedNow = new Set();
const readySeenKey = () => 'ms_ready_seen_' + user.uid;
const notifSupported = () => !!bridge || ('Notification' in window && 'serviceWorker' in navigator);
function notifGranted() {
  try { return bridge ? bridge.hasPermission() : ('Notification' in window && Notification.permission === 'granted'); }
  catch { return false; }
}
async function askNotifications() {
  try {
    if (bridge) { if (!bridge.hasPermission()) bridge.requestPermission(); return; }
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
      render();
    }
  } catch { /* sin soporte */ }
}
window.onNotifPermission = () => render(); // la app Android avisa cuando el usuario responde

async function systemNotify(title, body, tag) {
  try {
    if (bridge) return bridge.notifyUser(title, body);
    if (!notifGranted()) return;
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const opts = { body, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag, renotify: true, vibrate: [300, 100, 300], data: { url: location.href.split('#')[0] + '#/pedidos' } };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch { /* sin soporte */ }
}
function alertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i ? 1175 : 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* sin audio */ }
  try { navigator.vibrate?.([300, 100, 300]); } catch { /* sin vibración */ }
}

const readyText = o => o.delivery === 'aula'
  ? `Tu pedido #${o.code} está listo. En el recreo lo llevamos a tu aula.`
  : `Tu pedido #${o.code} está listo. Acércate al multiservicios a retirarlo.`;

function toIntlPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) return '593' + d.slice(1);
  if (d.length === 9 && d.startsWith('9')) return '593' + d;
  return d;
}
function readyWhatsApp(o) {
  return [
    `Hola ${o.customer.name} 👋`,
    `✅ ${readyText(o)}`,
    ...(o.pay === 'Efectivo' ? [`💵 Total a pagar: ${money(o.total)}`] : []),
    `— ${config.name}`,
  ].join('\n');
}

// Muestra el aviso de "pedido listo" hasta que el cliente toque "Entendido".
// live = true cuando el cambio acaba de ocurrir (suena y llega notificación).
function checkReady(live) {
  if (!user) return;
  const seen = local.get(readySeenKey(), []);
  const ready = orders.filter(o => o.uid === user.uid && o.status === 'listo' && !seen.includes(o.id));
  if (!ready.length) return;
  const o = ready[0];
  if (live && !notifiedNow.has(o.id)) {
    notifiedNow.add(o.id);
    systemNotify('✅ ¡Tu pedido está listo!', readyText(o), 'ready-' + o.id);
    alertSound();
  }
  if (!$('#modal').hidden) return;
  openModal(`
    <div class="ready-modal">
      <div class="ready-icon">🛍️</div>
      <h3>¡Tu pedido está listo!</h3>
      <p>${esc(readyText(o))}</p>
      <div class="ready-items">${o.items.map(i => `${i.qty} × ${esc(i.name)}`).join('<br>')}</div>
      ${o.pay === 'Efectivo' ? `<p>Total a pagar: <b class="price">${money(o.total)}</b></p>` : ''}
      <button class="btn gold block" data-readyok="${esc(o.id)}">👍 Entendido, voy por él</button>
    </div>`);
}

function notifNotice(text) {
  if (!notifSupported() || notifGranted()) return '';
  if (!bridge && Notification.permission === 'denied') {
    return `<div class="notice">🔕 Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador para enterarte ${text}.</div>`;
  }
  return `<div class="notice notif-notice">🔔 Activa las notificaciones para enterarte ${text}. <button class="btn" data-asknotif>Activar</button></div>`;
}

// El stock se descuenta cuando el administrador acepta el pedido
// (pasa de "pendiente" a otro estado) y se devuelve si luego se cancela.
async function changeStatus(o, status) {
  const wasApplied = !!o.stockApplied;
  const shouldApply = status !== 'cancelado' && status !== 'pendiente';
  const ok = await run(async () => {
    if (shouldApply && !wasApplied) await api.adjustStock(o.items, +1);
    if (!shouldApply && wasApplied) await api.adjustStock(o.items, -1);
    await api.updateOrder(o.id, { status, stockApplied: shouldApply });
  }, 'Estado actualizado');
  if (ok && status === 'listo' && o.customer?.phone) {
    openModal(`
      <div class="ready-modal">
        <div class="ready-icon">✅</div>
        <h3>Pedido #${esc(o.code)} listo</h3>
        <p class="muted">${esc(o.customer.name)} recibirá un aviso en la app. ¿Le escribes también por WhatsApp?
          (le llega aunque tenga la app cerrada)</p>
        <button class="btn gold block" data-waready="${esc(o.id)}">💬 Avisar por WhatsApp</button>
        <button class="btn ghost block" data-close style="margin-top:8px">Ahora no</button>
      </div>`);
  }
}

// ------------------------------------------------------------------
// Modal / detalle de producto
// ------------------------------------------------------------------
function openModal(html) {
  $('#modalContent').innerHTML = `<button class="modal-close" data-close aria-label="Cerrar">✕</button>${html}`;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modal').hidden = true;
  document.body.style.overflow = '';
}

function openProduct(id) {
  const p = byId(id);
  if (!p) return;
  let qty = 1;
  const related = products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  openModal(`
    <div class="detail">
      <div class="detail-thumb">${thumb(p)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="meta"><span class="star">★★★★★</span> ${Number(p.rating || 0).toFixed(1)} · ${p.sold || 0} vendidos · ${esc(catName(p.cat))}</div>
      <div class="price" style="margin-top:8px">${money(p.price)}${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ''}
        ${discount(p) ? `<span class="badge" style="position:static;margin-left:6px">-${discount(p)}%</span>` : ''}</div>
      <p class="muted" style="font-size:.9rem">${esc(p.desc)}</p>
      <p style="font-size:.8rem">${p.stock > 0 ? (p.stock < 10 ? `⚠️ ¡Solo quedan ${p.stock}!` : '✅ Disponible') : '❌ Agotado'}</p>
      <div class="detail-actions">
        <div class="qty"><button data-q="-1" aria-label="Menos">−</button><span id="dq">1</span><button data-q="1" aria-label="Más">+</button></div>
        <button class="btn gold" id="dAdd" ${p.stock <= 0 ? 'disabled' : ''}>Agregar al carrito</button>
        <button class="btn ghost" id="dFav" aria-label="Favorito" style="flex:0 0 auto">${favorites.includes(id) ? '💚' : '🤍'}</button>
      </div>
      ${isAdmin() ? `<button class="btn ghost block" data-edit="${esc(p.id)}" style="margin-top:8px">✏️ Editar producto</button>` : ''}
      ${related.length ? `<h2 class="section">También te puede servir</h2><div class="grid">${related.map(productCard).join('')}</div>` : ''}
    </div>`);
  $('#modalContent').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    qty = Math.max(1, Math.min(p.stock || 1, qty + Number(b.dataset.q)));
    $('#dq').textContent = qty;
  }));
  $('#dAdd').addEventListener('click', () => { addToCart(p.id, qty); closeModal(); });
  $('#dFav').addEventListener('click', e => {
    favorites = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    local.set('ms_favs_' + user.uid, favorites);
    e.currentTarget.textContent = favorites.includes(id) ? '💚' : '🤍';
  });
}

// ------------------------------------------------------------------
// Pedido
// ------------------------------------------------------------------
function whatsappText(o) {
  const c = o.customer;
  return [
    `🛒 *Pedido #${o.code}* — ${config.name}`, '',
    ...o.items.map(i => `• ${i.qty} x ${i.name} = ${money(i.qty * i.price)}`), '',
    `*Total: ${money(o.total)}*`,
    `👤 ${c.name} (${c.grade} ${c.parallel || ''})`.trim(),
    `📱 ${c.phone}`,
    `🚚 ${o.delivery === 'aula' ? 'Entrega en aula' : 'Retiro en multiservicios'}`,
    `💳 ${o.pay}`,
    ...(o.notes ? [`📝 ${o.notes}`] : []),
  ].join('\n');
}
const openWhatsApp = (phone, text) => window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

async function submitCheckout(form) {
  askNotifications(); // se pide durante el toque del usuario
  const f = new FormData(form);
  if (!user.phone || !user.grade) { toast('Completa tu curso y celular en Mi cuenta'); location.hash = '#/cuenta'; return; }
  for (const l of cartLines()) if (l.qty > l.p.stock) return toast(`Stock insuficiente: ${l.p.name}`);
  const delivery = f.get('delivery');
  local.set('ms_delivery', delivery);
  const order = {
    code: 'MA' + Date.now().toString().slice(-6),
    uid: user.uid,
    date: new Date().toISOString(),
    items: cartLines().map(l => ({ id: l.id, name: l.p.name, qty: l.qty, price: l.p.price })),
    total: cartTotals(delivery).total,
    delivery,
    pay: f.get('pay'),
    notes: String(f.get('notes') || '').trim(),
    customer: { name: user.name, grade: user.grade, parallel: user.parallel || '', phone: user.phone, email: user.email },
    status: 'pendiente',
    stockApplied: false,
  };
  const ok = await run(() => api.createOrder(order));
  if (!ok) return;
  cart = [];
  saveCart();
  pendingModal = `
    <div style="text-align:center">
      <div style="font-size:4rem">🎉</div>
      <h3>¡Pedido #${esc(order.code)} enviado!</h3>
      <p class="muted">El multiservicios ya lo puede ver. <b>Te avisaremos cuando esté listo</b> para que lo retires.</p>
      <button class="btn gold block" data-watext="${encodeURIComponent(whatsappText(order))}">💬 Avisar también por WhatsApp</button>
      <button class="btn ghost block" data-close style="margin-top:8px">Listo</button>
    </div>`;
  if (location.hash === '#/pedidos') { render(); openModal(pendingModal); pendingModal = null; }
  else location.hash = '#/pedidos';
}

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = hash.split('/');
  return { name, arg: decodeURIComponent(rest.join('/')) };
}

function snapshotForm() {
  const vals = {};
  app.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
    if (el.type !== 'file') vals[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
  });
  app.querySelectorAll('input[type=radio]:checked').forEach(el => { vals['radio:' + el.name] = el.value; });
  return vals;
}
function restoreForm(vals) {
  Object.entries(vals).forEach(([id, v]) => {
    if (id.startsWith('radio:')) {
      const el = app.querySelector(`input[type=radio][name="${CSS.escape(id.slice(6))}"][value="${CSS.escape(v)}"]`);
      if (el) el.checked = true;
      return;
    }
    const el = document.getElementById(id);
    if (!el || !app.contains(el)) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = v; else el.value = v;
  });
}

let lastRendered = null;
function render() {
  const { name, arg } = route();
  const authRoutes = ['login', 'registro', 'recuperar'];
  document.body.classList.toggle('loading', user === undefined);
  if (user === undefined) { app.innerHTML = `<div class="empty"><div class="spinner"></div><p class="muted">Cargando…</p></div>`; return; }

  document.body.classList.toggle('auth', !user);
  if (!user) {
    if (!authRoutes.includes(name)) { history.replaceState(null, '', '#/login'); }
    const r = route().name;
    app.innerHTML = r === 'registro' ? viewRegister() : r === 'recuperar' ? viewRecover() : viewLogin();
    lastRendered = r;
    return;
  }
  if (authRoutes.includes(name)) { history.replaceState(null, '', '#/'); return render(); }

  const sameView = lastRendered === location.hash;
  const vals = sameView ? snapshotForm() : null;
  const focusId = sameView && document.activeElement && app.contains(document.activeElement) ? document.activeElement.id : null;

  let html, nav = '';
  switch (name) {
    case '': html = viewHome(); nav = 'home'; break;
    case 'categorias': html = viewCategories(); nav = 'categorias'; break;
    case 'categoria': html = viewCategory(arg); nav = 'categorias'; break;
    case 'ofertas': html = viewOffers(); nav = 'home'; break;
    case 'favoritos': html = viewFavorites(); break;
    case 'buscar': html = viewSearch(arg); break;
    case 'carrito': html = viewCart(); nav = 'carrito'; break;
    case 'checkout': html = viewCheckout(); nav = 'carrito'; break;
    case 'pedidos': html = viewOrders(); nav = 'pedidos'; break;
    case 'cuenta': html = viewAccount(); break;
    case 'admin': html = viewAdmin(); break;
    default: html = viewNotFound();
  }
  app.innerHTML = html;
  if (vals) restoreForm(vals);
  if (focusId) document.getElementById(focusId)?.focus();
  lastRendered = location.hash;

  document.querySelectorAll('.bottomnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
  $('#adminBtn').hidden = !isAdmin();
  $('#adminBtn').classList.toggle('has-dot', isAdmin() && orders.some(o => o.status === 'pendiente'));
  $('#accountBtn').textContent = (user.name || '?')[0].toUpperCase();
  if (name !== 'buscar') $('#searchInput').value = '';
  updateBadge();
}

window.addEventListener('hashchange', () => {
  closeModal();
  render();
  window.scrollTo({ top: 0 });
  if (pendingModal) { openModal(pendingModal); pendingModal = null; }
});

// ------------------------------------------------------------------
// Sesión y datos en vivo
// ------------------------------------------------------------------
function stopData() { unsubs.forEach(u => typeof u === 'function' && u()); unsubs = []; }

let dataFor = null; // "uid:role" para el que están activas las suscripciones
function startData() {
  const key = user.uid + ':' + user.role;
  if (dataFor === key) return;
  stopData();
  dataFor = key;
  unsubs.push(api.watchProducts(list => { products = list; render(); }));
  unsubs.push(api.watchSettings(s => { config = { ...window.STORE_CONFIG, ...s }; applyBranding(); render(); }));
  let firstOrders = true;
  let known = new Set();
  unsubs.push(api.watchOrders(user, list => {
    if (isAdmin() && !firstOrders) {
      const fresh = list.filter(o => !known.has(o.id) && o.uid !== user.uid);
      if (fresh.length) {
        const o = fresh[0];
        toast(`🔔 Nuevo pedido #${o.code}`);
        systemNotify('🔔 Nuevo pedido', `#${o.code} · ${o.customer?.name || ''} · ${money(o.total)}`, 'new-' + o.id);
        alertSound();
      }
    }
    if (!firstOrders) {
      list.filter(o => o.uid === user.uid).forEach(o => {
        const prev = orders.find(x => x.id === o.id);
        if (prev && prev.status !== o.status && o.status !== 'listo') toast(`📦 Pedido #${o.code}: ${STATUS_LABEL[o.status]}`);
      });
    }
    const live = !firstOrders;
    firstOrders = false;
    known = new Set(list.map(o => o.id));
    orders = list;
    render();
    checkReady(live);
  }));
  if (isAdmin()) unsubs.push(api.watchUsers(list => { users = list; render(); }));
}

function onAuthChange(u) {
  const prevUid = user?.uid;
  user = u;
  if (!u) {
    stopData(); dataFor = null;
    products = []; orders = []; users = []; cart = [];
  } else {
    if (u.uid !== prevUid) {
      cart = local.get(cartKey(), []);
      favorites = local.get('ms_favs_' + u.uid, []);
    }
    if (!isAdmin() && route().name === 'admin') history.replaceState(null, '', '#/');
    startData();
  }
  render();
}

function applyBranding() {
  $('#storeName').textContent = config.name;
  $('#schoolName').textContent = config.school;
}

// ------------------------------------------------------------------
// Eventos
// ------------------------------------------------------------------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-add],[data-open],[data-inc],[data-dec],[data-remove],[data-close],[data-reorder],[data-wa],[data-watext],[data-wacust],[data-cancel],[data-tab],[data-edit],[data-del],[data-newprod],[data-seed],[data-role],[data-logout],[data-readyok],[data-waready],[data-asknotif]');
  if (!el) return;
  const d = el.dataset;
  if ('add' in d) addToCart(d.add);
  else if ('open' in d) openProduct(d.open);
  else if ('inc' in d) { const l = cart.find(x => x.id === d.inc); if (l) setQty(d.inc, l.qty + 1); render(); }
  else if ('dec' in d) { const l = cart.find(x => x.id === d.dec); if (l) setQty(d.dec, l.qty - 1); render(); }
  else if ('remove' in d) { setQty(d.remove, 0); render(); toast('Producto eliminado'); }
  else if ('close' in d) closeModal();
  else if ('reorder' in d) {
    const o = orders.find(x => x.id === d.reorder);
    o.items.forEach(i => { const p = byId(i.id); if (p && p.stock > 0) addToCart(i.id, Math.min(i.qty, p.stock)); });
    location.hash = '#/carrito';
  }
  else if ('wa' in d) { const o = orders.find(x => x.id === d.wa); if (o) openWhatsApp(config.whatsapp, whatsappText(o)); }
  else if ('watext' in d) openWhatsApp(config.whatsapp, decodeURIComponent(d.watext));
  else if ('wacust' in d) {
    const o = orders.find(x => x.id === d.wacust);
    openWhatsApp(toIntlPhone(o.customer.phone), o.status === 'listo' ? readyWhatsApp(o)
      : `Hola ${o.customer.name}, tu pedido #${o.code} de ${config.name} está: *${STATUS_LABEL[o.status]}*.`);
  }
  else if ('waready' in d) {
    const o = orders.find(x => x.id === d.waready);
    if (o) openWhatsApp(toIntlPhone(o.customer.phone), readyWhatsApp({ ...o, status: 'listo' }));
    closeModal();
  }
  else if ('readyok' in d) {
    local.set(readySeenKey(), [...local.get(readySeenKey(), []), d.readyok].slice(-100));
    closeModal();
    checkReady(false);
  }
  else if ('asknotif' in d) askNotifications();
  else if ('cancel' in d) {
    if (confirm('¿Cancelar este pedido?')) run(() => api.updateOrder(d.cancel, { status: 'cancelado' }), 'Pedido cancelado');
  }
  else if ('tab' in d) { adminTab = d.tab; render(); }
  else if ('edit' in d) productForm(byId(d.edit));
  else if ('newprod' in d) productForm(null);
  else if ('seed' in d) run(() => api.seedProducts(window.DEFAULT_PRODUCTS), 'Catálogo cargado');
  else if ('del' in d) {
    const p = byId(d.del);
    if (p && confirm(`¿Eliminar "${p.name}"?`)) run(() => api.deleteProduct(d.del), 'Producto eliminado');
  }
  else if ('role' in d) {
    const u = users.find(x => x.uid === d.role);
    const msg = d.to === 'admin' ? `¿Dar permisos de administrador a ${u.name}? Podrá modificar productos y pedidos.` : `¿Quitar permisos de administrador a ${u.name}?`;
    if (confirm(msg)) run(() => api.setRole(d.role, d.to), 'Permisos actualizados');
  }
  else if ('logout' in d) { if (confirm('¿Cerrar sesión?')) run(() => api.logout()); }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sortSel') { sortMode = e.target.value; render(); }
  if (e.target.dataset.status) {
    const o = orders.find(x => x.id === e.target.dataset.status);
    if (o && o.status !== e.target.value) changeStatus(o, e.target.value);
  }
  if (e.target.name === 'delivery' && $('#totalLbl')) {
    const t = cartTotals(e.target.value);
    $('#feeLbl').textContent = t.fee ? money(t.fee) : 'Gratis';
    $('#totalLbl').textContent = money(t.total);
  }
});

document.addEventListener('submit', async e => {
  const form = e.target;
  const f = new FormData(form);
  const id = form.id;
  if (!['loginForm', 'registerForm', 'recoverForm', 'checkoutForm', 'profileForm', 'settingsForm'].includes(id)) return;
  e.preventDefault();

  if (id === 'loginForm') {
    const email = String(f.get('email')).trim(), password = String(f.get('password'));
    if (!email || !password) return toast('Escribe tu correo y contraseña');
    run(() => api.login(email, password));
  }
  else if (id === 'registerForm') {
    const data = {
      name: String(f.get('name')).trim(),
      grade: String(f.get('grade')),
      parallel: String(f.get('parallel') || '').trim().toUpperCase(),
      phone: String(f.get('phone')).replace(/[^\d+]/g, ''),
      email: String(f.get('email')).trim().toLowerCase(),
      password: String(f.get('password')),
    };
    if (!data.name) return toast('Escribe tu nombre');
    if (!data.grade) return toast('Selecciona tu curso');
    if (data.phone.length < 7) return toast('Escribe un celular válido');
    if (data.password.length < 6) return toast('La contraseña debe tener al menos 6 caracteres');
    if (data.password !== f.get('password2')) return toast('Las contraseñas no coinciden');
    run(() => api.register(data), '¡Bienvenido! 🎉');
  }
  else if (id === 'recoverForm') {
    const email = String(f.get('email')).trim();
    if (!email) return toast('Escribe tu correo');
    if (await run(() => api.resetPassword(email), '📧 Revisa tu correo')) location.hash = '#/login';
  }
  else if (id === 'checkoutForm') submitCheckout(form);
  else if (id === 'profileForm') {
    const patch = {
      name: String(f.get('name')).trim() || user.name,
      grade: String(f.get('grade')),
      parallel: String(f.get('parallel') || '').trim().toUpperCase(),
      phone: String(f.get('phone')).replace(/[^\d+]/g, ''),
    };
    run(() => api.updateProfile(patch), 'Datos guardados');
  }
  else if (id === 'settingsForm') {
    run(() => api.saveSettings({
      name: String(f.get('name')).trim() || config.name,
      whatsapp: String(f.get('whatsapp')).replace(/\D/g, '') || config.whatsapp,
      deliveryFee: Math.max(0, parseFloat(f.get('deliveryFee')) || 0),
      freeGiftOver: Math.max(0, parseFloat(f.get('freeGiftOver')) || 0),
    }), 'Ajustes guardados');
  }
});

$('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (q) location.hash = '#/buscar/' + encodeURIComponent(q);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ------------------------------------------------------------------
// Inicio
// ------------------------------------------------------------------
applyBranding();
render();
try {
  api = await createBackend();
  api.onAuth(onAuthChange);
} catch (e) {
  console.error(e);
  app.innerHTML = `<div class="empty"><div class="big">📡</div><h3>No se pudo conectar</h3>
    <p class="muted">Revisa tu conexión a internet y vuelve a intentar.</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
