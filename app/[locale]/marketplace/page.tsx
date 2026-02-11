import { getTranslations } from "next-intl/server";
import { NavBar } from "@/components/NavBar";
import { Link } from "@/i18n/navigation";
import { getSpecialistsFromApi } from "@/lib/marketplace/specialists";
import { HydrateSpecialists } from "./HydrateSpecialists";
import { MarketplaceWithFilters } from "./MarketplaceWithFilters";

// ----------------------------------------------------------------------
// MAIN PAGE COMPONENT
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

  const specialists = await getSpecialistsFromApi();
  const t = await getTranslations("marketplace");

  return (
    <>
      <HydrateSpecialists specialists={specialists} />
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
                {t("fromWizardBanner")}{" "}
                {analysisId && (
                  <span className="text-teal-700">{t("fromWizardAnalysis")}</span>
                )}
              </p>
              <Link href="/analisis" className="mt-2 inline-block text-sm font-semibold text-teal-700 underline hover:text-teal-800">
                {t("viewAllAnalyses")}
              </Link>
            </section>
          )}

          {/* Header + Filters + Grid */}
          <MarketplaceWithFilters specialists={specialists} />

          {/* Trust Banner */}
          <section className="mt-12 rounded-2xl border border-slate-200/60 bg-white/50 px-6 py-8 text-center backdrop-blur">
            <p className="text-sm font-medium text-slate-600">
              {t("trustBanner")}
            </p>
          </section>
        </main>
      </div>
    </div>
    </>
  );
}