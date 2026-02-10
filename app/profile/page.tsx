"use client";

import { getUsdtBalance, formatUsdtBalance, createTransferUsdtAction, parseUsdtAmount, signedDelegateToBase64, USDT_CONTRACT_ID } from "@/lib/near-usdt";

import { encodeSignedDelegate } from "@near-js/transactions";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import { Coins, Loader2, User, ShieldCheck, CreditCard, RefreshCw, ExternalLink, Copy, Check, ChevronDown, Stethoscope, X, Image as ImageIcon, FileCheck, IdCard } from "lucide-react";
import Link from "next/link";
import { useNEAR } from "@/context/NearContext";
//import { getVerifierBalance, formatUsdtBalance, createDepositUsdtAction, createWithdrawUsdtAction, USDT_CONTRACT_ID, VERIFIER_CONTRACT_ID,} from "@/lib/near-intents";
import { processCrossChainWithdrawal, getRouteConfigForNetwork, USDT_WITHDRAW_SUPPORTED_NETWORK_IDS } from "@/lib/near-intents-withdraw";
import { DEPOSIT_NETWORKS, type DepositNetworkId, NEAR_NETWORK, MIN_NEAR_TO_CREATE_IMPLICIT, NEAR_TESTNET_FAUCET_URL, isValidNearAccountId, normalizeNearAccountId } from "@/lib/near-config";
import { uploadSpecialistFilesToCloudinary } from "@/app/actions/specialist";

type SpecialistProfile = {
  professionalTitle?: string;
  specialty?: string;
  biography?: string;
  yearsOfExperience?: number;
  consultationPrice?: number;
  languages?: string[];
  profileImageUrl?: string;
  licenseDocumentUrl?: string;
  degreeDocumentUrl?: string;
  status?: string;
  nearAddress?: string;
  privyWallet?: string;
  _id?: string;
};


const USDT_LOGO_URL =
  "https://assets.coingecko.com/coins/images/325/small/Tether.png";

type ProfileTabId = "profile" | "verified" | "balance";

const TABS: { id: ProfileTabId; label: string; shortLabel?: string; icon: typeof User }[] = [
  { id: "profile", label: "Account", shortLabel: "Account", icon: User },
  { id: "verified", label: "Verified Profile", shortLabel: "Verified", icon: ShieldCheck },
  { id: "balance", label: "Payments & balance", shortLabel: "Payments", icon: CreditCard },
];

function getUserDisplayName(user: {
  id?: string;
  email?: { address?: string };
  wallet?: { address?: string };
} | null): string {
  if (!user) return "";
  const email = user.email?.address;
  if (email) return email.length > 20 ? `${email.slice(0, 18)}…` : email;
  const addr = user.wallet?.address;
  if (addr) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return user.id ? `User ${user.id.slice(0, 8)}…` : "Your account";
}

function ProfilePageContent() {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { walletId, nearAccount, isLoading: nearLoading, createNearWallet, isFunding, provider, accountExistsOnChain, refreshAccountExists } = useNEAR();
  const [copiedFundAddress, setCopiedFundAddress] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [copiedReceiveAddress, setCopiedReceiveAddress] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReceiver, setWithdrawReceiver] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("profile");

  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam === "verified" || tabParam === "balance" || tabParam === "profile") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [specialistProfile, setSpecialistProfile] = useState<SpecialistProfile | null>(null);
  const [specialistLoading, setSpecialistLoading] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateImageName, setUpdateImageName] = useState<string | null>(null);
  const [updateLicenseName, setUpdateLicenseName] = useState<string | null>(null);
  const [updateDegreeName, setUpdateDegreeName] = useState<string | null>(null);

  const privyWallet = user?.wallet?.address ?? null;

  const refreshSpecialistProfile = useCallback(() => {
    if (!privyWallet) return;
    setSpecialistLoading(true);
    fetch(`/api/specialists/${encodeURIComponent(privyWallet)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSpecialistProfile(data?.data ?? data ?? null))
      .catch(() => setSpecialistProfile(null))
      .finally(() => setSpecialistLoading(false));
  }, [privyWallet]);

  useEffect(() => {
    if (!privyWallet) {
      setSpecialistProfile(null);
      return;
    }
    refreshSpecialistProfile();
  }, [privyWallet, refreshSpecialistProfile]);

  useEffect(() => {
    if (specialistProfile != null) {
      console.log("specialistProfile", specialistProfile);
    }
  }, [specialistProfile]);

  useEffect(() => {
    if (updateModalOpen) {
      setUpdateImageName(null);
      setUpdateLicenseName(null);
      setUpdateDegreeName(null);
    }
  }, [updateModalOpen]);

  useEffect(() => {
    if (!walletId) {
      setUsdtBalance(null);
      setBalanceLoading(false);
      return;
    }
    setBalanceLoading(true);
    getUsdtBalance(walletId)
      .then((raw) => setUsdtBalance(formatUsdtBalance(raw)))
      .catch(() => setUsdtBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [walletId]);

  // Re-check if account exists on-chain when user opens Payments & balance (fixes stale "not active" state)
  useEffect(() => {
    if (activeTab === "balance" && walletId) refreshAccountExists();
  }, [activeTab, walletId, refreshAccountExists]);

  const refreshBalance = useCallback(() => {
    if (!walletId) return;
    setBalanceLoading(true);
    getUsdtBalance(walletId)
      .then((raw) => setUsdtBalance(formatUsdtBalance(raw)))
      .catch(() => setUsdtBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [walletId]);

  const handleMaxAmount = useCallback(() => {
    if (usdtBalance != null && !balanceLoading) setWithdrawAmount(usdtBalance);
  }, [usdtBalance, balanceLoading]);

  const isTxInProgress = withdrawLoading;

  const handleWithdraw = useCallback(async () => {
    if (!nearAccount || !walletId) return;
    const amount = withdrawAmount.trim();
    const receiverRaw = withdrawReceiver.trim() || walletId;
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setWithdrawError("Please enter a valid amount.");
      return;
    }
    if (!receiverRaw) {
      setWithdrawError("Please enter the destination NEAR account ID.");
      return;
    }
    if (!isValidNearAccountId(receiverRaw)) {
      setWithdrawError(
        "Invalid NEAR account ID. Use a 64-character hex address (implicit) or a named account (e.g. alice.near)."
      );
      return;
    }
    const receiver = normalizeNearAccountId(receiverRaw);
    setWithdrawError(null);
    setWithdrawLoading(true);
    try {
      const amountRaw = parseUsdtAmount(amount);
      const action = createTransferUsdtAction(amountRaw, receiver);
      // NEP-366: delegate receiverId = contract that executes the actions (USDT), not the relayer.
      const signedDelegate = await nearAccount.signedDelegate({
        actions: [action],
        blockHeightTtl: 100,
        receiverId: USDT_CONTRACT_ID,
      });
      const encoded = encodeSignedDelegate(signedDelegate);
      const signedDelegateBase64 = signedDelegateToBase64(encoded);
      const res = await fetch("/api/near/relay-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedDelegateBase64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.details ?? data.error ?? res.statusText);
      }
      setWithdrawAmount("");
      setWithdrawReceiver("");
      refreshBalance();
    } catch (e) {
      setWithdrawError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setWithdrawLoading(false);
    }
  }, [nearAccount, walletId, withdrawAmount, withdrawReceiver, refreshBalance]);

  const handleCopyReceiveAddress = useCallback(() => {
    if (!walletId) return;
    navigator.clipboard.writeText(walletId).then(() => {
      setCopiedReceiveAddress(true);
      setTimeout(() => setCopiedReceiveAddress(false), 2000);
    });
  }, [walletId]);

  const handleCopyFundAddress = useCallback(() => {
    if (!walletId) return;
    navigator.clipboard.writeText(walletId).then(() => {
      setCopiedFundAddress(true);
      setTimeout(() => setCopiedFundAddress(false), 2000);
    });
  }, [walletId]);

  const handleUpdateSpecialistSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!privyWallet || !specialistProfile) return;
      const form = e.currentTarget;
      const formData = new FormData(form);
      const professionalTitle = String(formData.get("professionalTitle") ?? "").trim();
      const specialty = String(formData.get("specialty") ?? "").trim();
      const biography = String(formData.get("biography") ?? "").trim();
      const yearsOfExperience = Number(formData.get("yearsOfExperience")) || 0;
      const consultationPrice = Number(formData.get("consultationPrice")) || 0;
      const languagesStr = String(formData.get("languages") ?? "").trim();
      const languages = languagesStr ? languagesStr.split(",").map((s) => s.trim()) : [];
      const imageFile = formData.get("image") as File | null;
      const titleDocumentFile = formData.get("titleDocument") as File | null;
      const cedulaFile = formData.get("cedula") as File | null;
      const hasNewFiles = (imageFile?.size ?? 0) > 0 || (titleDocumentFile?.size ?? 0) > 0 || (cedulaFile?.size ?? 0) > 0;

      setUpdateError(null);
      setUpdateSaving(true);
      try {
        let profileImageUrl = specialistProfile.profileImageUrl ?? "";
        let degreeDocumentUrl = specialistProfile.degreeDocumentUrl ?? "";
        let licenseDocumentUrl = specialistProfile.licenseDocumentUrl ?? "";

        if (hasNewFiles) {
          const uploadForm = new FormData();
          if (imageFile?.size) uploadForm.append("image", imageFile);
          if (titleDocumentFile?.size) uploadForm.append("titleDocument", titleDocumentFile);
          if (cedulaFile?.size) uploadForm.append("cedula", cedulaFile);
          const urls = await uploadSpecialistFilesToCloudinary(uploadForm);
          if (urls.imageUrl) profileImageUrl = urls.imageUrl;
          if (urls.titleDocumentUrl) degreeDocumentUrl = urls.titleDocumentUrl;
          if (urls.cedulaUrl) licenseDocumentUrl = urls.cedulaUrl;
        }

        const payload = {
          ...specialistProfile,
          professionalTitle,
          specialty,
          biography,
          yearsOfExperience,
          consultationPrice,
          languages,
          profileImageUrl,
          degreeDocumentUrl,
          licenseDocumentUrl,
        };
        const res = await fetch(`/api/specialists/${encodeURIComponent(privyWallet)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUpdateError((data?.message ?? data?.error) || "Failed to update");
          return;
        }
        setSpecialistProfile(data?.data ?? data ?? payload);
        setUpdateModalOpen(false);
        refreshSpecialistProfile();
      } catch {
        setUpdateError("Failed to update profile");
      } finally {
        setUpdateSaving(false);
      }
    },
    [privyWallet, specialistProfile, refreshSpecialistProfile]
  );

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace("/");
      return;
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6fbfb] px-4">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-teal-500" aria-hidden />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f6fbfb] text-slate-900">
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 via-sky-200/30 to-white blur-3xl" />
        <div className="absolute left-0 top-40 h-80 w-80 rounded-full bg-gradient-to-tr from-cyan-200/30 via-emerald-200/20 to-white blur-3xl" />
      </div>

      <div className="relative z-10">
        <NavBar />

        <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Profile
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 sm:mt-2 sm:text-base">
            Your account, verified specialists, and payment balance.
          </p>

          {/* Tabs — mobile: scrollable; desktop: full width */}
          <div
            role="tablist"
            aria-label="Profile sections"
            className="mt-6 -mx-4 overflow-x-auto border-b border-slate-200 sm:mx-0 sm:overflow-visible"
          >
            <div className="flex min-w-0 gap-0 sm:gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:justify-start sm:px-5 ${
                      isActive
                        ? "border-teal-600 text-teal-700"
                        : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab panel: Profile */}
          {activeTab === "profile" && (
            <section
              id="panel-profile"
              role="tabpanel"
              aria-labelledby="tab-profile"
              className="pt-6 sm:pt-8"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <User className="h-5 w-5 text-teal-700 sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Your account</h2>
                  <p className="mt-0.5 text-sm text-slate-500">How you sign in and where payments are sent.</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Signed in as</p>
                <p className="mt-1.5 font-medium text-slate-900">{getUserDisplayName(user)}</p>
                {walletId ? (
                  <>
                    <p className="mt-2 font-mono text-sm text-slate-600 break-all" title={walletId}>
                      Payment account: {walletId.length > 28 ? `${walletId.slice(0, 14)}…${walletId.slice(-12)}` : walletId}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      To receive USDT and withdraw, fund this account with NEAR in the <button type="button" onClick={() => setActiveTab("balance")} className="font-medium text-teal-600 hover:text-teal-700 underline">Payments & balance</button> tab.
                    </p>
                  </>
                ) : (
                  <div className="mt-4">
                    {nearLoading ? (
                      <p className="text-sm text-slate-500">Setting up your payment account…</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => createNearWallet()}
                        className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:bg-teal-800"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  Marketplace
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  Back to home
                </Link>
              </div>
            </section>
          )}

          {/* Tab panel: Verified specialists */}
          {activeTab === "verified" && (
            <section
              id="panel-verified"
              role="tabpanel"
              aria-labelledby="tab-verified"
              className="pt-6 sm:pt-8"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <ShieldCheck className="h-5 w-5 text-emerald-700 sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Verified profile</h2>
                  <p className="mt-0.5 text-sm text-slate-500">How we check the experts who give second opinions.</p>
                </div>
              </div>

              <div className="mt-4 max-w-prose rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6">
                <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                  On Veridoc, every specialist who offers a second opinion on your lab results goes through a verification process. This helps keep you safe and ensures quality care.
                </p>
                <ul className="mt-5 space-y-3 text-sm text-slate-600 sm:text-base">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                    <span><strong className="text-slate-700">Professional identity.</strong> We confirm who they are and, when relevant, their link to medical boards or institutions.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                    <span><strong className="text-slate-700">Profile and specialty.</strong> Each specialist states their area (e.g. internal medicine, endocrinology) and experience, which we review.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                    <span><strong className="text-slate-700">Listing on the marketplace.</strong> Only approved profiles appear as verified and can receive second-opinion requests.</span>
                  </li>
                </ul>
              </div>

              {/* Your specialist profile */}
              {privyWallet && (
                <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-teal-600" aria-hidden />
                    <h3 className="text-base font-semibold text-slate-900">Your specialist profile</h3>
                  </div>
                  {specialistLoading ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
                    </p>
                  ) : specialistProfile ? (
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-4">
                        {specialistProfile.profileImageUrl ? (
                          <img
                            src={specialistProfile.profileImageUrl}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-teal-100">
                            <Stethoscope className="h-8 w-8 text-teal-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{specialistProfile.professionalTitle || "Specialist"}</p>
                          <p className="text-sm text-slate-600">{specialistProfile.specialty}</p>
                          {specialistProfile.status && (
                            <span
                              className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                specialistProfile.status === "Verificado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {specialistProfile.status}
                            </span>
                          )}
                        </div>
                      </div>
                      {specialistProfile.biography && (
                        <p className="text-sm text-slate-600">{specialistProfile.biography}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {specialistProfile.yearsOfExperience != null && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                            {specialistProfile.yearsOfExperience} years of experience
                          </span>
                        )}
                        {specialistProfile.consultationPrice != null && specialistProfile.consultationPrice > 0 && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                            ${specialistProfile.consultationPrice} per session
                          </span>
                        )}
                        {specialistProfile.languages?.length ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                            {specialistProfile.languages.join(", ")}
                          </span>
                        ) : null}
                      </div>
                      {(specialistProfile.licenseDocumentUrl || specialistProfile.degreeDocumentUrl) && (
                        <div className="flex flex-wrap gap-2">
                          {specialistProfile.licenseDocumentUrl && (
                            <a
                              href={specialistProfile.licenseDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              License document
                            </a>
                          )}
                          {specialistProfile.degreeDocumentUrl && (
                            <a
                              href={specialistProfile.degreeDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Degree document
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      You are not registered as a specialist yet.
                    </p>
                  )}
                  {!specialistLoading && (
                    <>
                      {specialistProfile ? (
                        <button
                          type="button"
                          onClick={() => setUpdateModalOpen(true)}
                          className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus-visible:underline"
                        >
                          Update specialist profile
                        </button>
                      ) : (
                        <Link
                          href="/profile/specialist-onboarding"
                          className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus-visible:underline"
                        >
                          Apply as a specialist →
                        </Link>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Update specialist modal */}
              {updateModalOpen && specialistProfile && privyWallet && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="update-specialist-title"
                >
                  <div
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    onClick={() => !updateSaving && setUpdateModalOpen(false)}
                    aria-hidden
                  />
                  <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="update-specialist-title" className="text-lg font-semibold text-slate-900">
                        Update specialist profile
                      </h2>
                      <button
                        type="button"
                        onClick={() => !updateSaving && setUpdateModalOpen(false)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <form onSubmit={handleUpdateSpecialistSubmit} className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="update-professionalTitle" className="block text-sm font-medium text-slate-700">
                          Professional title
                        </label>
                        <input
                          id="update-professionalTitle"
                          name="professionalTitle"
                          type="text"
                          defaultValue={specialistProfile.professionalTitle ?? ""}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="update-specialty" className="block text-sm font-medium text-slate-700">
                          Specialty
                        </label>
                        <input
                          id="update-specialty"
                          name="specialty"
                          type="text"
                          defaultValue={specialistProfile.specialty ?? ""}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="update-biography" className="block text-sm font-medium text-slate-700">
                          Biography
                        </label>
                        <textarea
                          id="update-biography"
                          name="biography"
                          rows={3}
                          defaultValue={specialistProfile.biography ?? ""}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="update-yearsOfExperience" className="block text-sm font-medium text-slate-700">
                            Years of experience
                          </label>
                          <input
                            id="update-yearsOfExperience"
                            name="yearsOfExperience"
                            type="number"
                            min={0}
                            defaultValue={specialistProfile.yearsOfExperience ?? 0}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="update-consultationPrice" className="block text-sm font-medium text-slate-700">
                            Consultation price ($)
                          </label>
                          <input
                            id="update-consultationPrice"
                            name="consultationPrice"
                            type="number"
                            min={0}
                            defaultValue={specialistProfile.consultationPrice ?? 0}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="update-languages" className="block text-sm font-medium text-slate-700">
                          Languages (comma-separated)
                        </label>
                        <input
                          id="update-languages"
                          name="languages"
                          type="text"
                          defaultValue={specialistProfile.languages?.join(", ") ?? ""}
                          placeholder="English, Spanish"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Profile image</label>
                        <div className="mt-1 flex items-center gap-4">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {specialistProfile.profileImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={specialistProfile.profileImageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                id="update-image-preview"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <ImageIcon className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            Change photo
                            <input
                              type="file"
                              name="image"
                              accept="image/png,image/jpeg,image/webp,image/jpg"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                const img = document.getElementById("update-image-preview") as HTMLImageElement | null;
                                if (file && img) {
                                  img.src = URL.createObjectURL(file);
                                  img.alt = "";
                                }
                                setUpdateImageName(file?.name ?? null);
                              }}
                            />
                          </label>
                        </div>
                        {updateImageName && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-600">
                            <Check className="h-4 w-4 shrink-0" />
                            Loaded: {updateImageName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          <IdCard className="inline h-4 w-4 align-text-bottom" /> License document
                        </label>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {specialistProfile.licenseDocumentUrl && (
                            <a
                              href={specialistProfile.licenseDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-teal-600 hover:text-teal-700"
                            >
                              Current document →
                            </a>
                          )}
                          <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            {specialistProfile.licenseDocumentUrl ? "Replace file" : "Upload file"}
                            <input
                              type="file"
                              name="cedula"
                              accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                              className="sr-only"
                              onChange={(e) => setUpdateLicenseName(e.target.files?.[0]?.name ?? null)}
                            />
                          </label>
                        </div>
                        {updateLicenseName && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-600">
                            <Check className="h-4 w-4 shrink-0" />
                            Loaded: {updateLicenseName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          <FileCheck className="inline h-4 w-4 align-text-bottom" /> Degree document
                        </label>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {specialistProfile.degreeDocumentUrl && (
                            <a
                              href={specialistProfile.degreeDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-teal-600 hover:text-teal-700"
                            >
                              Current document →
                            </a>
                          )}
                          <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            {specialistProfile.degreeDocumentUrl ? "Replace file" : "Upload file"}
                            <input
                              type="file"
                              name="titleDocument"
                              accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                              className="sr-only"
                              onChange={(e) => setUpdateDegreeName(e.target.files?.[0]?.name ?? null)}
                            />
                          </label>
                        </div>
                        {updateDegreeName && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-600">
                            <Check className="h-4 w-4 shrink-0" />
                            Loaded: {updateDegreeName}
                          </p>
                        )}
                      </div>
                      {updateError && (
                        <p className="text-sm font-medium text-red-600" role="alert">
                          {updateError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setUpdateModalOpen(false)}
                          disabled={updateSaving}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updateSaving}
                          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
                        >
                          {updateSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              Saving…
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Tab panel: Payments & balance */}
          {activeTab === "balance" && (
            <section
              id="panel-balance"
              role="tabpanel"
              aria-labelledby="tab-balance"
              className="pt-6 sm:pt-8"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <CreditCard className="h-5 w-5 text-sky-700 sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Payments & balance</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Receive USDT and withdraw to your preferred network.</p>
                </div>
              </div>

              {walletId && accountExistsOnChain === false && (
                <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-sm sm:p-6">
                  <h3 className="text-base font-semibold text-amber-900 sm:text-lg">Activate your payment account</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Your NEAR account must receive a small amount of NEAR first (at least {MIN_NEAR_TO_CREATE_IMPLICIT} NEAR) so it exists on-chain. Then you can receive USDT and withdraw.
                  </p>
                  {isFunding ? (
                    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-900">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                      Activating your account…
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 text-xs font-medium text-amber-800">Send NEAR to this address</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <code className="max-w-full break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm sm:text-sm">
                          {walletId}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyFundAddress}
                          className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        >
                          {copiedFundAddress ? <><Check className="h-4 w-4 text-emerald-600" aria-hidden /> Copied</> : <><Copy className="h-4 w-4" aria-hidden /> Copy</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => refreshAccountExists()}
                          disabled={isFunding}
                          className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        >
                          {isFunding ? "Checking…" : "I've sent NEAR — refresh"}
                        </button>
                      </div>
                      {NEAR_NETWORK === "testnet" && (
                        <a
                          href={NEAR_TESTNET_FAUCET_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-800 underline hover:text-amber-900"
                        >
                          Get test NEAR from faucet <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {NEAR_NETWORK === "mainnet" && (
                        <p className="mt-2 text-xs text-amber-800">Send NEAR from an exchange or another wallet to the address above.</p>
                      )}
                    </>
                  )}
                </div>
              )}


              {/* Balance cards */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                      <img src={USDT_LOGO_URL} alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">USDT</span>
                      <button
                        type="button"
                        onClick={refreshBalance}
                        disabled={balanceLoading || !walletId}
                        title="Refresh balance"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        aria-label="Refresh balance"
                      >
                        <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {balanceLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden /> …
                      </span>
                    ) : (
                      usdtBalance ?? "0.00"
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Stablecoin for payments</p>
                  <p className="mt-0.5 text-xs text-slate-400">Available balance</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Coins className="h-5 w-5 text-teal-800 sm:h-6 sm:w-6" aria-hidden />
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">VDOC</p>
                  <p className="mt-1 text-sm text-slate-500">Veridoc points</p>
                  <p className="mt-0.5 text-xs text-slate-400">Coming soon</p>
                </div>
              </div>

              {/* Receive USDT — only when account exists on-chain */}
              {walletId && accountExistsOnChain !== false && (
                <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:mt-8 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Receive USDT</h3>
                      <p className="mt-1 text-sm text-slate-600">Your USDT balance is held in your NEAR account. Send USDT (NEP-141) to this address to add funds.</p>
                    </div>
                    <button
                      type="button"
                      onClick={refreshBalance}
                      disabled={balanceLoading || isTxInProgress}
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                      title="Refresh balance after depositing"
                    >
                      <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} aria-hidden />
                      Refresh balance
                    </button>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-xs font-medium text-slate-500">Your NEAR account (receives USDT)</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <code className="max-w-full break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm sm:text-sm">
                        {walletId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyReceiveAddress}
                        disabled={isTxInProgress}
                        className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        title="Copy address"
                      >
                        {copiedReceiveAddress ? <><Check className="h-4 w-4 text-emerald-600" aria-hidden /> Copied</> : <><Copy className="h-4 w-4" aria-hidden /> Copy</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Withdraw — only when account exists on-chain */}
              {walletId && nearAccount && accountExistsOnChain !== false && (
                <div className={`mt-6 rounded-2xl border bg-white/90 p-4 shadow-sm sm:mt-8 sm:p-6 ${isTxInProgress ? "border-teal-200/80 bg-teal-50/30" : "border-slate-200/80"}`}>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Withdraw</h3>
                  <p className="mt-1 text-sm text-slate-600">Send USDT from your NEAR account to another NEAR account.</p>
                  {isTxInProgress && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-teal-700" role="status">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                      Transaction in progress — please wait.
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-[11rem]">
                      <span className="text-xs font-medium text-slate-500">Amount (USDT)</span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          disabled={isTxInProgress}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={handleMaxAmount}
                          disabled={isTxInProgress || balanceLoading || !usdtBalance || usdtBalance === "0.00"}
                          title="Use full balance"
                          className="shrink-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        >
                          Max
                        </button>
                      </div>
                      {usdtBalance != null && !balanceLoading && (
                        <p className="text-xs text-slate-400">Available: {usdtBalance} USDT</p>
                      )}
                    </label>
                    <label className="flex flex-col gap-1.5 min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-xs">
                      <span className="text-xs font-medium text-slate-500">Destination NEAR account</span>
                      <input
                        type="text"
                        placeholder={walletId}
                        value={withdrawReceiver}
                        onChange={(e) => setWithdrawReceiver(e.target.value)}
                        disabled={isTxInProgress}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isTxInProgress || !withdrawAmount.trim()}
                      onClick={handleWithdraw}
                      className="flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:bg-teal-800"
                    >
                      {withdrawLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…</> : "Withdraw"}
                    </button>
                  </div>
                  {withdrawError && <p className="mt-3 text-sm text-red-600" role="alert">{withdrawError}</p>}
                </div>
              )}

              <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                Your USDT balance is held in your NEAR account. Receive USDT by sending it to your address above; withdraw to any other NEAR account from the form above.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function ProfileLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6fbfb] px-4">
      <div className="flex flex-col items-center gap-3">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-teal-500" aria-hidden />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfilePageContent />
    </Suspense>
  );
}
