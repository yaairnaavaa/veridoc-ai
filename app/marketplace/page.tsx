"use client";

import { useMemo, useState } from "react";

type CaseStatus = "Pending" | "Urgent" | "Assigned" | "Closed";

type MarketplaceCase = {
  id: string;
  title: string;
  specialty: string;
  publishedAt: string;
  budgetUsd: number;
  status: CaseStatus;
  category: "Hematology" | "Biochemistry" | "Immunology" | "Cardiology";
  attachment: {
    name: string;
    type: string; // mime type: application/pdf | image/*
  };
};

const describeFileType = (mimeType: string) => {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  return "File";
};

const statusLabel = (status: CaseStatus) => {
  switch (status) {
    case "Urgent":
      return "Urgent";
    case "Pending":
      return "Pending";
    case "Assigned":
      return "Assigned";
    case "Closed":
      return "Closed";
  }
};

const FILTERS = ["Pending", "Urgent", "Biochemistry", "Immunology"] as const;
type FilterKey = (typeof FILTERS)[number];

const MOCK_CASES: MarketplaceCase[] = [
  {
    id: "case-001",
    title: "Persistent microcytic anemia with borderline ferritin",
    specialty: "Second opinion",
    publishedAt: "2026-01-20",
    budgetUsd: 45,
    status: "Pending",
    category: "Hematology",
    attachment: { name: "cbc-january.pdf", type: "application/pdf" },
  },
  {
    id: "case-002",
    title: "Elevated transaminases and fatigue: review hepatic panel",
    specialty: "Lab interpretation",
    publishedAt: "2026-01-23",
    budgetUsd: 60,
    status: "Urgent",
    category: "Biochemistry",
    attachment: { name: "hepatic-panel.jpg", type: "image/jpeg" },
  },
  {
    id: "case-003",
    title: "Positive ANA with nonspecific symptoms: immunology perspective",
    specialty: "Results review",
    publishedAt: "2026-01-18",
    budgetUsd: 75,
    status: "Pending",
    category: "Immunology",
    attachment: { name: "ana-results.png", type: "image/png" },
  },
  {
    id: "case-004",
    title: "High LDL despite diet: cardiovascular risk review and plan",
    specialty: "Second opinion",
    publishedAt: "2026-01-14",
    budgetUsd: 50,
    status: "Assigned",
    category: "Cardiology",
    attachment: { name: "lipid-profile.pdf", type: "application/pdf" },
  },
];

const StatusBadge = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-1 text-xs text-slate-600">
      {children}
    </span>
  );
};

const FilterPill = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border bg-white/80 px-4 py-2 text-xs font-semibold transition ${active
        ? "border-slate-300 text-slate-900"
        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
        }`}
    >
      {children}
    </button>
  );
};

const AbstractAvatar = () => {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-slate-200/70">
      <span className="h-4 w-4 rounded-full bg-gradient-to-br from-teal-500 to-sky-500" />
    </span>
  );
};

const formatDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const formatUsd = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function MarketplacePage() {
  const [selectedCase, setSelectedCase] = useState<MarketplaceCase | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set(),
  );

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const has = (key: FilterKey) => activeFilters.has(key);

    return MOCK_CASES.filter((item) => {
      if (has("Pending") && item.status !== "Pending") return false;
      if (has("Urgent") && item.status !== "Urgent") return false;
      if (has("Biochemistry") && item.category !== "Biochemistry") return false;
      if (has("Immunology") && item.category !== "Immunology") return false;

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });
  }, [activeFilters, query]);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f6fbfb] text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-teal-200/50 via-sky-200/40 to-white blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-40 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-200/40 via-emerald-200/30 to-white blur-3xl" />

        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-8 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <AbstractAvatar />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight">
                Veridoc Marketplace
              </span>
              <span className="text-xs text-slate-500">
                Medical second opinions · Privacy-first
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              Back to Veridoc
            </a>
            <button
              type="button"
              className="hidden md:inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Post a case
            </button>

          </div>
        </header>

        <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 sm:px-8 lg:px-10">
          <section className="grid gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="w-fit rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-600 shadow-sm backdrop-blur">
                  Marketplace
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Second-opinion cases, ready to review
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Browse real requests. Filter by urgency or specialty and apply
                  in one click. Calm, minimal UI—clear, confident, and coherent
                  with Veridoc.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 lg:max-w-md">
                <label className="text-xs font-semibold text-slate-600">
                  Search cases
                </label>
                <div className="rounded-3xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., anemia, ANA, hepatic panel…"
                    className="w-full bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    aria-label="Search cases"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((filter) => (
                <FilterPill
                  key={filter}
                  active={activeFilters.has(filter)}
                  onClick={() => toggleFilter(filter)}
                >
                  {filter}
                </FilterPill>
              ))}
              {activeFilters.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveFilters(new Set())}
                  className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCases.map((item) => (
                <article
                  key={item.id}
                  className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AbstractAvatar />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.category}
                        </span>
                        <span className="text-xs text-slate-500">
                          Posted {formatDate(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                    <StatusBadge>{statusLabel(item.status)}</StatusBadge>
                  </div>

                  <h2 className="mt-4 text-lg font-semibold leading-snug text-slate-900">
                    {item.title}
                  </h2>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge>{item.specialty}</StatusBadge>
                    <StatusBadge>
                      {describeFileType(item.attachment.type)} ·{" "}
                      {item.attachment.name}
                    </StatusBadge>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">Budget</span>
                      <span className="text-base font-semibold text-slate-900">
                        {formatUsd(item.budgetUsd)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCase(item)}
                        className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        View details
                      </button>

                      <button
                        type="button"
                        className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {filteredCases.length === 0 ? (
              <div className="rounded-3xl border border-white/70 bg-white/80 p-8 text-center text-sm text-slate-600 shadow-sm backdrop-blur">
                No cases match your filters. Try clearing filters or searching
                with a different keyword.
              </div>
            ) : null}
          </section>

          <section className="mt-14 grid gap-4">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              Trust signals
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Flow designed for medical confidentiality",
                "Profiles and applications with minimal friction",
                "Minimal design consistent with Veridoc",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 px-5 py-4 text-sm text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
          {selectedCase && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>

                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedCase.title}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Specialty: {selectedCase.specialty}
                </p>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>
                    <strong>Category:</strong> {selectedCase.category}
                  </p>
                  <p>
                    <strong>Status:</strong> {statusLabel(selectedCase.status)}
                  </p>
                  <p>
                    <strong>Budget:</strong> {formatUsd(selectedCase.budgetUsd)}
                  </p>
                  <p>
                    <strong>Attachment:</strong>{" "}
                    {describeFileType(selectedCase.attachment.type)} ·{" "}
                    {selectedCase.attachment.name}
                  </p>
                  <p>
                    <strong>Published:</strong>{" "}
                    {formatDate(selectedCase.publishedAt)}
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="rounded-full border px-5 py-2 text-sm font-semibold"
                  >
                    Close
                  </button>
                  <button className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl text-white shadow-lg transition hover:bg-slate-800 md:hidden"
            aria-label="Post a case"
          >
            +
          </button>


        </main>
      </div>
    </div>
  );
}

