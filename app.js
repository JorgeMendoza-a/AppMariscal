/* Mariscal Shop — tienda escolar (SPA sin dependencias) */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Almacenamiento seguro
  // ------------------------------------------------------------------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { toast('⚠️ No se pudo guardar (almacenamiento lleno)'); return false; }
    },
  };

  const config = Object.assign({}, window.STORE_CONFIG, store.get('ms_config', {}));
  const CATS = window.CATEGORIES;
  let products = store.get('ms_products', null) || structuredClone(window.DEFAULT_PRODUCTS);
  let cart = store.get('ms_cart', []);          // [{id, qty}]
  let orders = store.get('ms_orders', []);
  let profile = store.get('ms_profile', {});
  let favorites = store.get('ms_favs', []);

  const STATUSES = ['pendiente', 'preparando', 'listo', 'entregado'];
  const STATUS_LABEL = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };

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
  const saveProducts = () => store.set('ms_products', products);
  const saveCart = () => { store.set('ms_cart', cart); updateBadge(); };
  const saveOrders = () => store.set('ms_orders', orders);

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function thumb(p) {
    return p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.emoji || '📦');
  }

  function discount(p) {
    return p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  }

  // ------------------------------------------------------------------
  // Carrito
  // ------------------------------------------------------------------
  function cartLines() {
    return cart.map(l => ({ ...l, p: byId(l.id) })).filter(l => l.p);
  }
  function cartCount() { return cartLines().reduce((a, l) => a + l.qty, 0); }
  function cartTotals(delivery) {
    const subtotal = cartLines().reduce((a, l) => a + l.qty * l.p.price, 0);
    const savings = cartLines().reduce((a, l) => a + (l.p.oldPrice ? (l.p.oldPrice - l.p.price) * l.qty : 0), 0);
    const fee = delivery === 'aula' ? Number(config.deliveryFee || 0) : 0;
    return { subtotal, savings, fee, total: subtotal + fee };
  }
  function addToCart(id, qty = 1) {
    const p = byId(id);
    if (!p || p.stock <= 0) return toast('Producto agotado');
    const line = cart.find(l => l.id === id);
    const current = line ? line.qty : 0;
    if (current + qty > p.stock) return toast(`Solo hay ${p.stock} disponibles`);
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

  function grid(list) {
    if (!list.length) return `<div class="empty"><div class="big">🔎</div><p class="muted">No encontramos productos.</p></div>`;
    return `<div class="grid">${list.map(productCard).join('')}</div>`;
  }

  function catStrip(active) {
    return `<div class="cats">
      ${CATS.map(c => `
        <a class="cat ${c.id === active ? 'active' : ''}" href="#/categoria/${c.id}">
          <span class="ico">${c.icon}</span>${esc(c.name)}
        </a>`).join('')}
    </div>`;
  }

  function footer() {
    return `<footer class="foot">
      <b>${esc(config.name)}</b> · ${esc(config.school)}<br>
      <em>${esc(config.slogan)}</em>
    </footer>`;
  }

  // ------------------------------------------------------------------
  // Vistas
  // ------------------------------------------------------------------
  function viewHome() {
    const offers = products.filter(p => discount(p)).sort((a, b) => discount(b) - discount(a));
    const best = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 10);
    const combos = products.filter(p => p.cat === 'combos');
    const greeting = profile.name ? `¡Hola, ${esc(profile.name.split(' ')[0])}! 👋` : '¡Bienvenido! 👋';
    return `
      <section class="hero">
        <span class="tag">AÑO LECTIVO 2026 – 2027</span>
        <h1>${greeting}<br>Todo para tus clases, sin salir del colegio</h1>
        <p>Pide desde tu celular y retira en el bar/multiservicios o recíbelo en tu aula.</p>
        <a href="#/categoria/combos" class="btn gold">🎒 Ver combos escolares</a>
        <span class="hero-emoji" aria-hidden="true">📚</span>
      </section>
      <div class="perks">
        <div class="perk"><span>⚡</span>Pedido rápido</div>
        <div class="perk"><span>🏫</span>Entrega en aula</div>
        <div class="perk"><span>💵</span>Paga al retirar</div>
      </div>

      <h2 class="section">Categorías <a href="#/categorias">Ver todas</a></h2>
      ${catStrip()}

      ${offers.length ? `<h2 class="section">🔥 Ofertas del día <a href="#/ofertas">Ver más</a></h2>${grid(offers.slice(0, 10))}` : ''}

      <h2 class="section">🎒 Combos por nivel</h2>
      ${grid(combos)}

      <h2 class="section">⭐ Lo más vendido</h2>
      ${grid(best)}
      ${footer()}`;
  }

  function viewCategories() {
    return `
      <h2 class="section">Categorías</h2>
      <div class="cat-grid">
        ${CATS.map(c => `
          <a class="cat-tile" href="#/categoria/${c.id}">
            <span class="ico">${c.icon}</span>
            <div>${esc(c.name)}<small>${products.filter(p => p.cat === c.id).length} productos</small></div>
          </a>`).join('')}
      </div>
      ${footer()}`;
  }

  let sortMode = 'popular';
  function sortList(list) {
    const l = [...list];
    if (sortMode === 'low') l.sort((a, b) => a.price - b.price);
    else if (sortMode === 'high') l.sort((a, b) => b.price - a.price);
    else if (sortMode === 'rating') l.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else l.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    return l;
  }
  function toolbar(count) {
    return `<div class="toolbar">
      <span class="muted">${count} producto${count === 1 ? '' : 's'}</span>
      <select id="sortSel" aria-label="Ordenar">
        <option value="popular" ${sortMode === 'popular' ? 'selected' : ''}>Más vendidos</option>
        <option value="low" ${sortMode === 'low' ? 'selected' : ''}>Precio: menor a mayor</option>
        <option value="high" ${sortMode === 'high' ? 'selected' : ''}>Precio: mayor a menor</option>
        <option value="rating" ${sortMode === 'rating' ? 'selected' : ''}>Mejor calificados</option>
      </select>
    </div>`;
  }

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

  function viewSearch(q) {
    const nq = norm(q);
    const list = sortList(products.filter(p => norm(p.name + ' ' + p.desc + ' ' + catName(p.cat)).includes(nq)));
    return `<h2 class="section">Resultados para “${esc(q)}”</h2>${toolbar(list.length)}${grid(list)}`;
  }

  function viewCart() {
    const lines = cartLines();
    if (!lines.length) {
      return `<div class="empty"><div class="big">🛒</div><h3>Tu carrito está vacío</h3>
        <p class="muted">Agrega plumas, cuadernos, marcadores y más.</p>
        <a href="#/" class="btn">Ir a comprar</a></div>`;
    }
    const t = cartTotals();
    const missing = config.freeGiftOver - t.subtotal;
    return `
      <h2 class="section">Mi carrito (${cartCount()})</h2>
      <div class="layout-2">
        <div class="card">
          ${lines.map(l => `
            <div class="cart-item">
              <div class="thumb-sm">${thumb(l.p)}</div>
              <div>
                <div class="t">${esc(l.p.name)}</div>
                <div class="price">${money(l.p.price)}</div>
                <button class="link-btn" data-remove="${esc(l.id)}">Eliminar</button>
              </div>
              <div class="right">
                <div class="qty">
                  <button data-dec="${esc(l.id)}" aria-label="Menos">−</button>
                  <span>${l.qty}</span>
                  <button data-inc="${esc(l.id)}" aria-label="Más">+</button>
                </div>
                <b>${money(l.qty * l.p.price)}</b>
              </div>
            </div>`).join('')}
        </div>
        <div class="card sticky">
          ${missing > 0
            ? `<div class="notice">🎁 Te faltan <b>${money(missing)}</b> para llevarte un regalo sorpresa.</div>`
            : `<div class="notice">🎁 ¡Genial! Tu pedido incluye un <b>regalo sorpresa</b>.</div>`}
          <div class="summary">
            <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
            ${t.savings > 0 ? `<div class="row" style="color:var(--green-500)"><span>Ahorras</span><span>-${money(t.savings)}</span></div>` : ''}
            <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
          </div>
          <a href="#/checkout" class="btn gold block" style="margin-top:14px">Continuar con el pedido →</a>
          <a href="#/" class="btn ghost block" style="margin-top:8px">Seguir comprando</a>
        </div>
      </div>`;
  }

  function viewCheckout() {
    if (!cartLines().length) { location.hash = '#/carrito'; return ''; }
    const t = cartTotals(profile.delivery || 'retiro');
    const fee = Number(config.deliveryFee || 0);
    return `
      <h2 class="section">Finalizar pedido</h2>
      <div class="layout-2">
        <form class="card form" id="checkoutForm" novalidate>
          <div class="field"><label for="f-name">Nombre del estudiante o representante *</label>
            <input id="f-name" name="name" required maxlength="60" value="${esc(profile.name)}" placeholder="Ej. María Pérez"></div>
          <div class="row-2">
            <div class="field"><label for="f-grade">Curso / grado *</label>
              <select id="f-grade" name="grade" required>
                ${['', 'Inicial 1', 'Inicial 2', '1ro EGB', '2do EGB', '3ro EGB', '4to EGB', '5to EGB', '6to EGB', '7mo EGB', '8vo EGB', '9no EGB', '10mo EGB', '1ro BGU', '2do BGU', '3ro BGU', 'Docente', 'Personal']
                  .map(g => `<option value="${g}" ${profile.grade === g ? 'selected' : ''}>${g || 'Selecciona…'}</option>`).join('')}
              </select></div>
            <div class="field"><label for="f-par">Paralelo</label>
              <input id="f-par" name="parallel" maxlength="3" value="${esc(profile.parallel)}" placeholder="A"></div>
          </div>
          <div class="field"><label for="f-phone">Celular (WhatsApp) *</label>
            <input id="f-phone" name="phone" type="tel" inputmode="tel" required maxlength="15" value="${esc(profile.phone)}" placeholder="09XXXXXXXX"></div>

          <div class="field"><label>¿Cómo lo recibes?</label>
            <div class="options">
              <label class="option"><input type="radio" name="delivery" value="retiro" ${profile.delivery !== 'aula' ? 'checked' : ''}>
                <div>🏪 Retiro en el multiservicios<small>Gratis · te avisamos cuando esté listo</small></div></label>
              <label class="option"><input type="radio" name="delivery" value="aula" ${profile.delivery === 'aula' ? 'checked' : ''}>
                <div>🏫 Entrega en mi aula<small>${fee ? money(fee) : 'Gratis'} · en el recreo</small></div></label>
            </div></div>

          <div class="field"><label>Forma de pago</label>
            <div class="options">
              <label class="option"><input type="radio" name="pay" value="Efectivo" checked>
                <div>💵 Efectivo al recibir</div></label>
              <label class="option"><input type="radio" name="pay" value="Transferencia">
                <div>🏦 Transferencia / DeUna<small>Envía el comprobante por WhatsApp</small></div></label>
            </div></div>

          <div class="field"><label for="f-notes">Notas (opcional)</label>
            <textarea id="f-notes" name="notes" rows="2" maxlength="200" placeholder="Ej. color de cuaderno, archivo para imprimir…"></textarea></div>

          <button class="btn gold block" type="submit">📲 Confirmar y enviar por WhatsApp</button>
          <p class="muted" style="font-size:.75rem;margin:0">Al confirmar se abrirá WhatsApp con el detalle del pedido para enviarlo al multiservicios.</p>
        </form>

        <div class="card sticky">
          <h3 style="margin-top:0">Resumen</h3>
          ${cartLines().map(l => `<div class="summary"><div class="row"><span>${l.qty} × ${esc(l.p.name)}</span><span>${money(l.qty * l.p.price)}</span></div></div>`).join('')}
          <div class="summary" style="margin-top:10px">
            <div class="row"><span>Entrega</span><span id="feeLbl">${t.fee ? money(t.fee) : 'Gratis'}</span></div>
            <div class="row total"><span>Total</span><span id="totalLbl">${money(t.total)}</span></div>
          </div>
        </div>
      </div>`;
  }

  function orderCard(o, admin = false) {
    const idx = STATUSES.indexOf(o.status);
    return `
      <div class="card order">
        <div class="order-head">
          <div><b>Pedido #${esc(o.id)}</b><div class="muted" style="font-size:.75rem">${new Date(o.date).toLocaleString('es-EC')}</div></div>
          <span class="status ${esc(o.status)}">${STATUS_LABEL[o.status] || esc(o.status)}</span>
        </div>
        ${o.status !== 'cancelado' ? `<div class="steps">${STATUSES.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)} — ${money(i.qty * i.price)}</li>`).join('')}</ul>
        <div class="muted" style="font-size:.78rem">
          ${esc(o.customer.name)} · ${esc(o.customer.grade)} ${esc(o.customer.parallel || '')} ·
          ${o.delivery === 'aula' ? '🏫 Entrega en aula' : '🏪 Retiro'} · ${esc(o.pay)}
          ${o.notes ? `<br>📝 ${esc(o.notes)}` : ''}
        </div>
        <div class="order-head" style="margin-top:10px">
          <b class="price">${money(o.total)}</b>
          ${admin ? `
            <div class="small-btns">
              <select data-status="${esc(o.id)}" aria-label="Cambiar estado">
                ${[...STATUSES, 'cancelado'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
              </select>
            </div>` : `
            <div class="small-btns">
              <button data-reorder="${esc(o.id)}">🔁 Volver a pedir</button>
              <button data-wa="${esc(o.id)}">💬 WhatsApp</button>
            </div>`}
        </div>
      </div>`;
  }

  function viewOrders() {
    if (!orders.length) {
      return `<div class="empty"><div class="big">📦</div><h3>Aún no tienes pedidos</h3>
        <p class="muted">Tus pedidos aparecerán aquí para que sigas su estado.</p><a href="#/" class="btn">Empezar a comprar</a></div>`;
    }
    return `<h2 class="section">Mis pedidos</h2>${orders.map(o => orderCard(o)).join('')}`;
  }

  function viewNotFound() {
    return `<div class="empty"><div class="big">🧭</div><h3>Página no encontrada</h3><a href="#/" class="btn">Volver al inicio</a></div>`;
  }

  // ------------------------------------------------------------------
  // Admin
  // ------------------------------------------------------------------
  let adminTab = 'productos';
  const isAdmin = () => sessionStorage.getItem('ms_admin') === '1';

  function viewAdmin() {
    if (!isAdmin()) {
      return `
        <div class="card" style="max-width:380px;margin:30px auto;text-align:center">
          <div style="font-size:3rem">🔐</div>
          <h3>Panel del multiservicios</h3>
          <p class="muted" style="font-size:.85rem">Ingresa el PIN de administrador.</p>
          <form id="pinForm" class="form">
            <div class="field"><input id="pinInput" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" aria-label="PIN" style="text-align:center;font-size:1.3rem;letter-spacing:6px"></div>
            <button class="btn block">Entrar</button>
          </form>
        </div>`;
    }
    const revenue = orders.filter(o => o.status !== 'cancelado').reduce((a, o) => a + o.total, 0);
    const pending = orders.filter(o => o.status === 'pendiente' || o.status === 'preparando').length;
    const low = products.filter(p => p.stock < 10).length;
    let body = '';
    if (adminTab === 'productos') {
      body = `
        <div class="toolbar"><span class="muted">${products.length} productos</span>
          <button class="btn" data-newprod>+ Nuevo producto</button></div>
        <div class="admin-list">
          ${products.map(p => `
            <div class="admin-row">
              <div class="e">${p.img ? `<img src="${esc(p.img)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">` : esc(p.emoji)}</div>
              <div><div class="t">${esc(p.name)}</div>
                <div class="s">${money(p.price)} · ${esc(catName(p.cat))} · <span class="${p.stock < 10 ? 'low' : ''}">Stock: ${p.stock}</span></div></div>
              <div class="small-btns">
                <button data-edit="${esc(p.id)}">Editar</button>
                <button class="del" data-del="${esc(p.id)}" aria-label="Eliminar">🗑</button>
              </div>
            </div>`).join('')}
        </div>`;
    } else if (adminTab === 'pedidos') {
      body = orders.length ? orders.map(o => orderCard(o, true)).join('') : `<p class="muted">No hay pedidos registrados en este dispositivo.</p>`;
    } else {
      body = `
        <form class="card form" id="settingsForm">
          <div class="field"><label for="s-name">Nombre del negocio</label><input id="s-name" name="name" value="${esc(config.name)}" maxlength="40"></div>
          <div class="field"><label for="s-wa">WhatsApp del negocio (con código de país, sin +)</label><input id="s-wa" name="whatsapp" value="${esc(config.whatsapp)}" inputmode="numeric" maxlength="15"></div>
          <div class="row-2">
            <div class="field"><label for="s-fee">Costo entrega en aula</label><input id="s-fee" name="deliveryFee" type="number" step="0.05" min="0" value="${esc(config.deliveryFee)}"></div>
            <div class="field"><label for="s-gift">Regalo desde ($)</label><input id="s-gift" name="freeGiftOver" type="number" step="0.5" min="0" value="${esc(config.freeGiftOver)}"></div>
          </div>
          <div class="field"><label for="s-pin">Nuevo PIN de administrador</label><input id="s-pin" name="adminPin" type="password" inputmode="numeric" maxlength="8" placeholder="Dejar vacío para no cambiar"></div>
          <button class="btn">Guardar ajustes</button>
          <hr style="border:0;border-top:1px solid #eee;width:100%">
          <button type="button" class="btn danger" data-reset>Restaurar catálogo original</button>
        </form>`;
    }
    return `
      <h2 class="section">⚙️ Administración <button class="btn ghost" data-logout style="padding:8px 14px">Salir</button></h2>
      <div class="stats">
        <div class="stat"><b>${orders.length}</b><small>Pedidos</small></div>
        <div class="stat"><b>${pending}</b><small>Por atender</small></div>
        <div class="stat"><b>${money(revenue)}</b><small>Ventas</small></div>
        <div class="stat"><b>${low}</b><small>Stock bajo</small></div>
      </div>
      <div class="tabs">
        ${['productos', 'pedidos', 'ajustes'].map(t => `<button data-tab="${t}" class="${adminTab === t ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
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
        name, price,
        cat: f.get('cat'),
        emoji: String(f.get('emoji') || '📦').trim() || '📦',
        oldPrice: parseFloat(f.get('oldPrice')) || null,
        stock: Math.max(0, parseInt(f.get('stock'), 10) || 0),
        desc: String(f.get('desc') || '').trim(),
        img,
      };
      if (isNew) products.unshift({ id: 'p' + Date.now().toString(36), rating: 5, sold: 0, ...data });
      else Object.assign(byId(p.id), data);
      if (saveProducts()) { closeModal(); toast('Producto guardado'); render(); }
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
    const fav = favorites.includes(id);
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
          <button class="btn ghost" id="dFav" aria-label="Favorito" style="flex:0 0 auto">${fav ? '💚' : '🤍'}</button>
        </div>
        ${related.length ? `<h2 class="section">También te puede servir</h2><div class="grid">${related.map(productCard).join('')}</div>` : ''}
      </div>`);
    const sheet = $('#modalContent');
    sheet.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      qty = Math.max(1, Math.min(p.stock || 1, qty + Number(b.dataset.q)));
      $('#dq').textContent = qty;
    }));
    $('#dAdd').addEventListener('click', () => { addToCart(p.id, qty); closeModal(); render(); });
    $('#dFav').addEventListener('click', e => {
      favorites = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
      store.set('ms_favs', favorites);
      e.currentTarget.textContent = favorites.includes(id) ? '💚' : '🤍';
    });
  }

  // ------------------------------------------------------------------
  // Pedido
  // ------------------------------------------------------------------
  function whatsappText(o) {
    const lines = [
      `🛒 *Nuevo pedido #${o.id}* — ${config.name}`,
      '',
      ...o.items.map(i => `• ${i.qty} x ${i.name} = ${money(i.qty * i.price)}`),
      '',
      `*Total: ${money(o.total)}*`,
      `👤 ${o.customer.name} (${o.customer.grade} ${o.customer.parallel || ''})`.trim(),
      `📱 ${o.customer.phone}`,
      `🚚 ${o.delivery === 'aula' ? 'Entrega en aula' : 'Retiro en multiservicios'}`,
      `💳 ${o.pay}`,
    ];
    if (o.notes) lines.push(`📝 ${o.notes}`);
    return lines.join('\n');
  }
  function openWhatsApp(o) {
    const url = `https://wa.me/${encodeURIComponent(config.whatsapp)}?text=${encodeURIComponent(whatsappText(o))}`;
    window.open(url, '_blank', 'noopener');
  }

  function submitCheckout(form) {
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim();
    const grade = String(f.get('grade') || '');
    const phone = String(f.get('phone') || '').replace(/[^\d+]/g, '');
    if (!name) return toast('Escribe tu nombre');
    if (!grade) return toast('Selecciona tu curso');
    if (phone.length < 7) return toast('Escribe un celular válido');
    const delivery = f.get('delivery');
    profile = { name, grade, parallel: String(f.get('parallel') || '').trim().toUpperCase(), phone, delivery };
    store.set('ms_profile', profile);

    // Validar stock
    for (const l of cartLines()) {
      if (l.qty > l.p.stock) return toast(`Stock insuficiente: ${l.p.name}`);
    }
    const t = cartTotals(delivery);
    const order = {
      id: 'MA' + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      items: cartLines().map(l => ({ id: l.id, name: l.p.name, qty: l.qty, price: l.p.price })),
      total: t.total,
      delivery,
      pay: f.get('pay'),
      notes: String(f.get('notes') || '').trim(),
      customer: { name: profile.name, grade: profile.grade, parallel: profile.parallel, phone },
      status: 'pendiente',
    };
    // Descontar stock y sumar vendidos
    cartLines().forEach(l => { l.p.stock -= l.qty; l.p.sold = (l.p.sold || 0) + l.qty; });
    saveProducts();
    orders.unshift(order);
    saveOrders();
    cart = [];
    saveCart();
    openWhatsApp(order);
    pendingModal = `
      <div style="text-align:center">
        <div style="font-size:4rem">🎉</div>
        <h3>¡Pedido #${esc(order.id)} creado!</h3>
        <p class="muted">Envía el mensaje de WhatsApp que se abrió para confirmarlo con el multiservicios.</p>
        <button class="btn gold block" data-wa="${esc(order.id)}">💬 Abrir WhatsApp de nuevo</button>
        <button class="btn ghost block" data-close style="margin-top:8px">Listo</button>
      </div>`;
    if (location.hash === '#/pedidos') { render(); openModal(pendingModal); pendingModal = null; }
    else location.hash = '#/pedidos';
  }

  // ------------------------------------------------------------------
  // Router
  // ------------------------------------------------------------------
  function render() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [route, ...rest] = hash.split('/');
    const arg = decodeURIComponent(rest.join('/'));
    let html, nav = '';
    switch (route) {
      case '': html = viewHome(); nav = 'home'; break;
      case 'categorias': html = viewCategories(); nav = 'categorias'; break;
      case 'categoria': html = viewCategory(arg); nav = 'categorias'; break;
      case 'ofertas': html = viewOffers(); nav = 'home'; break;
      case 'buscar': html = viewSearch(arg); break;
      case 'carrito': html = viewCart(); nav = 'carrito'; break;
      case 'checkout': html = viewCheckout(); nav = 'carrito'; break;
      case 'pedidos': html = viewOrders(); nav = 'pedidos'; break;
      case 'admin': html = viewAdmin(); break;
      default: html = viewNotFound();
    }
    app.innerHTML = html;
    document.querySelectorAll('.bottomnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
    if (route !== 'buscar') $('#searchInput').value = '';
    updateBadge();
  }

  let lastRoute = '';
  let pendingModal = null;
  window.addEventListener('hashchange', () => {
    closeModal();
    render();
    if (pendingModal) { openModal(pendingModal); pendingModal = null; }
    if (location.hash !== lastRoute) window.scrollTo({ top: 0 });
    lastRoute = location.hash;
  });

  // ------------------------------------------------------------------
  // Eventos delegados
  // ------------------------------------------------------------------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-add],[data-open],[data-inc],[data-dec],[data-remove],[data-close],[data-reorder],[data-wa],[data-tab],[data-edit],[data-del],[data-newprod],[data-logout],[data-reset]');
    if (!el) return;
    const d = el.dataset;
    if ('add' in d) { addToCart(d.add); if (!$('#modal').hidden) return; }
    else if ('open' in d) openProduct(d.open);
    else if ('inc' in d) { const l = cart.find(x => x.id === d.inc); setQty(d.inc, l.qty + 1); render(); }
    else if ('dec' in d) { const l = cart.find(x => x.id === d.dec); setQty(d.dec, l.qty - 1); render(); }
    else if ('remove' in d) { setQty(d.remove, 0); render(); toast('Producto eliminado'); }
    else if ('close' in d) closeModal();
    else if ('reorder' in d) {
      const o = orders.find(x => x.id === d.reorder);
      o.items.forEach(i => { const p = byId(i.id); if (p && p.stock > 0) addToCart(i.id, Math.min(i.qty, p.stock)); });
      location.hash = '#/carrito';
    }
    else if ('wa' in d) { const o = orders.find(x => x.id === d.wa); if (o) openWhatsApp(o); }
    else if ('tab' in d) { adminTab = d.tab; render(); }
    else if ('edit' in d) productForm(byId(d.edit));
    else if ('newprod' in d) productForm(null);
    else if ('del' in d) {
      const p = byId(d.del);
      if (p && confirm(`¿Eliminar "${p.name}"?`)) {
        products = products.filter(x => x.id !== d.del);
        cart = cart.filter(l => l.id !== d.del);
        saveProducts(); saveCart(); render();
      }
    }
    else if ('logout' in d) { sessionStorage.removeItem('ms_admin'); location.hash = '#/'; }
    else if ('reset' in d) {
      if (confirm('¿Restaurar el catálogo original? Se perderán los productos editados.')) {
        products = structuredClone(window.DEFAULT_PRODUCTS);
        saveProducts(); toast('Catálogo restaurado'); render();
      }
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'sortSel') { sortMode = e.target.value; render(); }
    if (e.target.dataset.status) {
      const o = orders.find(x => x.id === e.target.dataset.status);
      if (o) {
        // Si se cancela, devolver stock
        if (e.target.value === 'cancelado' && o.status !== 'cancelado') o.items.forEach(i => { const p = byId(i.id); if (p) p.stock += i.qty; });
        else if (o.status === 'cancelado' && e.target.value !== 'cancelado') o.items.forEach(i => { const p = byId(i.id); if (p) p.stock = Math.max(0, p.stock - i.qty); });
        o.status = e.target.value;
        saveOrders(); saveProducts(); render(); toast('Estado actualizado');
      }
    }
    if (e.target.name === 'delivery' && $('#totalLbl')) {
      const t = cartTotals(e.target.value);
      $('#feeLbl').textContent = t.fee ? money(t.fee) : 'Gratis';
      $('#totalLbl').textContent = money(t.total);
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'checkoutForm') { e.preventDefault(); submitCheckout(e.target); }
    else if (e.target.id === 'pinForm') {
      e.preventDefault();
      if ($('#pinInput').value === String(config.adminPin)) { sessionStorage.setItem('ms_admin', '1'); render(); }
      else toast('PIN incorrecto');
    }
    else if (e.target.id === 'settingsForm') {
      e.preventDefault();
      const f = new FormData(e.target);
      const saved = store.get('ms_config', {});
      saved.name = String(f.get('name')).trim() || config.name;
      saved.whatsapp = String(f.get('whatsapp')).replace(/\D/g, '') || config.whatsapp;
      saved.deliveryFee = Math.max(0, parseFloat(f.get('deliveryFee')) || 0);
      saved.freeGiftOver = Math.max(0, parseFloat(f.get('freeGiftOver')) || 0);
      const pin = String(f.get('adminPin') || '').trim();
      if (pin) saved.adminPin = pin;
      store.set('ms_config', saved);
      Object.assign(config, saved);
      applyBranding();
      toast('Ajustes guardados');
      render();
    }
  });

  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (q) location.hash = '#/buscar/' + encodeURIComponent(q);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function applyBranding() {
    $('#storeName').textContent = config.name;
    $('#schoolName').textContent = config.school;
  }

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  applyBranding();
  lastRoute = location.hash;
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
