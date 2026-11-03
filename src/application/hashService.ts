/**
 * Web Crypto SHA-256 canonical hashing service.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §15.3
 *
 * Runs strictly outside Dexie database transactions to avoid transaction timeouts.
 */

import type { HashService } from "@/contracts/engines";
import type { InputHash } from "@/contracts/primitives";
import { canonicalJson } from "@/kernel/json";

export class WebCryptoHashService implements HashService {
  async hashCanonical(value: unknown): Promise<InputHash> {
    const jsonStr = canonicalJson(value);
    const msgUint8 = new TextEncoder().encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex as InputHash;
  }
}

export const defaultHashService = new WebCryptoHashService();
