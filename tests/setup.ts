import "@testing-library/jest-dom/vitest";

// Fix Node 24 native undici Request vs jsdom AbortSignal prototype mismatch in Vitest
const OriginalRequest = globalThis.Request;
if (OriginalRequest) {
  globalThis.Request = class extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init && "signal" in init) {
        const { signal: _, ...rest } = init;
        super(input, rest);
      } else {
        super(input, init);
      }
    }
  } as typeof OriginalRequest;
}
