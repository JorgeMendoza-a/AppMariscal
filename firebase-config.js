// =====================================================================
//  CONEXIÓN A FIREBASE
//  1. Crea un proyecto gratis en https://console.firebase.google.com
//  2. Agrega una "App web" y copia aquí los datos de configuración.
//  3. Mira el README (sección "Configurar Firebase") para los pasos completos.
//
//  Si se pone en null la app funciona en MODO DEMO: las cuentas y
//  pedidos se guardan solo en el dispositivo (sirve para probar).
//  Estos datos NO son secretos; la seguridad la dan las reglas (firestore.rules).
// =====================================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyARDPQpoy7g3e0LGILlR35DiYA54GONAHQ",
  authDomain: "mariscal-shop.firebaseapp.com",
  projectId: "mariscal-shop",
  storageBucket: "mariscal-shop.firebasestorage.app",
  messagingSenderId: "401767664262",
  appId: "1:401767664262:web:39cfa69137f79e9d91df07",
  measurementId: "G-960004LCXY"
};

/* Ejemplo:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "mariscal-shop.firebaseapp.com",
  projectId: "mariscal-shop",
  storageBucket: "mariscal-shop.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
*/
