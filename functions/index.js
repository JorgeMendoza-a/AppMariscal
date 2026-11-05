/**
 * Cloud Functions de Mariscal Shop.
 * Envían notificaciones push (Firebase Cloud Messaging) que llegan aunque la
 * app esté cerrada:
 *   - al cliente, cuando su pedido pasa a "listo"
 *   - a los administradores, cuando entra un pedido nuevo
 *
 * Cada celular guarda su "token" de notificaciones en users/{uid}.fcmTokens.
 */
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
// Misma región que la base de datos. maxInstances limita el gasto.
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const db = getFirestore();
const STORE_URL = 'https://jorgemendoza-a.github.io/AppMariscal/';
const ORDERS_URL = STORE_URL + '#/pedidos';

// Errores que indican que el token ya no sirve (app desinstalada, etc.)
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function sendToUsers(userDocs, title, body, tag) {
  const entries = [];
  userDocs.forEach(doc => {
    const tokens = doc.get('fcmTokens') || [];
    tokens.forEach(token => entries.push({ token, ref: doc.ref }));
  });
  if (!entries.length) {
    logger.info('Sin tokens para notificar', { tag });
    return;
  }

  const res = await getMessaging().sendEachForMulticast({
    tokens: entries.map(e => e.token),
    notification: { title, body },
    data: { goto: '#/pedidos', tag },
    android: {
      priority: 'high',
      notification: { channelId: 'pedidos', tag, icon: 'ic_notification', color: '#0b6b2e', sound: 'default' },
    },
    webpush: {
      notification: { icon: STORE_URL + 'assets/icon-192.png', badge: STORE_URL + 'assets/icon-192.png', tag, renotify: true },
      fcmOptions: { link: ORDERS_URL },
    },
  });

  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && DEAD_TOKEN.has(r.error?.code)) dead.push(entries[i]);
  });
  await Promise.all(dead.map(e => e.ref.update({ fcmTokens: FieldValue.arrayRemove(e.token) })));
  logger.info('Notificaciones enviadas', { tag, ok: res.successCount, fallidas: res.failureCount, borrados: dead.length });
}

const readyText = o => o.delivery === 'aula'
  ? `Tu pedido #${o.code} está listo. En el recreo lo llevamos a tu aula.`
  : `Tu pedido #${o.code} está listo. Acércate al multiservicios a retirarlo.`;

exports.avisarPedidoListo = onDocumentUpdated('orders/{orderId}', async event => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after || before?.status === after.status || after.status !== 'listo') return;
  const user = await db.doc(`users/${after.uid}`).get();
  if (!user.exists) return;
  await sendToUsers([user], '✅ ¡Tu pedido está listo!', readyText(after), 'ready-' + event.params.orderId);
});

exports.avisarPedidoNuevo = onDocumentCreated('orders/{orderId}', async event => {
  const o = event.data?.data();
  if (!o) return;
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  const others = admins.docs.filter(d => d.id !== o.uid);
  const total = Number(o.total || 0).toFixed(2);
  await sendToUsers(others, '🔔 Nuevo pedido', `#${o.code} · ${o.customer?.name || ''} · $${total}`, 'new-' + event.params.orderId);
});

