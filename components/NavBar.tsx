"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeLogin } from "@/components/HomeLogin";

export type NavBarProps = {
  /** When provided (e.g. in wizard), shown on the left instead of only logo */
  leftSlot?: React.ReactNode;
  /** When "wizard", primary CTA becomes "Clear session" and calls onClearSession */
  variant?: "default" | "wizard";
  onClearSession?: () => void;
};

const MAIN_NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/analisis", label: "Análisis" },
] as const;

export function NavBar({
  leftSlot,
  variant = "default",
  onClearSession,
}: NavBarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((prev) => !prev), []);

  const isWizard = pathname === "/veridoc";

  const navItems = MAIN_NAV.map((item) => ({ href: item.href, label: item.label }));

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, closeMenu]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const ctaHref = "/veridoc";
  const ctaLabel = isWizard ? "Clear session" : "Start";

  return (
    <header className="relative z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: slot (wizard) or logo */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {leftSlot != null ? (
            leftSlot
          ) : (
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 rounded-lg py-2 outline-offset-2 focus:outline focus:ring-2 focus:ring-slate-400"
              aria-label="Veridoc home"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 shadow-sm sm:h-8 sm:w-8 sm:rounded-lg">
                <span className="h-4 w-4 rounded-full bg-white/90 sm:h-3 sm:w-3" />
              </span>
              <span className="text-base font-semibold tracking-tight text-slate-900 sm:text-sm">
                Veridoc
              </span>
            </Link>
          )}
        </div>

        {/* Desktop: center nav (optional) + right auth & CTA */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-2 h-8 w-px bg-slate-200" />
          <HomeLogin variant="inline" showHelpInHeader={false} />
          {variant === "wizard" && onClearSession ? (
            <button
              type="button"
              onClick={onClearSession}
              className="ml-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              href={ctaHref}
              className="ml-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {ctaLabel}
            </Link>
          )}
        </nav>

        {/* Mobile: CTA + menu */}
        <div className="flex items-center gap-2 md:hidden">
          {variant === "wizard" && onClearSession ? (
            <button
              type="button"
              onClick={onClearSession}
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Clear
            </button>
          ) : (
            <Link
              href={ctaHref}
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Start
            </Link>
          )}
          <button
            type="button"
            onClick={toggleMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-expanded={open}
            aria-controls="main-nav-menu"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={closeMenu}
          />
          <nav
            id="main-nav-menu"
            role="dialog"
            aria-label="Menú principal"
            className="fixed right-0 top-0 z-40 flex h-full w-full max-w-xs flex-col gap-1 overflow-y-auto border-l border-slate-200 bg-white px-4 py-6 shadow-xl md:hidden"
          >
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                className="rounded-xl px-4 py-3 text-base font-medium text-slate-800 transition hover:bg-slate-50"
              >
                {label}
              </Link>
            ))}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cuenta
              </p>
              <HomeLogin variant="stacked" />
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
