import { auth } from '$lib/firebase/client';
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import type { User } from 'firebase/auth';

class AuthState {
  user = $state<User | null>(null);
  loading = $state(true);
  isLoggedIn = $derived(this.user !== null);

  constructor() {
    if (typeof window !== 'undefined' && auth) {
      onAuthStateChanged(auth, (u) => {
        this.user = u;
        this.loading = false;
      });
    } else {
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async logout() {
    await signOut(auth);
  }
}

export const authState = new AuthState();
