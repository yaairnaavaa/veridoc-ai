import { NextRequest, NextResponse } from "next/server";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { NEAR_RPC_URL, NEAR_NETWORK, MIN_NEAR_TO_CREATE_IMPLICIT } from "@/lib/near-config";

/** 0.002 NEAR in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR) */
const FUND_AMOUNT_YOCTO = BigInt(Math.round(parseFloat(MIN_NEAR_TO_CREATE_IMPLICIT) * 1e24));

/**
 * POST /api/near/fund
 * Body: { accountId: string } — the NEAR implicit account to fund (64 hex chars).
 *
 * Relayer behaviour (picks one):
 * 1. If NEAR_FAUCET_ACCOUNT_ID and NEAR_FAUCET_PRIVATE_KEY are set: send NEAR from that account (recommended).
 * 2. If on testnet and NEAR_TESTNET_FAUCET_API_URL is set: POST { accountId } to that URL (external faucet/relayer).
 * Otherwise returns 503.
 */
export async function POST(request: NextRequest) {
  const faucetAccountId = process.env.NEAR_FAUCET_ACCOUNT_ID;
  const faucetPrivateKey = process.env.NEAR_FAUCET_PRIVATE_KEY;
  const testnetFaucetUrl = process.env.NEAR_TESTNET_FAUCET_API_URL;
  const useExternalTestnetFaucet =
    NEAR_NETWORK === "testnet" &&
    !!testnetFaucetUrl &&
    (!faucetAccountId || !faucetPrivateKey);

  if (!faucetAccountId || !faucetPrivateKey) {
    if (!useExternalTestnetFaucet) {
      return NextResponse.json(
        {
          error:
            "NEAR funding not configured. Set NEAR_FAUCET_ACCOUNT_ID and NEAR_FAUCET_PRIVATE_KEY, or (testnet only) NEAR_TESTNET_FAUCET_API_URL.",
        },
        { status: 503 }
      );
    }
  }

  let body: { accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId in body" }, { status: 400 });
  }

  // Implicit account IDs are 64 hex chars (lowercase)
  if (!/^[a-f0-9]{64}$/.test(accountId)) {
    return NextResponse.json(
      { error: "accountId must be a 64-character hex string (implicit account)" },
      { status: 400 }
    );
  }

  // Option A: external testnet faucet/relayer (e.g. your own service or a public API)
  if (useExternalTestnetFaucet && testnetFaucetUrl) {
    try {
      const url = testnetFaucetUrl.replace(/\/$/, "");
      const res = await fetch(`${url}/near/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: "testnet",
          address: accountId,
          amount: MIN_NEAR_TO_CREATE_IMPLICIT,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        tx_id?: string;
        explorer_url?: string;
        message?: string;
      };
      if (!res.ok) {
        return NextResponse.json(
          { error: "External faucet failed", details: data.message ?? res.statusText },
          { status: 502 }
        );
      }
      if (!data.success) {
        return NextResponse.json(
          { error: "External faucet declined", details: data.message },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        txHash: data.tx_id,
        accountId,
        amount: MIN_NEAR_TO_CREATE_IMPLICIT,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("[near/fund] external faucet", message, e);
      return NextResponse.json(
        { error: "External faucet request failed", details: message },
        { status: 502 }
      );
    }
  }

  // Option B: our own relayer (faucet account)
  try {
    const signer = KeyPairSigner.fromSecretKey(faucetPrivateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const faucetAccount = new Account(faucetAccountId, provider, signer);

    const result = await faucetAccount.sendMoney(accountId, FUND_AMOUNT_YOCTO);
    const txHash =
      typeof result?.transaction_outcome?.id === "string"
        ? result.transaction_outcome.id
        : undefined;

    return NextResponse.json({
      success: true,
      txHash,
      accountId,
      amount: MIN_NEAR_TO_CREATE_IMPLICIT,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[near/fund]", message, e);
    return NextResponse.json(
      { error: "Funding failed", details: message },
      { status: 500 }
    );
  }
}
