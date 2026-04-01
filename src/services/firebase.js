import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB842XFwTkyWdmFJUNcuKGdrmVEINaViNI",
  authDomain: "adaptivetutor-6e974.firebaseapp.com",
  projectId: "adaptivetutor-6e974",
  storageBucket: "adaptivetutor-6e974.firebasestorage.app",
  messagingSenderId: "111057448166",
  appId: "1:111057448166:web:5f1e30ec4161f780a81f27"
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;