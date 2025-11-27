
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// --- ÁREA DE CONFIGURAÇÃO ---
// Suas chaves do projeto 'calisbuilder-program'
const firebaseConfig = {
  apiKey: "AIzaSyDHzyC8ekHhQFGFaIaKmFAl-W5zo0DH5cg",
  authDomain: "calisbuilder-program.firebaseapp.com",
  projectId: "calisbuilder-program",
  storageBucket: "calisbuilder-program.firebasestorage.app",
  messagingSenderId: "132457927098",
  appId: "1:132457927098:web:06e4d6d3157a3b3c740d83"
};
// ---------------------------

// Inicialização segura
let app;
let auth: any;
let db: any;
let googleProvider: any;
// Reachability flag for Firestore (in case browser extensions block requests)
// tri-state: null = probe pending, true = reachable, false = unreachable
let isFirestoreReachable: boolean | null = null;

// Verifica se o usuário substituiu a chave padrão (ou se a chave parece válida)
const isFirebaseSetup = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20;

if (isFirebaseSetup) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        console.log("Firebase connected (auth initialized). Performing Firestore reachability probe before instantiating Firestore.");
        // Probe Firestore before creating the SDK DB instance to avoid SDK opening channels that can be blocked by extensions.
        (async () => {
            try {
                const proj = firebaseConfig.projectId;
                const key = firebaseConfig.apiKey;
                const url = `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents?pageSize=1&key=${key}`;
                const res = await fetch(url, { method: 'GET' });
                console.log('[firebase] Firestore reachability probe status:', res.status);
                isFirestoreReachable = true;
                try { db = getFirestore(app); } catch(e) { console.warn('[firebase] could not instantiate firestore after probe', e); }
                // notify listeners
                try { window.dispatchEvent(new CustomEvent('firestore:reachability', { detail: { reachable: true } })); } catch(e) {}
            } catch (err) {
                console.warn('[firebase] Firestore appears to be blocked or unreachable in this environment.', err);
                isFirestoreReachable = false;
                try { window.dispatchEvent(new CustomEvent('firestore:reachability', { detail: { reachable: false, error: String(err) } })); } catch(e) {}
            }
        })();
    } catch (error) {
        console.error("Erro CRÍTICO ao conectar no Firebase.", error);
    }
} else {
    console.warn("⚠️ O Firebase ainda não foi configurado corretamente.");
}

export { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, getDoc, isFirebaseSetup, isFirestoreReachable };
