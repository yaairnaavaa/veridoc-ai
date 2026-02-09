"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { SpecialistDetailView } from "@/app/marketplace/SpecialistDetailView";
import type { UiSpecialist } from "@/app/marketplace/specialists";

export function SpecialistDetailClient() {
  const params = useParams();
  const identifier = typeof params?.id === "string" ? params.id : "";
  const [specialist, setSpecialist] = useState<UiSpecialist | null | "loading">("loading");

  useEffect(() => {
    if (!identifier) {
      setSpecialist(null);
      return;
    }
    let cancelled = false;
    setSpecialist("loading");
    fetch(`/api/specialists/identifier/${encodeURIComponent(identifier)}`)
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: UiSpecialist | null) => {
        if (!cancelled) setSpecialist(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSpecialist(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  if (specialist === "loading") {
    return (
      <div className="min-h-screen bg-[#f6fbfb] flex items-center justify-center">
        <p className="text-slate-500">Cargando especialista...</p>
      </div>
    );
  }

  if (specialist) {
    return <SpecialistDetailView specialist={specialist} />;
  }

  notFound();
}
