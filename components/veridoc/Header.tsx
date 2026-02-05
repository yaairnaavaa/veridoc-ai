"use client";

import React from "react";

export const Header = () => {
  return (
    <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-8 sm:px-8 lg:px-10">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
          <span className="h-4 w-4 rounded-full bg-gradient-to-br from-teal-500 to-sky-500" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-slate-900">Veridoc</span>
      </div>
      
      <nav className="flex items-center gap-3">
        {/* Solo visible en Desktop */}
        <a
          href="#privacy"
          className="hidden md:block rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
        >
          Privacy
        </a>

        {/* SIEMPRE visible: Marketplace */}
        <a
          href="#marketplace"
          className="rounded-full px-5 py-2.5 text-sm font-semibold transition bg-white shadow-sm ring-1 ring-slate-200 md:bg-transparent md:shadow-none md:ring-0 md:font-medium text-slate-900 md:text-slate-700"
        >
          Marketplace
        </a>

        {/* Solo visible en Desktop */}
        <a
          href="#hero-upload"
          className="hidden md:block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Upload Labs
        </a>
      </nav>
    </header>
  );
};