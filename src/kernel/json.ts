/**
 * Canonical JSON serialization for deterministic input hashing.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §15.3
 *
 * Rules:
 * 1. Lexical sort of object keys.
 * 2. Reject undefined and non-finite numbers (NaN, Infinity, -Infinity).
 * 3. Normalize -0 to 0.
 * 4. Standard UTF-8 / JSON string escaping.
 * 5. Does NOT perform SHA-256 (hashing belongs in application/hashService).
 */

export function canonicalJson(value: unknown): string {
  return serializeValue(value);
}

function serializeValue(val: unknown): string {
  if (val === null) {
    return "null";
  }

  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }

  if (typeof val === "number") {
    if (!Number.isFinite(val)) {
      throw new TypeError(`Cannot canonically serialize non-finite number: ${val}`);
    }
    // Normalize -0 to 0
    if (Object.is(val, -0)) {
      return "0";
    }
    return val.toString();
  }

  if (typeof val === "string") {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    const items = val.map((item) => serializeValue(item));
    return `[${items.join(",")}]`;
  }

  if (typeof val === "object") {
    const record = val as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const entries: string[] = [];

    for (const key of sortedKeys) {
      const propVal = record[key];
      if (propVal === undefined) {
        throw new TypeError(`Cannot canonically serialize undefined value at key "${key}"`);
      }
      entries.push(`${JSON.stringify(key)}:${serializeValue(propVal)}`);
    }

    return `{${entries.join(",")}}`;
  }

  throw new TypeError(`Unsupported type for canonical JSON serialization: ${typeof val}`);
}
