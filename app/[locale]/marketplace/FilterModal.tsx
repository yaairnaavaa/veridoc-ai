"use client";

import { useCallback, useEffect, useMemo } from "react";
import { X, Languages, Award, Briefcase, DollarSign } from "lucide-react";
import type { UiSpecialist } from "@/lib/marketplace/specialists";

export type MarketplaceFilters = {
  languages: string[];
  experienceMin: number;
  experienceMax: number;
  specialty: string;
  priceMin: number | null;
  priceMax: number | null;
};

const DEFAULT_FILTERS: MarketplaceFilters = {
  languages: [],
  experienceMin: 0,
  experienceMax: 99,
  specialty: "",
  priceMin: null,
  priceMax: null,
};

function getUniqueLanguages(specialists: UiSpecialist[]): string[] {
  const set = new Set<string>();
  specialists.forEach((s) => s.languages.forEach((l) => set.add(l)));
  return Array.from(set).sort();
}

function getUniqueSpecialties(specialists: UiSpecialist[]): string[] {
  const set = new Set(specialists.map((s) => s.specialty).filter(Boolean));
  return Array.from(set).sort();
}

type FilterModalProps = {
  open: boolean;
  onClose: () => void;
  filters: MarketplaceFilters;
  onFiltersChange: (f: MarketplaceFilters) => void;
  onApply: () => void;
  specialists: UiSpecialist[];
};

export function FilterModal({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  specialists,
}: FilterModalProps) {
  const languages = useMemo(() => getUniqueLanguages(specialists), [specialists]);
  const specialties = useMemo(() => getUniqueSpecialties(specialists), [specialists]);

  const toggleLanguage = useCallback(
    (lang: string) => {
      const next = filters.languages.includes(lang)
        ? filters.languages.filter((l) => l !== lang)
        : [...filters.languages, lang];
      onFiltersChange({ ...filters, languages: next });
    },
    [filters, onFiltersChange]
  );

  const clearAll = useCallback(() => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  }, [onFiltersChange]);

  const handleApply = useCallback(() => {
    onApply();
    onClose();
  }, [onApply, onClose]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="filter-modal-title" className="text-xl font-semibold text-slate-900">
            Filter specialists
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Languages */}
          {languages.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Languages className="h-4 w-4 text-teal-600" />
                Language
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.map((lang) => {
                  const checked = filters.languages.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        checked
                          ? "border-teal-300 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLanguage(lang)}
                        className="sr-only"
                      />
                      {lang}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Experience range */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Briefcase className="h-4 w-4 text-teal-600" />
              Years of experience
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={filters.experienceMax}
                value={filters.experienceMin}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    experienceMin: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min={filters.experienceMin}
                max={99}
                value={filters.experienceMax}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    experienceMax: Math.min(99, parseInt(e.target.value, 10) || 50),
                  })
                }
                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
              />
              <span className="text-sm text-slate-500">years</span>
            </div>
          </div>

          {/* Specialty */}
          {specialties.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Award className="h-4 w-4 text-teal-600" />
                Specialty
              </div>
              <select
                value={filters.specialty}
                onChange={(e) => onFiltersChange({ ...filters, specialty: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
              >
                <option value="">All</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Price range */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="h-4 w-4 text-teal-600" />
              Price (USDT)
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.priceMin ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onFiltersChange({
                    ...filters,
                    priceMin: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                  });
                }}
                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.priceMax ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onFiltersChange({
                    ...filters,
                    priceMax: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                  });
                }}
                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={clearAll}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Apply filters
          </button>
        </div>
      </div>
    </>
  );
}

export { DEFAULT_FILTERS };
