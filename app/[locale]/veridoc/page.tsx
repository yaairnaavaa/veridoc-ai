import { WizardEntry } from "@/components/veridoc/WizardEntry";

export default function VeridocPage() {
  return (
    <div className="min-h-screen bg-[#f5fbfb] text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-teal-200/50 via-sky-200/40 to-white blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-32 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-200/40 via-emerald-200/30 to-white blur-3xl" />

        <main className="relative mx-auto w-full max-w-5xl px-0 pb-16">
          <WizardEntry />
        </main>
      </div>
    </div>
  );
}
