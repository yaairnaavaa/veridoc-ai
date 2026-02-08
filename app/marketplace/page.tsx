import { NavBar } from "@/components/NavBar";
import {
  Star,
  MapPin,
  Languages,
  CalendarCheck,
  Award,
  ChevronRight,
  Filter,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import {
  getSpecialistsFromDb,
  MOCK_SPECIALISTS,
  type UiSpecialist,
} from "@/app/marketplace/specialists";

// ----------------------------------------------------------------------
// 2. UI COMPONENT (Server Rendered)
// ----------------------------------------------------------------------

const SpecialistCard = ({ specialist }: { specialist: UiSpecialist }) => {
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
            {specialist.verified && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-teal-600"
                title="Verified"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
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
            Solicitar segunda opinión
            <ChevronRight className="h-4 w-4 opacity-70" />
          </span>
          <span className="block w-full text-center text-xs font-medium text-slate-500 group-hover:text-slate-800">
            Ver perfil completo
          </span>
        </div>
      </div>
    </Link>
  );
};

// ----------------------------------------------------------------------
// 3. MAIN PAGE COMPONENT
// ----------------------------------------------------------------------

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
};

export default async function MarketplacePage(props: PageProps) {
  const rawParams = props.searchParams ?? {};
  const searchParams = rawParams instanceof Promise ? await rawParams : rawParams;
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const analysisId = typeof searchParams.analysisId === "string" ? searchParams.analysisId : undefined;
  const fromWizard = from === "wizard" || from === "analisis";

  const fromDb = await getSpecialistsFromDb();
  const specialists = [...MOCK_SPECIALISTS, ...fromDb];

  return (
    <div className="min-h-screen bg-[#f6fbfb] text-slate-900">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 via-sky-200/30 to-white blur-3xl" />
        <div className="absolute left-0 top-40 h-80 w-80 rounded-full bg-gradient-to-tr from-cyan-200/30 via-emerald-200/20 to-white blur-3xl" />
      </div>

      <div className="relative z-10">
        <NavBar />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:px-10">
          {fromWizard && (
            <section className="mb-6 rounded-2xl border border-teal-200/60 bg-teal-50/80 px-4 py-4 backdrop-blur">
              <p className="text-sm font-medium text-teal-800">
                Estás aquí para solicitar una segunda opinión. Elige un especialista, paga con USDT y envía tus datos de forma segura.{" "}
                {analysisId && (
                  <span className="text-teal-700">Tu análisis reciente se puede enviar al médico que elijas.</span>
                )}
              </p>
              <Link href="/analisis" className="mt-2 inline-block text-sm font-semibold text-teal-700 underline hover:text-teal-800">
                Ver todos mis análisis
              </Link>
            </section>
          )}

          {/* Header Section */}
          <section className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 inline-block rounded-full border border-teal-200/60 bg-teal-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-teal-700 backdrop-blur">
                Second opinion on blood work
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Verified specialists for your blood studies
              </h1>
              <p className="mt-3 text-lg text-slate-600">
                Get a professional second opinion on your blood panels. Upload your results and have a verified specialist review and explain them—paid in USDT.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Link 
                href="/profile/specialist-onboarding" 
                className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-sm font-semibold text-teal-800 shadow-sm backdrop-blur transition hover:bg-teal-100"
              >
                <UserPlus className="h-4 w-4" />
                Are you a Doctor?
              </Link>

              <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-900">
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
          </section>

          {/* Grid Layout */}
          {specialists.length > 0 ? (
            <section className="grid gap-6">
              {specialists.map((specialist) => (
                <SpecialistCard key={specialist.id} specialist={specialist} />
              ))}
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center">
              <div className="mb-4 rounded-full bg-slate-100 p-4">
                <UserPlus className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No specialists found yet</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                Our directory is growing. Be the first specialist to join our network.
              </p>
              <Link href="/profile/specialist-onboarding" className="mt-6 font-semibold text-teal-700 hover:underline">
                Register as a Specialist
              </Link>
            </div>
          )}

          {/* Trust Banner */}
          <section className="mt-12 rounded-2xl border border-slate-200/60 bg-white/50 px-6 py-8 text-center backdrop-blur">
            <p className="text-sm font-medium text-slate-600">
              All specialists are verified. Get a second opinion on any blood panel—CBC, metabolic, lipids, thyroid, and more. Pay in USDT.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}