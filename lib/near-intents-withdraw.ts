/**
 * Cross-chain withdrawal from NEAR Intents using @defuse-protocol/intents-sdk.
 *
 * Withdrawals work by creating and signing an intent that specifies the transfer to the
 * destination chain; the relayer/solver then executes it (see SDK createWithdrawIntentPrimitive
 * and processWithdrawal). So the flow is: intent → publish → settlement on NEAR → bridge to chain.
 *
 * - NEAR: direct ft_withdraw (near-intents.ts).
 * - Ethereum / Arbitrum / Solana: POA bridge (Passive Service) + POA USDT (*.omft.near).
 * - Base: Omni for now (may fail if Omni has no USDT).
 *
 * Known issue: POA withdrawals (Ethereum, Arbitrum, Solana) can fail with "base58: ... invalid
 * character" from the NEAR Intents relayer. The intent’s receiver_id is the POA token contract id
 * (e.g. sol-...omft.near or eth-0xdac...omft.near); the relayer wrongly tries to base58-decode it.
 * The official app may work because it uses a partner API key; set
 * NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY (from partners.near-intents.org) to try. Otherwise
 * report at https://github.com/near/intents/issues (POA ft_withdraw + base58). "Withdraw to NEAR" works.
 */

import {
  IntentsSDK,
  createIntentSignerNEP413,
  Chains,
  createPoaBridgeRoute,
  createOmniBridgeRoute,
} from "@defuse-protocol/intents-sdk";
import type { OmniBridgeRouteConfig, PoaBridgeRouteConfig, RouteConfig } from "@defuse-protocol/intents-sdk";
import type { JsonRpcProvider } from "@near-js/providers";
import { isValidNearAccountId, normalizeNearAccountId } from "./near-config";

/** Native USDT (Omni). Omni bridge does not list USDT for main chains, so we use POA for cross-chain. */
const USDT_ASSET_ID = "nep141:usdt.tether-token.near";

/** POA bridge USDT asset IDs from Passive Service (bridge.chaindefuser.com supported_tokens). */
const POA_USDT_ETHEREUM_ASSET_ID = "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near" as const;
const POA_USDT_ARBITRUM_ASSET_ID = "nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near" as const;
const POA_USDT_SOLANA_ASSET_ID = "nep141:sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near" as const;

/** Route config we use for cross-chain withdraw (SDK 0.45: POA has no chain; chain comes from assetId prefix). */
export type WithdrawRouteConfig = PoaBridgeRouteConfig | OmniBridgeRouteConfig;

/** All cross-chain USDT via POA (Omni does not have USDT for these chains). Base uses Omni. SDK 0.45: createPoaBridgeRoute() takes no args; chain is inferred from assetId. */
export function getRouteConfigForNetwork(networkId: string): RouteConfig | undefined {
  switch (networkId) {
    case "ethereum":
    case "arbitrum":
    case "solana":
      return createPoaBridgeRoute();
    case "base":
      return createOmniBridgeRoute(Chains.Base);
    default:
      return undefined;
  }
}

/** Asset ID for withdrawal: POA USDT per chain when using POA (chain from networkId); native USDT for Omni (Base). */
function getAssetIdForWithdrawal(routeConfig: WithdrawRouteConfig, networkId: string): string {
  if (routeConfig.route === "poa_bridge") {
    if (networkId === "ethereum") return POA_USDT_ETHEREUM_ASSET_ID;
    if (networkId === "arbitrum") return POA_USDT_ARBITRUM_ASSET_ID;
    if (networkId === "solana") return POA_USDT_SOLANA_ASSET_ID;
  }
  return USDT_ASSET_ID;
}

/**
 * Networks offered for USDT withdraw. NEAR = ft_withdraw; Ethereum/Arbitrum/Solana = POA; Base = Omni (may fail if no USDT).
 */
export const USDT_WITHDRAW_SUPPORTED_NETWORK_IDS = ["near", "ethereum", "arbitrum", "base", "solana"] as const;

export type SignRawHashFn = (input: {
  address: string;
  chainType: "near";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesFromHex(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = h.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++)
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function base64FromBytes(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Create an NEP-413 intent signer that uses Privy's signRawHash.
 * Use with IntentsSDK for cross-chain withdrawals.
 */
export function createPrivyNep413Signer(config: {
  signRawHash: SignRawHashFn;
  accountId: string;
  provider: JsonRpcProvider;
}) {
  const { signRawHash, accountId, provider } = config;
  return createIntentSignerNEP413({
    accountId,
    signMessage: async (nep413Payload: unknown, nep413Hash: Uint8Array | string) => {
      const hashBytes =
        typeof nep413Hash === "string"
          ? bytesFromHex(nep413Hash.startsWith("0x") ? nep413Hash.slice(2) : nep413Hash)
          : nep413Hash;
      const hashHex = `0x${hexFromBytes(hashBytes)}` as `0x${string}`;
      const { signature: sigHex } = await signRawHash({
        address: accountId,
        chainType: "near",
        hash: hashHex,
      });
      const sigBytes = bytesFromHex(sigHex);
      const publicKeyList = await provider.viewAccessKeyList(accountId, {
        finality: "final",
      });
      const firstKey = publicKeyList?.keys?.[0];
      const publicKey =
        typeof firstKey?.public_key === "string"
          ? firstKey.public_key
          : (firstKey?.public_key as { data?: string })?.data ?? "";
      if (!publicKey) throw new Error("No access key found for " + accountId);
      return {
        publicKey,
        signature: "ed25519:" + base64FromBytes(sigBytes),
      };
    },
  });
}

export type ProcessCrossChainWithdrawalParams = {
  signRawHash: SignRawHashFn;
  accountId: string;
  provider: JsonRpcProvider;
  amountRaw: string;
  destinationAddress: string;
  feeInclusive?: boolean;
  /** Required for cross-chain: bridge route (Omni or POA). SDK 0.45: POA route has no chain; we use networkId for asset selection. */
  routeConfig?: WithdrawRouteConfig;
  /** Required when routeConfig is POA: selects which POA USDT asset (ethereum / arbitrum / solana). */
  networkId?: string;
};

export type WithdrawalResult = {
  intentHash: string;
  intentTx?: { hash: string };
  destinationTx?: unknown;
};

/**
 * Process a USDT withdrawal from NEAR Intents to an external chain (Ethereum, Solana, etc.).
 * Uses the same flow as the official NEAR Intents app via IntentsSDK.
 */
export async function processCrossChainWithdrawal(
  params: ProcessCrossChainWithdrawalParams
): Promise<WithdrawalResult> {
  const {
    signRawHash,
    accountId: rawAccountId,
    provider,
    amountRaw,
    destinationAddress,
    feeInclusive = false,
    routeConfig,
    networkId,
  } = params;

  if (!isValidNearAccountId(rawAccountId)) {
    throw new Error(
      "Invalid NEAR account ID for cross-chain withdrawal. Your wallet must be a NEAR account (64-character hex or name.near), not an Ethereum or other chain address."
    );
  }
  const accountId = normalizeNearAccountId(rawAccountId);

  const signer = createPrivyNep413Signer({ signRawHash, accountId, provider });
  const solverRelayApiKey =
    typeof process !== "undefined"
      ? (process.env?.NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY ?? undefined)
      : undefined;
  const sdk = new IntentsSDK({
    referral: "veridoc",
    intentSigner: signer,
    ...(solverRelayApiKey && { solverRelayApiKey }),
  });

  const assetId =
    routeConfig?.route === "poa_bridge" && networkId
      ? getAssetIdForWithdrawal(routeConfig, networkId)
      : USDT_ASSET_ID;

  const result = await sdk.processWithdrawal({
    withdrawalParams: {
      assetId,
      amount: BigInt(amountRaw),
      destinationAddress: destinationAddress.trim(),
      feeInclusive,
      ...(routeConfig && { routeConfig }),
    },
  });

  return {
    intentHash: result.intentHash,
    intentTx: result.intentTx,
    destinationTx: result.destinationTx,
  };
}

export { USDT_ASSET_ID, POA_USDT_ETHEREUM_ASSET_ID, POA_USDT_ARBITRUM_ASSET_ID, POA_USDT_SOLANA_ASSET_ID };
