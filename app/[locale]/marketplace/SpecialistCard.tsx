"use client";

import { Link } from "@/i18n/navigation";
import {
  Star,
  MapPin,
  Languages,
  CalendarCheck,
  Award,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { UiSpecialist } from "@/lib/marketplace/specialists";

export function SpecialistCard({ specialist }: { specialist: UiSpecialist }) {
  return (
    <Link
      href={`/marketplace/${specialist.id}`}
      className="group relative flex flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur transition-all hover:border-teal-200/60 hover:shadow-md md:flex-row"
    >
      {/* --- Left Column: Photo & Rating --- */}
      <div className="flex shrink-0 flex-col items-center gap-3 md:w-32">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-slate-100 md:h-28 md:w-28">
          <img
            src={specialist.image}
            alt={specialist.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>{specialist.rating.toFixed(1)}</span>
          <span className="font-normal text-amber-600/70">({specialist.reviews})</span>
        </div>
      </div>

      {/* --- Center Column: Main Info --- */}
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 group-hover:text-teal-700">
              {specialist.name}
            </h3>
            {specialist.status === "Verified" && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-teal-600"
                title="Verified"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
            {specialist.status === "Under Review" && (
              <span
                className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                title="Under Review"
              >
                Under Review
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500">{specialist.specialty}</p>
        </div>
        <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-slate-500 md:text-sm">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-slate-400" />
            <span>{specialist.experience} years exp.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Languages className="h-4 w-4 text-slate-400" />
            <span>{specialist.languages.join(", ")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>{specialist.location}</span>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          {specialist.tags.map((tag, idx) => (
            <span
              key={idx}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>
        {(specialist.licenseDocumentUrl || specialist.degreeDocumentUrl) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {specialist.licenseDocumentUrl && (
              <span
                role="link"
                tabIndex={0}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(specialist.licenseDocumentUrl!, "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(specialist.licenseDocumentUrl!, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                Cédula
              </span>
            )}
            {specialist.degreeDocumentUrl && (
              <span
                role="link"
                tabIndex={0}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(specialist.degreeDocumentUrl!, "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(specialist.degreeDocumentUrl!, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                Título
              </span>
            )}
          </div>
        )}
      </div>

      {/* --- Right Column: Price & Action --- */}
      <div className="flex shrink-0 flex-col justify-between gap-4 border-t border-slate-100 pt-4 md:w-48 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div className="space-y-1 text-center md:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Review (blood panel)
          </p>
          <div className="flex items-baseline justify-center gap-1 md:justify-end">
            <span className="text-2xl font-bold text-slate-900">{specialist.priceUsdt}</span>
            <span className="text-sm text-slate-500">USDT</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-600 md:justify-end">
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>Avail: {specialist.availability}</span>
          </div>
          <span className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-slate-800">
            Request second opinion
            <ChevronRight className="h-4 w-4 opacity-70" />
          </span>
          <span className="block w-full text-center text-xs font-medium text-slate-500 group-hover:text-slate-800">
            Ver perfil completo
          </span>
        </div>
      </div>
    </Link>
  );
}
