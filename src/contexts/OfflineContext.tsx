import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { getPhotosByOperation, deletePhotosByOperation, clearAllOfflinePhotos, getOfflinePhotosCount } from "@/hooks/useOfflinePhotos";
import { uploadFileImage } from "@/lib/storageUtils";
import { api } from "@/lib/api";

interface PendingOperation {
  id: string;
  type: "checkout" | "checkin" | "vehicle_checkout" | "vehicle_checkin";
  data: any;
  timestamp: number;
  retryCount: number;
  lastError: string | null;
  permanent_failure: boolean;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingOperations: PendingOperation[];
  failedOperations: PendingOperation[];
  addPendingOperation: (type: PendingOperation["type"], data: any) => string;
  clearPendingOperations: () => void;
  syncPendingOperations: () => Promise<void>;
  dismissFailedOperation: (id: string) => void;
  retryFailedOperation: (id: string) => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEY = "engemase_pending_operations";
const FAILED_KEY = "engemase_failed_operations";
const ID_MAP_KEY = "engemase_local_to_server_ids";
const MAX_RETRIES = 5;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {
    console.error("localStorage.setItem failed:", e);
  }
}

function isRecoverableError(error: any): boolean {
  if (!error) return true;
  const msg = typeof error === "string" ? error : error?.message || "";
  const code = error?.code || error?.status || 0;
  // Network errors
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network")) return true;
  // HTTP recoverable
  if ([408, 429, 500, 502, 503, 504].includes(code)) return true;
  // Permanent errors: conflict, bad request, not found
  if ([400, 404, 409, 422].includes(code)) return false;
  // Default to recoverable
  return true;
}

function getBackoffMs(retryCount: number): number {
  // Exponential backoff: 2s, 4s, 8s, 16s, 30s (cap)
  const base = Math.min(2000 * Math.pow(2, retryCount), 30000);
  // ±25% jitter to avoid thundering herd when multiple clients reconnect simultaneously
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(500, Math.round(base + jitter));
}

// ID mapping for local-to-server resolution
function getIdMap(): Record<string, string> {
  return loadFromStorage(ID_MAP_KEY, {});
}
function setIdMap(map: Record<string, string>) {
  saveToStorage(ID_MAP_KEY, map);
}
function clearIdMap() {
  localStorage.removeItem(ID_MAP_KEY);
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>(() =>
    loadFromStorage(STORAGE_KEY, [])
  );
  const [failedOperations, setFailedOperations] = useState<PendingOperation[]>(() =>
    loadFromStorage(FAILED_KEY, [])
  );

  const pendingOpsRef = useRef(pendingOperations);
  pendingOpsRef.current = pendingOperations;

  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const isSyncing = useRef(false);
  const syncPendingOperationsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    saveToStorage(STORAGE_KEY, pendingOperations);
  }, [pendingOperations]);

  useEffect(() => {
    saveToStorage(FAILED_KEY, failedOperations);
  }, [failedOperations]);

  const addPendingOperation = useCallback((type: PendingOperation["type"], data: any): string => {
    const id = crypto.randomUUID();
    const operation: PendingOperation = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      lastError: null,
      permanent_failure: false,
    };
    setPendingOperations((prev) => [...prev, operation]);

    // Register Background Sync if available
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready.then(sw => {
        (sw as any).sync?.register?.("sync-pending").catch(() => {});
      }).catch(() => {});
    }

    // If we're online, trigger sync immediately (next tick to ensure state is committed)
    if (isOnlineRef.current) {
      setTimeout(() => syncPendingOperationsRef.current?.(), 100);
    }

    return id;
  }, []);

  const clearPendingOperations = useCallback(() => {
    setPendingOperations([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const dismissFailedOperation = useCallback((id: string) => {
    setFailedOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const retryFailedOperation = useCallback((id: string) => {
    setFailedOperations(prev => {
      const op = prev.find(o => o.id === id);
      if (!op) return prev;
      setPendingOperations(p => [
        ...p,
        { ...op, retryCount: 0, lastError: null, permanent_failure: false },
      ]);
      if (isOnlineRef.current) {
        setTimeout(() => syncPendingOperationsRef.current?.(), 100);
      }
      return prev.filter(o => o.id !== id);
    });
  }, []);

  const syncPhotosForOperation = useCallback(async (op: PendingOperation) => {
    const photos = await getPhotosByOperation(op.id);
    if (photos.length === 0) return {};

    const photoUrls: Record<string, string> = {};
    const folder = op.type === "vehicle_checkout" ? "saidas" : "entradas";
    const suffix = op.type === "vehicle_checkout" ? "out" : "in";

    for (const photo of photos) {
      const prefix = `${photo.angleKey}_${suffix}`;
      const blob = new File([photo.blob], photo.fileName, { type: photo.blob.type || "image/jpeg" });
      const url = await uploadFileImage(blob, prefix, "veiculos", folder);

      // Todas as posições (inclui controle, interior e rodas — antes eram descartadas offline).
      photoUrls[`photo_${photo.angleKey}_${op.type === "vehicle_checkout" ? "checkout" : "checkin"}`] = url;
    }

    await deletePhotosByOperation(op.id);
    return photoUrls;
  }, []);

  // Sync photos stored in IndexedDB for tool operations
  const syncGenericPhotos = useCallback(async (op: PendingOperation) => {
    const photos = await getPhotosByOperation(op.id);
    if (photos.length === 0) return null;

    // Upload first photo found
    const photo = photos[0];
    const blob = new File([photo.blob], photo.fileName, { type: photo.blob.type || "image/jpeg" });
    const { uploadFileImage: uploadFn } = await import("@/lib/storageUtils");
    const isReturn = op.type === "checkin";
    const folder = isReturn ? "entradas" : "saidas";
    const url = await uploadFn(blob, "photo", "ferramentas", folder);
    await deletePhotosByOperation(op.id);
    return url;
  }, []);

  const syncPendingOperations = useCallback(async () => {
    const ops = pendingOpsRef.current;
    if (!isOnlineRef.current || ops.length === 0 || isSyncing.current) return;

    isSyncing.current = true;
    let successCount = 0;
    const retryOps: PendingOperation[] = [];
    const newFailed: PendingOperation[] = [];
    const idMap = getIdMap();

    for (const op of ops) {
      try {
        if (op.type === "checkout") {
          // Upload photo from IndexedDB if available
          const photoUrl = await syncGenericPhotos(op);
          if (photoUrl && !op.data.checkout_photo_url) {
            op.data.checkout_photo_url = photoUrl;
          }
          // client_op_id evita duplicar a retirada se o envio for repetido.
          await api.post("/tool-checkouts", { ...op.data, client_op_id: op.id });

        } else if (op.type === "checkin") {
          // Resolve local ID if needed
          const realId = idMap[op.data.checkoutId] ?? op.data.checkoutId;
          // Upload photo from IndexedDB if available
          const photoUrl = await syncGenericPhotos(op);
          if (photoUrl && !op.data.updates.checkin_photo_url) {
            op.data.updates.checkin_photo_url = photoUrl;
          }
          await api.post("/tool-checkouts/checkin", {
            ids: [realId],
            checkin_date: op.data.updates.checkin_date,
            notes: op.data.updates.notes,
            checkin_photo_url: op.data.updates.checkin_photo_url,
          });

        } else if (op.type === "vehicle_checkout") {
          const photoUrls = await syncPhotosForOperation(op);
          const insertData = { ...op.data, ...photoUrls, client_op_id: op.id };
          const data = await api.post<{ id: string }>("/vehicle-checkouts", insertData);
          // Map local ID for vehicle_checkin
          if (data?.id && op.data._local_id) {
            idMap[op.data._local_id] = data.id;
            delete op.data._local_id;
          }

        } else if (op.type === "vehicle_checkin") {
          // Resolve local checkout ID
          const realCheckoutId = idMap[op.data.checkoutId] ?? op.data.checkoutId;
          const photoUrls = await syncPhotosForOperation(op);
          const updateData = { ...op.data.updates, ...photoUrls };
          await api.post(`/vehicle-checkouts/${realCheckoutId}/checkin`, updateData);
        }

        successCount++;
      } catch (error: any) {
        console.error("Erro ao sincronizar operação:", error);
        const errMsg = error?.message || String(error);

        if (isRecoverableError(error) && op.retryCount < MAX_RETRIES) {
          retryOps.push({
            ...op,
            retryCount: op.retryCount + 1,
            lastError: errMsg,
          });
        } else {
          newFailed.push({
            ...op,
            lastError: errMsg,
            permanent_failure: true,
          });
        }
      }
    }

    // Save ID map
    setIdMap(idMap);

    if (successCount > 0) {
      toast.success(`${successCount} operação(ões) sincronizada(s) com sucesso!`);
    }

    if (newFailed.length > 0) {
      toast.error(`${newFailed.length} operação(ões) falharam permanentemente.`);
      setFailedOperations(prev => [...prev, ...newFailed]);
    }

    // Remove só as operações processadas nesta rodada; as adicionadas durante a
    // sincronização continuam na fila (antes eram apagadas junto).
    const processedIds = new Set(ops.map((o) => o.id));
    const addedDuringSync = pendingOpsRef.current.filter((o) => !processedIds.has(o.id));
    if (retryOps.length > 0 || addedDuringSync.length > 0) {
      if (retryOps.length > 0) toast.warning(`${retryOps.length} operação(ões) serão tentadas novamente.`);
      setPendingOperations([...retryOps, ...addedDuringSync]);
    } else {
      clearPendingOperations();
      // Clean up ID map only if NO failures (pending or permanent)
      if (newFailed.length === 0) {
        clearIdMap();
        // Only clear ALL photos when nothing pending/failed remains
        try {
          const remainingPhotos = await getOfflinePhotosCount();
          if (remainingPhotos > 0) {
            await clearAllOfflinePhotos();
            console.log("IndexedDB photos cleaned up after full sync");
          }
        } catch (e) {
          console.error("Error cleaning IndexedDB:", e);
        }
      }
    }

    isSyncing.current = false;

    // Schedule retry with backoff for recoverable ops
    if (retryOps.length > 0) {
      const maxRetry = Math.max(...retryOps.map(o => o.retryCount));
      const delay = getBackoffMs(maxRetry);
      setTimeout(() => {
        if (isOnlineRef.current) syncPendingOperations();
      }, delay);
    }
  }, [syncPhotosForOperation, syncGenericPhotos, clearPendingOperations]);

  // Keep ref in sync so addPendingOperation can trigger immediate sync
  useEffect(() => {
    syncPendingOperationsRef.current = syncPendingOperations;
  }, [syncPendingOperations]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restaurada! Sincronizando dados...");
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Você está offline. As operações serão sincronizadas quando a conexão for restaurada.");
    };

    // Listen for Background Sync trigger from SW
    const handleSwSync = () => {
      if (navigator.onLine) syncPendingOperations();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sw-trigger-sync", handleSwSync);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sw-trigger-sync", handleSwSync);
    };
  }, [syncPendingOperations]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingOperations,
        failedOperations,
        addPendingOperation,
        clearPendingOperations,
        syncPendingOperations,
        dismissFailedOperation,
        retryFailedOperation,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return context;
}
