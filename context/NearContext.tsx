"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { NearPrivySigner } from "@/lib/near-privy-signer";
import { NEAR_RPC_URL } from "@/lib/near-config";

export type NearContextValue = {
  /** NEAR account id (wallet address) when user has a NEAR wallet */
  walletId: string;
  /** NEAR Account instance for signing and sending transactions; null until wallet is ready */
  nearAccount: Account | null;
  /** Whether we are still creating or loading the NEAR wallet */
  isLoading: boolean;
  /** True if the NEAR account exists on-chain (has been funded). Implicit accounts need a first transfer to exist. */
  accountExistsOnChain: boolean | null;
  /** Create a NEAR wallet for the current user (e.g. after social login without wallet) */
  createNearWallet: () => Promise<void>;
  /** Re-check if the NEAR account exists on-chain (e.g. after user funded it) */
  refreshAccountExists: () => Promise<void>;
  /** NEAR JSON RPC provider */
  provider: JsonRpcProvider;
};

const defaultValue: NearContextValue = {
  walletId: "",
  nearAccount: null,
  isLoading: false,
  accountExistsOnChain: null,
  createNearWallet: async () => {},
  refreshAccountExists: async () => {},
  provider: new JsonRpcProvider({ url: NEAR_RPC_URL }),
};

const NearContext = createContext<NearContextValue>(defaultValue);

export function useNEAR(): NearContextValue {
  const ctx = useContext(NearContext);
  if (!ctx) throw new Error("useNEAR must be used within NearProvider");
  return ctx;
}

const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });

/** Get the NEAR wallet address from the user: prefer a linked account with chainType 'near', else user.wallet if it is NEAR. */
function getNearWalletAddress(user: { wallet?: { address: string; chainType?: string }; linkedAccounts?: Array<{ type: string; address?: string; chainType?: string }> } | null): string | undefined {
  if (!user) return undefined;
  const nearFromLinked = user.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "near" && a.address
  ) as { address: string } | undefined;
  if (nearFromLinked?.address) return nearFromLinked.address;
  if (user.wallet?.address && user.wallet?.chainType === "near") return user.wallet.address;
  return undefined;
}

export function NearProvider({ children }: { children: ReactNode }) {
  const { authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();

  const [walletId, setWalletId] = useState("");
  const [nearAccount, setNearAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accountExistsOnChain, setAccountExistsOnChain] = useState<boolean | null>(null);
  const autoCreateAttemptedRef = useRef(false);
  const autoFundRequestedRef = useRef(false);

  const checkAccountExists = useCallback(async (accountId: string) => {
    try {
      const list = await provider.viewAccessKeyList(accountId, { finality: "final" });
      const exists = (list?.keys?.length ?? 0) > 0;
      setAccountExistsOnChain(exists);
      return exists;
    } catch {
      setAccountExistsOnChain(false);
      return false;
    }
  }, []);

  const refreshAccountExists = useCallback(async () => {
    if (walletId) await checkAccountExists(walletId);
  }, [walletId, checkAccountExists]);

  /** Request one-time auto-fund from our API when the implicit account does not exist on-chain. */
  const requestAutoFund = useCallback(async (accountId: string) => {
    if (autoFundRequestedRef.current) return;
    autoFundRequestedRef.current = true;
    try {
      const res = await fetch("/api/near/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("[NearContext] Auto-fund failed:", data.error ?? res.statusText);
        autoFundRequestedRef.current = false;
        return;
      }
      // Poll for account existence: 2s, then 4s, then 6s
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2000 + i * 2000));
        const exists = await checkAccountExists(accountId);
        if (exists) break;
      }
    } catch (e) {
      console.warn("[NearContext] Auto-fund request error:", e);
      autoFundRequestedRef.current = false;
    }
  }, [checkAccountExists]);

  const createNearWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      await createWallet({ chainType: "near" });
      // User state will update and useEffect below will set account
    } finally {
      setIsLoading(false);
    }
  }, [createWallet]);

  // Crear wallet NEAR automáticamente cuando el usuario está autenticado pero no tiene wallet NEAR
  // (sin wallet → crear NEAR; con wallet pero no NEAR, p. ej. MetaMask → también crear NEAR para pagos/retiros)
  useEffect(() => {
    if (!authenticated || !user) {
      autoCreateAttemptedRef.current = false;
      setWalletId("");
      setNearAccount(null);
      return;
    }

    const nearAddr = getNearWalletAddress(user);
    if (nearAddr) {
      autoCreateAttemptedRef.current = true;
      return;
    }

    if (autoCreateAttemptedRef.current) return;
    autoCreateAttemptedRef.current = true;
    createNearWallet();
  }, [authenticated, user, createNearWallet]);

  // Cuando ya hay wallet NEAR, configurar cuenta y comprobar si existe on-chain
  useEffect(() => {
    const accountId = authenticated && user ? getNearWalletAddress(user) : undefined;
    if (!accountId) {
      setWalletId("");
      setNearAccount(null);
      setAccountExistsOnChain(null);
      autoFundRequestedRef.current = false;
      return;
    }

    setWalletId(accountId);

    const signer = new NearPrivySigner(
      (input) => signRawHash(input),
      accountId,
      provider
    );
    const acc = new Account(accountId, provider, signer);
    setNearAccount(acc);

    checkAccountExists(accountId);
  }, [authenticated, user, signRawHash, checkAccountExists]);

  // When we have a wallet and we've determined it doesn't exist on-chain, trigger one-time auto-fund
  useEffect(() => {
    if (!walletId || accountExistsOnChain !== false) return;
    requestAutoFund(walletId);
  }, [walletId, accountExistsOnChain, requestAutoFund]);

  const value = useMemo<NearContextValue>(
    () => ({
      walletId,
      nearAccount,
      isLoading,
      accountExistsOnChain,
      createNearWallet,
      refreshAccountExists,
      provider,
    }),
    [walletId, nearAccount, isLoading, accountExistsOnChain, createNearWallet, refreshAccountExists]
  );

  return (
    <NearContext.Provider value={value}>
      {children}
    </NearContext.Provider>
  );
}
