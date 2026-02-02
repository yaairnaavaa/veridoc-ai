"use client";

import React, { useState } from "react";
import { X, Activity, ChevronRight, FileText, Zap } from "lucide-react";
import { PrivacyBadge } from "./PrivacyBadge";
import { describeFileType } from "@/lib/veridoc/localInference";

const MOCK_DATA = [
  { 
    id: "1", 
    title: "Lipid Panel Analysis", 
    description: "Looking for a second opinion on high LDL levels after dietary changes.", 
    markers: ["Cholesterol", "LDL", "HDL"], 
    budget: "$40.00", 
    file: { name: "labs.pdf", type: "application/pdf" } as any 
  },
  { 
    id: "2", 
    title: "Blood Count Review", 
    description: "Need interpretation of recent hemoglobin fluctuations.", 
    markers: ["Hemoglobin", "WBC"], 
    budget: "$30.00", 
    file: { name: "test.jpg", type: "image/jpeg" } as any 
  },
];

export const MarketplaceGrid = () => {
  const [selectedCase, setSelectedCase] = useState<any>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold text-slate-900">Expert Marketplace</h2>
        <p className="text-slate-600 text-sm">Review cases and provide medical insights securely.</p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {MOCK_DATA.map((item) => (
          <div 
            key={item.id} 
            onClick={() => setSelectedCase(item)}
            className="cursor-pointer rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:border-teal-200 active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 text-teal-500">
                <Activity size={24} />
              </div>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">{item.budget}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
            <div className="mt-4 flex items-center text-sm font-semibold text-slate-900">
              View details <ChevronRight size={16} className="ml-1 text-teal-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Detalle Avanzado (Bottom Sheet en móvil) */}
      {selectedCase && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/20 backdrop-blur-md p-0 sm:p-6">
          <div className="w-full max-w-xl bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-semibold">{selectedCase.title}</h2>
              <button onClick={() => setSelectedCase(null)} className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100"><X /></button>
            </div>
            <div className="space-y-6">
              <PrivacyBadge compact />
              <div className="space-y-2 text-sm">
                <p className="text-xs font-bold uppercase text-slate-400">Description</p>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl">{selectedCase.description}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs font-bold uppercase text-slate-400">File Metadata</p>
                <p className="font-medium text-slate-900">{describeFileType(selectedCase.file)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCase.markers.map((m: string) => (
                  <span key={m} className="px-3 py-1 border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500 bg-white">{m}</span>
                ))}
              </div>
              <button className="w-full bg-slate-900 text-white py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                <Zap size={18} fill="currentColor" /> Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};