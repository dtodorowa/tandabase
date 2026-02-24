import { auth } from './client';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  return firebaseSignOut(auth);
}
