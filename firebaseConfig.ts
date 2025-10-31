
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCmRGvTQ8i1RgI86LtuHVIf7H_gNTFvOA",
  authDomain: "ptodo-web.firebaseapp.com",
  projectId: "ptodo-web",
  storageBucket: "ptodo-web.firebasestorage.app",
  messagingSenderId: "930844249363",
  appId: "1:930844249363:web:e2ffc509b02d04f7cc1ee6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);