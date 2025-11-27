
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

// Verifica se o usuário substituiu a chave padrão (ou se a chave parece válida)
const isFirebaseSetup = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20;

if (isFirebaseSetup) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        console.log("Firebase conectado com sucesso.");
    } catch (error) {
        console.error("Erro CRÍTICO ao conectar no Firebase.", error);
    }
} else {
    console.warn("⚠️ O Firebase ainda não foi configurado corretamente.");
}

export { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, getDoc, isFirebaseSetup };
