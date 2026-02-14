"use client";

import { useMemo, useState, useCallback } from "react";
import { Filter, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SpecialistCard } from "./SpecialistCard";
import { AreYouADoctorLink } from "./AreYouADoctorLink";
import { FilterModal, DEFAULT_FILTERS, type MarketplaceFilters } from "./FilterModal";
import type { UiSpecialist } from "@/lib/marketplace/specialists";

function applyFilters(specialists: UiSpecialist[], f: MarketplaceFilters): UiSpecialist[] {
  return specialists.filter((s) => {
    if (f.languages.length > 0) {
      const hasLang = f.languages.some((lang) => s.languages.includes(lang));
      if (!hasLang) return false;
    }
    if (s.experience < f.experienceMin || s.experience > f.experienceMax) return false;
    if (f.specialty && s.specialty !== f.specialty) return false;
    if (f.priceMin != null && s.priceUsdt < f.priceMin) return false;
    if (f.priceMax != null && s.priceUsdt > f.priceMax) return false;
    return true;
  });
}

function hasActiveFilters(f: MarketplaceFilters): boolean {
  return (
    f.languages.length > 0 ||
    f.experienceMin > 0 ||
    f.experienceMax < 99 ||
    !!f.specialty ||
    f.priceMin != null ||
    f.priceMax != null
  );
}

type MarketplaceWithFiltersProps = {
  specialists: UiSpecialist[];
  fromWizard?: boolean;
  analysisId?: string | undefined;
};

export function MarketplaceWithFilters({
  specialists,
}: MarketplaceWithFiltersProps) {
  const t = useTranslations("marketplace");
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);

  const filtered = useMemo(
    () => applyFilters(specialists, filters),
    [specialists, filters]
  );
  const active = hasActiveFilters(filters);

  const handleApply = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <section className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="mb-3 inline-block rounded-full border border-teal-200/60 bg-teal-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-teal-700 backdrop-blur">
            {t("badge")}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AreYouADoctorLink />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur transition ${
              active
                ? "border-teal-200 bg-teal-50/80 text-teal-800 hover:bg-teal-100"
                : "border-slate-200 bg-white/60 text-slate-700 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Filter className="h-4 w-4" />
            {t("filter")}
            {active && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-200/80 text-xs font-bold text-teal-800">
                !
              </span>
            )}
          </button>
        </div>
      </section>

      <FilterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={handleApply}
        specialists={specialists}
      />

      {active && (
        <p className="mb-4 text-sm text-slate-600">
          {t("showingCount", { filtered: filtered.length, total: specialists.length })}
        </p>
      )}

      {filtered.length > 0 ? (
        <section className="grid gap-6">
          {filtered.map((specialist) => (
            <SpecialistCard key={specialist.id} specialist={specialist} />
          ))}
        </section>
      ) : specialists.length > 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 py-16 text-center">
          <p className="text-slate-600">{t("noMatch")}</p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-4 rounded-xl bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-200"
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center">
          <div className="mb-4 rounded-full bg-slate-100 p-4">
            <UserPlus className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{t("noSpecialistsYet")}</h3>
          <p className="text-slate-500 mx-auto mt-2 max-w-md">
            {t("directoryGrowing")}
          </p>
          <Link
            href="/profile/specialist-onboarding"
            className="mt-6 font-semibold text-teal-700 hover:underline"
          >
            {t("registerSpecialist")}
          </Link>
        </div>
      )}
    </>
  );
}
