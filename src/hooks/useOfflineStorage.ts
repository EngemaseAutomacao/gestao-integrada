import { useState, useEffect } from "react";

const CACHE_PREFIX = "engemase_cache_";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheWrapper<T> {
  data: T;
  timestamp: number;
}

export function useOfflineStorage<T>(key: string, initialData: T | null = null, ttlMs: number = DEFAULT_TTL_MS) {
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const cacheKey = `${CACHE_PREFIX}${key}`;

  useEffect(() => {
    loadFromCache();
  }, [key]);

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data !== undefined && parsed?.timestamp !== undefined) {
          const age = Date.now() - parsed.timestamp;
          setIsStale(age > ttlMs);
          setData(parsed.data);
          setSavedAt(parsed.timestamp);
        } else {
          setIsStale(true);
          setData(parsed);
          setSavedAt(null);
        }
      }
    } catch (error) {
      console.error("Error loading from cache:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToCache = (newData: T) => {
    try {
      const now = Date.now();
      const wrapper: CacheWrapper<T> = { data: newData, timestamp: now };
      localStorage.setItem(cacheKey, JSON.stringify(wrapper));
      setData(newData);
      setIsStale(false);
      setSavedAt(now);
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(cacheKey);
    setData(null);
    setIsStale(false);
    setSavedAt(null);
  };

  const getAgeLabel = (): string | null => {
    if (!savedAt) return null;
    const ageMs = Date.now() - savedAt;
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return "Agora mesmo";
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return {
    data,
    isLoading,
    isStale,
    savedAt,
    getAgeLabel,
    saveToCache,
    clearCache,
  };
}
