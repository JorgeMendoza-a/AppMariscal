/* Capa de datos: Firebase (producción) o almacenamiento local (modo demo).
 * Ambas implementaciones exponen la misma interfaz:
 *
 *   mode                         'firebase' | 'demo'
 *   onAuth(cb)                   cb(user | null)  user = {uid,email,name,grade,parallel,phone,role}
 *   register(data) / login(email, pass) / logout() / resetPassword(email)
 *   updateProfile(patch)
 *   watchProducts(cb)            lista en vivo
 *   saveProduct(p) / deleteProduct(id) / seedProducts(list)          (admin)
 *   watchOrders(user, cb)        admin: todos · estudiante: los suyos
 *   createOrder(order) / updateOrder(id, patch)
 *   adjustStock(items, sign)                                          (admin)
 *   watchUsers(cb) / setRole(uid, role)                               (admin)
 *   watchSettings(cb) / saveSettings(patch)
 */

const AUTH_ERRORS = {
  'auth/invalid-email': 'El correo no es válido',
  'auth/user-not-found': 'Correo o contraseña incorrectos',
  'auth/wrong-password': 'Correo o contraseña incorrectos',
  'auth/invalid-credential': 'Correo o contraseña incorrectos',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento',
  'auth/network-request-failed': 'Sin conexión a internet',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La configuración de Firebase no es válida (revisa firebase-config.js)',
  'auth/operation-not-allowed': 'Activa "Correo electrónico/contraseña" en Firebase → Authentication',
  'permission-denied': 'No tienes permiso para hacer esto',
};
export const errorText = e => AUTH_ERRORS[e?.code] || e?.message || 'Ocurrió un error';

const fail = (code, message) => { const e = new Error(message || AUTH_ERRORS[code] || code); e.code = code; throw e; };

export async function createBackend() {
  return window.FIREBASE_CONFIG ? createFirebaseBackend(window.FIREBASE_CONFIG) : createLocalBackend();
}

// =====================================================================
//  FIREBASE
// =====================================================================
async function createFirebaseBackend(cfg) {
  const V = '10.12.2';
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const col = name => F.collection(db, name);
  const docRef = (name, id) => F.doc(db, name, id);
  const list = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

  let current = null;

  return {
    mode: 'firebase',

    onAuth(cb) {
      let unsubUser = null;
      A.onAuthStateChanged(auth, fbUser => {
        if (unsubUser) { unsubUser(); unsubUser = null; }
        if (!fbUser) { current = null; return cb(null); }
        // Escucha el perfil en vivo (así un cambio de rol se aplica al instante)
        unsubUser = F.onSnapshot(docRef('users', fbUser.uid), snap => {
          if (!snap.exists()) return; // se está creando durante el registro
          current = { uid: fbUser.uid, email: fbUser.email, ...snap.data() };
          cb(current);
        }, () => cb(null));
      });
    },

    async register({ email, password, name, grade, parallel, phone }) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      await F.setDoc(docRef('users', cred.user.uid), {
        name, grade, parallel, phone, email, role: 'student', createdAt: new Date().toISOString(),
      });
    },
    login: (email, password) => A.signInWithEmailAndPassword(auth, email, password),
    logout: () => A.signOut(auth),
    resetPassword: email => A.sendPasswordResetEmail(auth, email),
    updateProfile: patch => F.updateDoc(docRef('users', current.uid), patch),

    watchProducts: cb => F.onSnapshot(col('products'), s => cb(list(s)), () => cb([])),
    saveProduct(p) {
      const { id, ...data } = p;
      return id ? F.setDoc(docRef('products', id), data) : F.addDoc(col('products'), data);
    },
    deleteProduct: id => F.deleteDoc(docRef('products', id)),
    async seedProducts(items) {
      const batch = F.writeBatch(db);
      items.forEach(({ id, ...data }) => batch.set(docRef('products', id), data));
      await batch.commit();
    },

    watchOrders(user, cb) {
      const q = user.role === 'admin' ? col('orders') : F.query(col('orders'), F.where('uid', '==', user.uid));
      return F.onSnapshot(q, s => cb(list(s).sort((a, b) => b.date.localeCompare(a.date))), () => cb([]));
    },
    async createOrder(order) {
      const ref = await F.addDoc(col('orders'), order);
      return ref.id;
    },
    updateOrder: (id, patch) => F.updateDoc(docRef('orders', id), patch),
    async adjustStock(items, sign) {
      await F.runTransaction(db, async tx => {
        const refs = items.map(i => docRef('products', i.id));
        const snaps = await Promise.all(refs.map(r => tx.get(r)));
        snaps.forEach((s, k) => {
          if (!s.exists()) return;
          const d = s.data();
          const q = items[k].qty;
          tx.update(refs[k], {
            stock: Math.max(0, (d.stock || 0) - sign * q),
            sold: Math.max(0, (d.sold || 0) + sign * q),
          });
        });
      });
    },

    watchUsers: cb => F.onSnapshot(col('users'), s => cb(list(s).map(u => ({ uid: u.id, ...u }))), () => cb([])),
    setRole: (uid, role) => F.updateDoc(docRef('users', uid), { role }),

    watchSettings: cb => F.onSnapshot(docRef('settings', 'store'), s => cb(s.exists() ? s.data() : {}), () => cb({})),
    saveSettings: patch => F.setDoc(docRef('settings', 'store'), patch, { merge: true }),
  };
}

// =====================================================================
//  MODO DEMO (localStorage) — mismo comportamiento, solo en este equipo
// =====================================================================
export const DEMO_ADMIN = { email: 'admin@mariscal.edu', password: 'Mariscal2026' };

async function hash(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
  }
}

async function createLocalBackend() {
  const get = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { fail('storage', 'Almacenamiento lleno'); } };
  const K = { users: 'msd_users', session: 'msd_session', products: 'msd_products', orders: 'msd_orders', settings: 'msd_settings' };
  const listeners = { auth: [], products: [], orders: [], users: [], settings: [] };
  const emit = name => listeners[name].forEach(fn => fn());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Datos iniciales
  let users = get(K.users, null);
  if (!users) {
    users = [{ uid: 'admin', email: DEMO_ADMIN.email, pass: await hash(DEMO_ADMIN.password), name: 'Administrador', grade: 'Personal', parallel: '', phone: '', role: 'admin' }];
    set(K.users, users);
  }
  if (!get(K.products, null)) set(K.products, structuredClone(window.DEFAULT_PRODUCTS));

  const publicUser = u => { if (!u) return null; const { pass, ...rest } = u; return rest; };
  const me = () => publicUser(get(K.users, []).find(u => u.uid === get(K.session, null)));
  const requireAdmin = () => { if (me()?.role !== 'admin') fail('permission-denied'); };
  const sub = (name, fn) => { listeners[name].push(fn); fn(); return () => { listeners[name] = listeners[name].filter(f => f !== fn); }; };

  return {
    mode: 'demo',

    onAuth: cb => sub('auth', () => cb(me())),

    async register({ email, password, name, grade, parallel, phone }) {
      email = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('auth/invalid-email');
      if (password.length < 6) fail('auth/weak-password');
      const all = get(K.users, []);
      if (all.some(u => u.email === email)) fail('auth/email-already-in-use');
      const u = { uid: uid(), email, pass: await hash(password), name, grade, parallel, phone, role: 'student', createdAt: new Date().toISOString() };
      set(K.users, [...all, u]);
      set(K.session, u.uid);
      emit('auth'); emit('users');
    },
    async login(email, password) {
      const h = await hash(password);
      const u = get(K.users, []).find(x => x.email === email.trim().toLowerCase() && x.pass === h);
      if (!u) fail('auth/invalid-credential');
      set(K.session, u.uid);
      emit('auth');
    },
    async logout() { localStorage.removeItem(K.session); emit('auth'); },
    async resetPassword() { fail('demo', 'En modo demo no se envían correos. Pide al administrador que te cree otra cuenta.'); },
    async updateProfile(patch) {
      const { role, ...safe } = patch;
      set(K.users, get(K.users, []).map(u => u.uid === me().uid ? { ...u, ...safe } : u));
      emit('auth'); emit('users');
    },

    watchProducts: cb => sub('products', () => cb(get(K.products, []))),
    async saveProduct(p) {
      requireAdmin();
      const all = get(K.products, []);
      if (p.id && all.some(x => x.id === p.id)) set(K.products, all.map(x => x.id === p.id ? p : x));
      else set(K.products, [{ ...p, id: p.id || 'p' + uid() }, ...all]);
      emit('products');
    },
    async deleteProduct(id) { requireAdmin(); set(K.products, get(K.products, []).filter(p => p.id !== id)); emit('products'); },
    async seedProducts(items) { requireAdmin(); set(K.products, structuredClone(items)); emit('products'); },

    watchOrders(user, cb) {
      return sub('orders', () => {
        const all = get(K.orders, []);
        cb((user.role === 'admin' ? all : all.filter(o => o.uid === user.uid)).sort((a, b) => b.date.localeCompare(a.date)));
      });
    },
    async createOrder(order) {
      const id = uid();
      set(K.orders, [...get(K.orders, []), { ...order, id }]);
      emit('orders');
      return id;
    },
    async updateOrder(id, patch) {
      const user = me();
      const o = get(K.orders, []).find(x => x.id === id);
      const ownCancel = o && o.uid === user?.uid && o.status === 'pendiente' && Object.keys(patch).join() === 'status' && patch.status === 'cancelado';
      if (user?.role !== 'admin' && !ownCancel) fail('permission-denied');
      set(K.orders, get(K.orders, []).map(x => x.id === id ? { ...x, ...patch } : x));
      emit('orders');
    },
    async adjustStock(items, sign) {
      requireAdmin();
      set(K.products, get(K.products, []).map(p => {
        const i = items.find(x => x.id === p.id);
        return i ? { ...p, stock: Math.max(0, (p.stock || 0) - sign * i.qty), sold: Math.max(0, (p.sold || 0) + sign * i.qty) } : p;
      }));
      emit('products');
    },

    watchUsers: cb => sub('users', () => cb(get(K.users, []).map(publicUser))),
    async setRole(id, role) {
      requireAdmin();
      set(K.users, get(K.users, []).map(u => u.uid === id ? { ...u, role } : u));
      emit('users'); emit('auth');
    },

    watchSettings: cb => sub('settings', () => cb(get(K.settings, {}))),
    async saveSettings(patch) { requireAdmin(); set(K.settings, { ...get(K.settings, {}), ...patch }); emit('settings'); },
  };
}
