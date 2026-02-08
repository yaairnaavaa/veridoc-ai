"use client";

import { Signer, type SignedMessage } from "@near-js/signers";
import type { Transaction, DelegateAction, SignedDelegate } from "@near-js/transactions";
import { Signature, SignedTransaction } from "@near-js/transactions";
import { PublicKey } from "@near-js/crypto";
import { KeyType } from "@near-js/crypto";
import type { Provider } from "@near-js/providers";
import { sha256 } from "@noble/hashes/sha2.js";

/** Converts hex string (with or without 0x) to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = h.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Signs a raw hash with Privy (NEAR extended chain). Returns signature as hex with 0x. */
export type SignRawHashFn = (input: {
  address: string;
  chainType: "near";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

/**
 * NEAR Signer that uses Privy's useSignRawHash for the 'near' chain.
 * Use with Account to sign and send transactions from a Privy-created NEAR wallet.
 */
export class NearPrivySigner extends Signer {
  constructor(
    private readonly signRawHash: SignRawHashFn,
    private readonly accountId: string,
    private readonly provider: Provider
  ) {
    super();
  }

  async getPublicKey(): Promise<PublicKey> {
    const list = await this.provider.viewAccessKeyList(this.accountId, { finality: "final" });
    const keys = list.keys;
    if (!keys?.length) throw new Error(`No access keys found for ${this.accountId}`);
    const first = keys[0];
    const pk = typeof first.public_key === "string" ? first.public_key : (first.public_key as { keyType: number; data: string })?.data ?? "";
    return PublicKey.from(pk);
  }

  async signNep413Message(
    _message: string,
    _accountId: string,
    _recipient: string,
    _nonce: Uint8Array,
    _callbackUrl?: string
  ): Promise<SignedMessage> {
    throw new Error("NEP-413 message signing not implemented for Privy NEAR signer");
  }

  async signTransaction(transaction: Transaction): Promise<[Uint8Array, SignedTransaction]> {
    const encoded = transaction.encode();
    const hash = sha256(encoded);
    const hashHex = `0x${Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
    const { signature: sigHex } = await this.signRawHash({
      address: this.accountId,
      chainType: "near",
      hash: hashHex,
    });
    const sigBytes = hexToBytes(sigHex);
    const signature = new Signature({
      keyType: KeyType.ED25519,
      data: sigBytes,
    });
    const signedTx = new SignedTransaction({ transaction, signature });
    return [hash, signedTx];
  }

  async signDelegateAction(_delegateAction: DelegateAction): Promise<[Uint8Array, SignedDelegate]> {
    throw new Error("Delegate action signing not implemented for Privy NEAR signer");
  }
}
