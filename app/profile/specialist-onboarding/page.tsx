"use client";

import { AppHeader } from "@/components/veridoc/Header";
import { SpecialistOnboardingForm } from "@/components/specialist/SpecialistOnboardingForm";
import { ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

export default function SpecialistOnboardingPage() {
  const [randomWallet, setRandomWallet] = useState("");

  // Función para generar ID
  const generateNewId = () => {
    setRandomWallet(`test-user-${Math.floor(Math.random() * 100000)}`);
  };

  // Generar el primero al cargar
  useEffect(() => {
    generateNewId();
  }, []);

  return (
    <div className="min-h-screen bg-[#f6fbfb]">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 via-sky-200/30 to-white blur-3xl" />
        <div className="absolute left-0 top-40 h-80 w-80 rounded-full bg-gradient-to-tr from-cyan-200/30 via-emerald-200/20 to-white blur-3xl" />
      </div>

      <div className="relative z-10">
        <AppHeader />

        <main className="mx-auto w-full max-w-2xl px-4 py-12">
          
          <div className="text-center mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/60 bg-teal-50/50 px-3 py-1 text-xs font-medium text-teal-700 backdrop-blur">
              <ShieldCheck className="w-3 h-3" />
              Alta de Especialistas
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Registrar Nuevo Especialista
            </h1>
            
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-sm backdrop-blur">
             {randomWallet && (
               <SpecialistOnboardingForm 
                  key={randomWallet} // La clave hace que React reinicie el componente al cambiar el ID
                  userWallet={randomWallet} 
                  onSuccess={generateNewId} // ¡Aquí ocurre la magia automática!
               />
             )}
          </div>
          
        </main>
      </div>
    </div>
  );
}