import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAQIamulztL-0FYMCpUTqXcXXWL9cXqqOE",
  authDomain: "ai-crypto-97ae9.firebaseapp.com",
  projectId: "ai-crypto-97ae9",
  storageBucket: "ai-crypto-97ae9.firebasestorage.app",
  messagingSenderId: "416160516722",
  appId: "1:416160516722:web:11b480063229e0ad9d50eb",
  measurementId: "G-PYG48MH9JN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

