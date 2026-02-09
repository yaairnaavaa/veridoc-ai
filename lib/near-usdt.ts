/**
 * USDT (NEP-141) on the user's NEAR account.
 * Balance is held in the account; deposit = receive at account address; withdraw = ft_transfer to another NEAR account.
 */

import { actionCreators } from "@near-js/transactions";
import { NEAR_RPC_URL, USDT_CONTRACT_ID } from "./near-config";

function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(str)));
}

/** USDT contract (NEP-141). */
export { USDT_CONTRACT_ID };

/** Get USDT balance for a NEAR account (ft_balance_of). Returns raw string (6 decimals). */
export async function getUsdtBalance(accountId: string): Promise<string> {
  const params = {
    request_type: "call_function",
    finality: "final",
    account_id: USDT_CONTRACT_ID,
    method_name: "ft_balance_of",
    args_base64: toBase64(JSON.stringify({ account_id: accountId })),
  };
  const res = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "usdt-balance",
      method: "query",
      params,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  const result = data.result;
  if (!result.result || !Array.isArray(result.result)) return "0";
  const bytes = new Uint8Array(result.result);
  const decoded = JSON.parse(new TextDecoder().decode(bytes));
  return String(decoded ?? "0");
}

/** Format USDT balance for display (6 decimals). */
export function formatUsdtBalance(raw: string): string {
  const n = BigInt(raw);
  const div = BigInt(10) ** BigInt(6);
  const int = n / div;
  const frac = (n % div).toString().padStart(6, "0").slice(0, 2);
  return `${int.toLocaleString("en-US")}.${frac}`;
}

/** USDT has 6 decimals. */
export const USDT_DECIMALS = 6;

/** Parse human amount to raw (e.g. "10.5" -> "10500000"). */
export function parseUsdtAmount(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n) || n < 0) return "0";
  return (BigInt(Math.round(n * 1e6))).toString();
}

const FT_TRANSFER_GAS = BigInt(50) * BigInt(10) ** BigInt(12);
const FT_TRANSFER_DEPOSIT = BigInt(1);

/**
 * Build a single ft_transfer action to send USDT from the signer to receiver_id.
 * Use with Account.signAndSendTransaction(USDT_CONTRACT_ID, [action]) or with signedDelegate for relay.
 */
export function createTransferUsdtAction(amountRaw: string, receiverId: string) {
  return actionCreators.functionCall(
    "ft_transfer",
    { receiver_id: receiverId, amount: amountRaw, memo: null },
    FT_TRANSFER_GAS,
    FT_TRANSFER_DEPOSIT
  );
}

/** Encode SignedDelegate to base64 for sending to the relay API. */
export function signedDelegateToBase64(encodedBytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(encodedBytes).toString("base64");
  return btoa(String.fromCharCode(...encodedBytes));
}

// --- NEP-145 Storage (for first-time USDT recipient) ---

/** Call a view method on the USDT contract and decode JSON result. */
async function viewUsdt<T>(methodName: string, args: Record<string, unknown>): Promise<T> {
  const params = {
    request_type: "call_function",
    finality: "final",
    account_id: USDT_CONTRACT_ID,
    method_name: methodName,
    args_base64: toBase64(JSON.stringify(args)),
  };
  const res = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "usdt-view", method: "query", params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  const result = data.result;
  if (!result?.result || !Array.isArray(result.result)) {
    return null as T;
  }
  const bytes = new Uint8Array(result.result);
  const json = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(json) as T;
  } catch {
    return null as T;
  }
}

/** NEP-145: storage_balance_of. Returns { total, available } or null if account not registered. */
export async function storageBalanceOf(accountId: string): Promise<{ total: string; available: string } | null> {
  const out = await viewUsdt<{ total: string; available: string } | null>("storage_balance_of", {
    account_id: accountId,
  });
  return out ?? null;
}

/** Whether the account has storage registered on the USDT contract (can receive USDT). */
export async function hasStorageDeposit(accountId: string): Promise<boolean> {
  const balance = await storageBalanceOf(accountId);
  return balance != null;
}

/** Typical NEP-145 storage deposit for one FT account (~0.00125 NEAR) in yoctoNEAR. */
const STORAGE_DEPOSIT_ONE_ACCOUNT = "1250000000000000000000";

/** NEP-145: build storage_deposit action to register an account for USDT. Deposit paid by signer (e.g. relayer). */
export function createStorageDepositAction(accountId: string, depositYocto: string = STORAGE_DEPOSIT_ONE_ACCOUNT) {
  return actionCreators.functionCall(
    "storage_deposit",
    { account_id: accountId },
    BigInt(50) * BigInt(10) ** BigInt(12),
    BigInt(depositYocto)
  );
}
