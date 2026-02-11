"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
] as const;

/** Pathname without locale prefix (e.g. /marketplace). usePathname() can sometimes include the prefix. */
function getPathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && routing.locales.includes(segments[0] as "en" | "es")) {
    return "/" + segments.slice(1).join("/") || "/";
  }
  return pathname || "/";
}

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameWithoutLocale = getPathnameWithoutLocale(pathname);

  const handleChange = (newLocale: string) => {
    if (newLocale === locale) return;
    router.replace(pathnameWithoutLocale, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/80 p-0.5">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          className={`min-w-[36px] rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
            locale === code
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
          aria-label={locale === code ? `Current language: ${label}` : `Switch to ${label}`}
          aria-pressed={locale === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
