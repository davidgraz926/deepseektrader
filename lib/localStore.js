/**
 * Local JSON Storage - Firebase Replacement
 *
 * Drop-in replacement for Firebase Firestore using local JSON files.
 * Zero external dependencies, works offline.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.clawdbot-data');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Get path to a collection's JSON file
function getCollectionPath(collectionName) {
  ensureDataDir();
  return path.join(DATA_DIR, `${collectionName}.json`);
}

// Read a collection (returns object with doc IDs as keys)
function readCollection(collectionName) {
  const filePath = getCollectionPath(collectionName);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${collectionName}:`, e.message);
    return {};
  }
}

// Write a collection
function writeCollection(collectionName, data) {
  const filePath = getCollectionPath(collectionName);
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ============================================
// Firestore-like API
// ============================================

/**
 * Get a single document
 */
export async function getDoc(collectionName, docId) {
  const collection = readCollection(collectionName);
  const data = collection[docId];
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: docId
  };
}

/**
 * Set a document (create or overwrite)
 */
export async function setDoc(collectionName, docId, data) {
  const collection = readCollection(collectionName);
  collection[docId] = {
    ...data,
    _updatedAt: new Date().toISOString()
  };
  writeCollection(collectionName, collection);
  return { id: docId };
}

/**
 * Delete a document
 */
export async function deleteDoc(collectionName, docId) {
  const collection = readCollection(collectionName);
  delete collection[docId];
  writeCollection(collectionName, collection);
  return { id: docId };
}

/**
 * Get all documents in a collection with optional ordering and limit
 */
export async function getDocs(collectionName, options = {}) {
  const collection = readCollection(collectionName);
  let docs = Object.entries(collection).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true
  }));

  // Sort by field if specified
  if (options.orderBy) {
    const { field, direction = 'asc' } = options.orderBy;
    docs.sort((a, b) => {
      const aVal = a.data()[field];
      const bVal = b.data()[field];
      if (direction === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });
  }

  // Apply limit
  if (options.limit) {
    docs = docs.slice(0, options.limit);
  }

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn) => docs.forEach(fn)
  };
}

/**
 * Add a document with auto-generated ID
 */
export async function addDoc(collectionName, data) {
  const docId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await setDoc(collectionName, docId, data);
  return { id: docId };
}

// ============================================
// Helper: Migrate from Firebase export (optional)
// ============================================

export async function importFromJson(collectionName, jsonData) {
  writeCollection(collectionName, jsonData);
}

// ============================================
// Settings shortcuts (most common operations)
// ============================================

export async function getSetting(key) {
  const doc = await getDoc('settings', key);
  if (doc.exists()) {
    return doc.data().value;
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
    settings[doc.id] = doc.data().value;
  });
  return settings;
}

// ============================================
// Initialize with defaults if needed
// ============================================

export async function initializeDefaults() {
  const testMode = await getSetting('test_mode');
  if (testMode === null) {
    // First run - set up defaults
    await setSetting('test_mode', true);
    await setSetting('test_balance', 10000);

    // Initialize test portfolio
    await setDoc('test_portfolio', 'current', {
      accountValue: 10000,
      availableCash: 10000,
      totalReturn: 0,
      positions: [],
      lastUpdated: new Date().toISOString()
    });

    console.log('Initialized default settings');
  }
}

// ============================================
// Data location info
// ============================================

export function getDataDir() {
  return DATA_DIR;
}

export default {
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  addDoc,
  getSetting,
  setSetting,
  getAllSettings,
  initializeDefaults,
  getDataDir,
  importFromJson
};
