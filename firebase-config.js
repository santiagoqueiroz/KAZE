// Configuração única do Firebase: todas as páginas importam app, auth e db daqui
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.firebasestorage.app",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Páginas com <meta name="kaze-cache"> (o sistema novo) guardam uma cópia dos dados no aparelho:
// ao reabrir em menos de 30 minutos, o banco só manda (e só cobra) o que mudou
const comCache = !!document.querySelector('meta[name="kaze-cache"]');
export const db = comCache
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : getFirestore(app);
