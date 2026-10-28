const DB_NAME = "engemase_offline_photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

export interface OfflinePhoto {
  id: string; // operationId + "_" + angleKey
  operationId: string;
  angleKey: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("operationId", "operationId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflinePhoto(
  operationId: string,
  angleKey: string,
  file: File
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const photo: OfflinePhoto = {
    id: `${operationId}_${angleKey}`,
    operationId,
    angleKey,
    blob: file,
    fileName: file.name,
    mimeType: file.type,
    createdAt: Date.now(),
  };

  store.put(photo);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPhotosByOperation(operationId: string): Promise<OfflinePhoto[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("operationId");

  return new Promise((resolve, reject) => {
    const request = index.getAll(operationId);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deletePhotosByOperation(operationId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("operationId");

  const request = index.getAllKeys(operationId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      for (const key of request.result) {
        store.delete(key);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function clearAllOfflinePhotos(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getOfflinePhotosCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}
