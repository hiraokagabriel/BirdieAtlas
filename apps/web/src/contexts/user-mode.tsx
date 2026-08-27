"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const USER_MODES = [
  "public",
  "athlete",
  "judge",
  "admin",
  "super-admin",
] as const;

export type UserMode = (typeof USER_MODES)[number];

interface UserModeMetadata {
  label: string;
  description: string;
  icon: string;
}

export const USER_MODE_METADATA: Record<UserMode, UserModeMetadata> = {
  public: {
    label: "Público",
    description: "Visitante sem login",
    icon: "◌",
  },
  athlete: {
    label: "Atleta",
    description: "Área pessoal do competidor",
    icon: "◆",
  },
  judge: {
    label: "Juiz",
    description: "Operação de partidas",
    icon: "✓",
  },
  admin: {
    label: "Admin",
    description: "Gestão da federação",
    icon: "●",
  },
  "super-admin": {
    label: "Super Admin",
    description: "Visão da plataforma",
    icon: "★",
  },
};

interface UserModeContextValue {
  mode: UserMode;
  hydrated: boolean;
  setMode: (mode: UserMode) => void;
}

const UserModeContext = createContext<UserModeContextValue | null>(null);

const STORAGE_KEY = "birdie-atlas:user-mode";

function isUserMode(value: string | null): value is UserMode {
  return value !== null && USER_MODES.includes(value as UserMode);
}

export function UserModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UserMode>("public");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(STORAGE_KEY);
    if (isUserMode(storedMode)) {
      setModeState(storedMode);
    }
    setHydrated(true);
  }, []);

  const value = useMemo<UserModeContextValue>(
    () => ({
      mode,
      hydrated,
      setMode: (nextMode) => {
        setModeState(nextMode);
        window.localStorage.setItem(STORAGE_KEY, nextMode);
      },
    }),
    [hydrated, mode],
  );

  return <UserModeContext.Provider value={value}>{children}</UserModeContext.Provider>;
}

export function useUserMode(): UserModeContextValue {
  const context = useContext(UserModeContext);
  if (!context) {
    throw new Error("useUserMode deve ser usado dentro de UserModeProvider.");
  }
  return context;
}
