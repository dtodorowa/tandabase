import { db } from './client';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp
} from 'firebase/firestore';
import type { PracticaSet, VideoFlag, Comment } from '$lib/types';

function setsRef() {
  if (!db) throw new Error('Firebase not configured');
  return collection(db, 'sets');
}

export async function createSet(set: Omit<PracticaSet, 'id' | 'created_at' | 'updated_at'>) {
  const docRef = await addDoc(setsRef(), {
    ...set,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSet(id: string, data: Partial<PracticaSet>) {
  await updateDoc(doc(db, 'sets', id), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteSet(id: string) {
  await deleteDoc(doc(db, 'sets', id));
}

export async function getSet(id: string): Promise<PracticaSet | null> {
  const snap = await getDoc(doc(db, 'sets', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PracticaSet;
}

export async function getUserSets(userId: string): Promise<PracticaSet[]> {
  try {
    const q = query(setsRef(), where('authorId', '==', userId), orderBy('updated_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as PracticaSet);
  } catch (e: any) {
    // If composite index is missing, fall back to unordered query
    if (e.code === 'failed-precondition' || e.message?.includes('index')) {
      console.warn('[Firestore] Composite index missing for authorId+updated_at, falling back to unordered query. Create the index at:', e.message);
      const q = query(setsRef(), where('authorId', '==', userId));
      const snap = await getDocs(q);
      const sets = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PracticaSet);
      return sets.sort((a, b) => {
        const aTime = a.updated_at instanceof Date ? a.updated_at.getTime() : 0;
        const bTime = b.updated_at instanceof Date ? b.updated_at.getTime() : 0;
        return bTime - aTime;
      });
    }
    throw e;
  }
}

/**
 * Replace a song's video within a set. Reads the full set, patches the song, writes back.
 */
export async function replaceSongVideo(
  setId: string,
  tandaIndex: number,
  songIndex: number,
  videoData: { video_id: string; video_title: string; thumbnail: string }
): Promise<void> {
  const snap = await getDoc(doc(db, 'sets', setId));
  if (!snap.exists()) throw new Error('Set not found');
  const data = snap.data();
  const tandas = data.tandas as any[];
  if (!tandas[tandaIndex]?.songs?.[songIndex]) throw new Error('Song not found in set');
  tandas[tandaIndex].songs[songIndex] = {
    ...tandas[tandaIndex].songs[songIndex],
    ...videoData,
  };
  await updateDoc(doc(db, 'sets', setId), {
    tandas,
    updated_at: serverTimestamp(),
  });
}

function flagsRef() {
  if (!db) throw new Error('Firebase not configured');
  return collection(db, 'flags');
}

export async function createFlag(flag: Omit<VideoFlag, 'id' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(flagsRef(), {
    ...flag,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function getFlagsForSet(setId: string): Promise<VideoFlag[]> {
  const q = query(flagsRef(), where('setId', '==', setId), where('resolved', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as VideoFlag);
}

export async function resolveFlag(flagId: string): Promise<void> {
  await updateDoc(doc(db, 'flags', flagId), { resolved: true });
}

export async function getFlagsForOwner(ownerId: string): Promise<VideoFlag[]> {
  try {
    const q = query(flagsRef(), where('ownerId', '==', ownerId), where('resolved', '==', false), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as VideoFlag);
  } catch (e: any) {
    if (e.code === 'failed-precondition' || e.message?.includes('index')) {
      console.warn('[Firestore] Index missing for flags ownerId+resolved, falling back.');
      const q = query(flagsRef(), where('ownerId', '==', ownerId), where('resolved', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as VideoFlag);
    }
    throw e;
  }
}

// ── Comments ──
function commentsRef() {
  if (!db) throw new Error('Firebase not configured');
  return collection(db, 'comments');
}

export async function createComment(comment: Omit<Comment, 'id' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(commentsRef(), {
    ...comment,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function getCommentsForSet(setId: string): Promise<Comment[]> {
  try {
    const q = query(commentsRef(), where('setId', '==', setId), orderBy('created_at', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment);
  } catch (e: any) {
    if (e.code === 'failed-precondition' || e.message?.includes('index')) {
      console.warn('[Firestore] Index missing for comments setId+created_at, falling back.');
      const q = query(commentsRef(), where('setId', '==', setId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment);
    }
    throw e;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId));
}

// ── Feedback ──
function feedbackRef() {
  if (!db) throw new Error('Firebase not configured');
  return collection(db, 'feedback');
}

export async function submitFeedback(feedback: {
  message: string;
  name: string;
  userId?: string;
}): Promise<string> {
  const docRef = await addDoc(feedbackRef(), {
    ...feedback,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPublicSets(maxCount = 50): Promise<PracticaSet[]> {
  try {
    const q = query(
      setsRef(),
      where('visibility', '==', 'public'),
      orderBy('updated_at', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as PracticaSet);
  } catch (e: any) {
    if (e.code === 'failed-precondition' || e.message?.includes('index')) {
      console.warn('[Firestore] Composite index missing for visibility+updated_at, falling back.');
      const q = query(setsRef(), where('visibility', '==', 'public'));
      const snap = await getDocs(q);
      const sets = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PracticaSet);
      return sets.sort((a, b) => {
        const aTime = a.updated_at instanceof Date ? a.updated_at.getTime() : 0;
        const bTime = b.updated_at instanceof Date ? b.updated_at.getTime() : 0;
        return bTime - aTime;
      });
    }
    throw e;
  }
}
