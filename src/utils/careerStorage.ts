import { CAREER_STORAGE_KEY } from '../engine/gameLogic';
import { CareerState } from '../types/game';

const DB_NAME = 'pitchCareerDb';
const DB_VERSION = 1;
const STORE_NAME = 'careers';

function openCareerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadSavedCareer(): Promise<CareerState | null> {
  try {
    const db = await openCareerDb();
    const fromIdb = await new Promise<CareerState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(CAREER_STORAGE_KEY);
      getReq.onsuccess = () => resolve((getReq.result as CareerState | undefined) ?? null);
      getReq.onerror = () => reject(getReq.error);
    });
    if (fromIdb && fromIdb.version === 2) {
      return fromIdb;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CAREER_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed && parsed.version === 2) {
      void saveCareerState(parsed);
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveCareerState(state: CareerState): Promise<void> {
  try {
    const db = await openCareerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state, CAREER_STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Keep localStorage clean so quota is never exceeded by large world saves
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(CAREER_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return;
  } catch {
    // Graceful fallback if IndexedDB unavailable (e.g., private mode)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Ignore quota exceeded
    }
  }
}

export async function clearSavedCareer(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CAREER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  try {
    const db = await openCareerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(CAREER_STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
