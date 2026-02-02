/**
 * Database Adapter
 *
 * Provides a unified interface that works with:
 * - Local JSON storage (default, zero config)
 * - Firebase Firestore (optional, for cloud sync)
 *
 * The adapter auto-detects which to use based on environment.
 */

import * as localStore from './localStore.js';

// Lazy-load Firebase only if configured
let firebaseDb = null;
let useFirebase = false;

/**
 * Initialize the database connection
 */
export async function initDb() {
  // Check if Firebase is configured via environment
  const firebaseConfigured = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.USE_FIREBASE === 'true';

  if (firebaseConfigured) {
    try {
      const firebase = await import('./firebase.js');
      firebaseDb = firebase.db;
      useFirebase = true;
      console.log('[DB] Using Firebase Firestore');
    } catch (e) {
      console.log('[DB] Firebase not available, using local storage');
      useFirebase = false;
    }
  } else {
    console.log('[DB] Using local JSON storage');
    useFirebase = false;
  }

  // Initialize defaults for local storage
  if (!useFirebase) {
    await localStore.initializeDefaults();
  }

  return { useFirebase };
}

/**
 * Get a single document
 */
export async function getDoc(collectionName, docId) {
  if (useFirebase && firebaseDb) {
    const { doc, getDoc: fbGetDoc } = await import('firebase/firestore');
    const docRef = doc(firebaseDb, collectionName, docId);
    return fbGetDoc(docRef);
  }
  return localStore.getDoc(collectionName, docId);
}

/**
 * Set a document (create or overwrite)
 */
export async function setDoc(collectionName, docId, data) {
  if (useFirebase && firebaseDb) {
    const { doc, setDoc: fbSetDoc } = await import('firebase/firestore');
    const docRef = doc(firebaseDb, collectionName, docId);
    await fbSetDoc(docRef, data);
    return { id: docId };
  }
  return localStore.setDoc(collectionName, docId, data);
}

/**
 * Delete a document
 */
export async function deleteDoc(collectionName, docId) {
  if (useFirebase && firebaseDb) {
    const { doc, deleteDoc: fbDeleteDoc } = await import('firebase/firestore');
    const docRef = doc(firebaseDb, collectionName, docId);
    await fbDeleteDoc(docRef);
    return { id: docId };
  }
  return localStore.deleteDoc(collectionName, docId);
}

/**
 * Get documents from a collection with ordering and limit
 */
export async function getDocs(collectionName, options = {}) {
  if (useFirebase && firebaseDb) {
    const { collection, query, orderBy, limit, getDocs: fbGetDocs } = await import('firebase/firestore');
    let q = collection(firebaseDb, collectionName);

    const constraints = [];
    if (options.orderBy) {
      constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
    }
    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    return fbGetDocs(q);
  }
  return localStore.getDocs(collectionName, options);
}

/**
 * Add a document with auto-generated ID
 */
export async function addDoc(collectionName, data) {
  if (useFirebase && firebaseDb) {
    const { collection, addDoc: fbAddDoc } = await import('firebase/firestore');
    const collRef = collection(firebaseDb, collectionName);
    return fbAddDoc(collRef, data);
  }
  return localStore.addDoc(collectionName, data);
}

// ============================================
// Settings shortcuts
// ============================================

export async function getSetting(key) {
  const doc = await getDoc('settings', key);
  if (doc.exists()) {
    const data = doc.data();
    return data?.value !== undefined ? data.value : data;
  }
  return null;
}

export async function setSetting(key, value) {
  await setDoc('settings', key, {
    value,
    updatedAt: new Date().toISOString()
  });
}

export async function getAllSettings() {
  const snapshot = await getDocs('settings');
  const settings = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    settings[doc.id] = data?.value !== undefined ? data.value : data;
  });
  return settings;
}

// ============================================
// Status and info
// ============================================

export function getStorageType() {
  return useFirebase ? 'firebase' : 'local';
}

export function getDataDir() {
  return localStore.getDataDir();
}

// Initialize on import
let initialized = false;
export async function ensureInit() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

export default {
  initDb,
  ensureInit,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  addDoc,
  getSetting,
  setSetting,
  getAllSettings,
  getStorageType,
  getDataDir
};
