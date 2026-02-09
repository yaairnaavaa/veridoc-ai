"use client";

import { useEffect } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import type { UiSpecialist } from "@/app/marketplace/specialists";

export function HydrateSpecialists({ specialists }: { specialists: UiSpecialist[] }) {
  const { setSpecialists } = useMarketplace();

  useEffect(() => {
    setSpecialists(specialists);
  }, [specialists, setSpecialists]);

  return null;
}
