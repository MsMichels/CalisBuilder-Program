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

// Inicialização
let app;
let auth: any;
let db: any;
let googleProvider: any;

// Definimos como true por padrão para não bloquear o app baseado em testes de API REST
// O SDK do Firebase gerencia a conectividade interna e offline automaticamente.
let isFirestoreReachable: boolean | null = true;

// Verifica se a chave parece válida
const isFirebaseSetup = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20;

if (isFirebaseSetup) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        // Inicializa o Firestore diretamente sem o "probe" de fetch manual
        // Isso evita o erro 403/bloqueio CORS na Vercel
        db = getFirestore(app);
        
        googleProvider = new GoogleAuthProvider();
        
        console.log("Firebase initialized successfully.");

        // Dispara o evento de sucesso para compatibilidade com o useAppStore
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('firestore:reachability', { detail: { reachable: true } }));
            }, 50);
        }

    } catch (error) {
        console.error("Erro CRÍTICO ao conectar no Firebase.", error);
        isFirestoreReachable = false;
    }
} else {
    console.warn("⚠️ O Firebase ainda não foi configurado corretamente.");
    isFirestoreReachable = false;
}

export { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, getDoc, isFirebaseSetup, isFirestoreReachable };