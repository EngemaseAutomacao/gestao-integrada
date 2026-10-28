import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Profile as DomainProfile } from "@/types/domain";
import { OFFLINE_CACHE_PREFIX } from "@/hooks/useOfflineStorage";

const PROFILE_CACHE_KEY = "engemase_cached_profile";
const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

type Profile = DomainProfile;

/** Mantido por compatibilidade com o código que usava `user.id` do Supabase. */
interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  /** Mantido por compatibilidade; a sessão agora é um cookie httpOnly. */
  session: { user: AuthUser } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string, keepConnected?: boolean) => Promise<{ error: { message: string } | null }>;
  signUp: (
    username: string,
    password: string,
    fullName: string,
    category: "engemase_employee" | "third_party" | "socios"
  ) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readCachedProfile(): Profile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed?.data || Date.now() - (parsed.cachedAt || 0) > PROFILE_CACHE_TTL) return null;
    return parsed.data as Profile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data: profile, cachedAt: Date.now() }));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // armazenamento indisponível (modo privado etc.)
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    writeCachedProfile(p);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { profile } = await api.get<{ profile: Profile }>("/auth/me");
      setProfile(profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setProfile(null);
        return;
      }
      // Sem conexão: usa o perfil em cache (até 24h) para o modo offline.
      setProfileState(readCachedProfile());
    }
  }, [setProfile]);

  useEffect(() => {
    let mounted = true;
    fetchProfile().finally(() => mounted && setLoading(false));

    // Qualquer resposta 401 da API (sessão expirada/derrubada) desloga no app.
    const onUnauthorized = () => setProfile(null);
    window.addEventListener("engemase:unauthorized", onUnauthorized);
    return () => {
      mounted = false;
      window.removeEventListener("engemase:unauthorized", onUnauthorized);
    };
  }, [fetchProfile, setProfile]);

  const signIn = async (username: string, password: string, keepConnected = true) => {
    try {
      try {
        localStorage.setItem("engemase_keep_connected", keepConnected ? "true" : "false");
      } catch {
        // ignora
      }
      const { profile } = await api.post<{ profile: Profile }>("/auth/login", { username, password, keepConnected });
      queryClient.clear();
      setProfile(profile);
      return { error: null };
    } catch (err) {
      return { error: { message: err instanceof ApiError ? err.message : "Erro ao fazer login" } };
    }
  };

  const signUp = async (
    username: string,
    password: string,
    fullName: string,
    category: "engemase_employee" | "third_party" | "socios"
  ) => {
    try {
      await api.post("/auth/register", { username, password, fullName, category });
      return { error: null };
    } catch (err) {
      return { error: { message: err instanceof ApiError ? err.message : "Erro ao criar conta" } };
    }
  };

  const signOut = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // mesmo offline, limpa o estado local
    }
    setProfile(null);
    queryClient.clear();
    // Em aparelho compartilhado, não deixa dados do usuário anterior guardados.
    // (Operações offline pendentes ficam, para não perder registros.)
    try {
      for (const key of Object.keys(localStorage)) {
        if (key === "engemase_rq_cache" || key.startsWith(OFFLINE_CACHE_PREFIX)) localStorage.removeItem(key);
      }
    } catch {
      // armazenamento indisponível
    }
    navigate("/auth");
  };

  const user: AuthUser | null = profile ? { id: profile.id, email: profile.email } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user ? { user } : null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile: fetchProfile,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
