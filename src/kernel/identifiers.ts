/**
 * Stable identifier comparison and format verification helpers.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §1.1, §19.2
 */

// UUID v4 format pattern: 8-4-4-4-12 hex characters with version 4 and variant [89ab]
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Compare two identifiers deterministically by Unicode code point order.
 */
export function compareIdentifiers(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Verify that an identifier has the expected prefix and a valid UUID v4 body.
 */
export function isValidPrefixedId(id: string, expectedPrefix: string): boolean {
  if (typeof id !== "string" || typeof expectedPrefix !== "string") {
    return false;
  }
  if (!id.startsWith(expectedPrefix)) {
    return false;
  }
  const uuidPart = id.slice(expectedPrefix.length);
  return UUID_V4_PATTERN.test(uuidPart);
}
