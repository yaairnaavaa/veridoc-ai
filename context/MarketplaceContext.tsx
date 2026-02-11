"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { UiSpecialist } from "@/lib/marketplace/specialists";

type MarketplaceContextValue = {
  specialists: UiSpecialist[];
  setSpecialists: (list: UiSpecialist[]) => void;
  getSpecialistById: (id: string) => UiSpecialist | null;
};

const defaultValue: MarketplaceContextValue = {
  specialists: [],
  setSpecialists: () => {},
  getSpecialistById: () => null,
};

const MarketplaceContext = createContext<MarketplaceContextValue>(defaultValue);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [specialists, setSpecialistsState] = useState<UiSpecialist[]>([]);

  const setSpecialists = useCallback((list: UiSpecialist[]) => {
    setSpecialistsState(list);
  }, []);

  const getSpecialistById = useCallback(
    (id: string) => specialists.find((s) => s.id === id) ?? null,
    [specialists]
  );

  const value: MarketplaceContextValue = {
    specialists,
    setSpecialists,
    getSpecialistById,
  };

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) {
    throw new Error("useMarketplace must be used within MarketplaceProvider");
  }
  return ctx;
}
