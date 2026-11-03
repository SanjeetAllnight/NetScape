/**
 * Deterministic rounding and quantization helpers.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §1.1, §2.1, §10.4
 */

import { NO_SIGNAL_RSSI_DBM } from "@/contracts/constants";

/**
 * Deterministically round a number to a specified number of decimal places.
 * Avoids floating point binary representation artifacts.
 */
export function roundToDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round non-finite number: ${value}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(`Decimals must be a non-negative integer: ${decimals}`);
  }

  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return sign * Number(Math.round(Number(abs + "e" + decimals)) + "e-" + decimals);
}

/**
 * Quantize continuous RSSI (dBm) to integer dBm clamped to [-126, 127].
 * Value -127 is reserved for NO_SIGNAL_RSSI_DBM.
 */
export function quantizeRssiDbm(rssiDbm: number): number {
  if (!Number.isFinite(rssiDbm) || rssiDbm <= NO_SIGNAL_RSSI_DBM) {
    return NO_SIGNAL_RSSI_DBM;
  }

  const rounded = Math.round(rssiDbm);
  if (rounded < -126) {
    return -126;
  }
  if (rounded > 127) {
    return 127;
  }
  return rounded;
}
