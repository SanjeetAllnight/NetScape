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

// Canvas & ObjectURL stubs for jsdom environment (PDF generation, schematic rendering, Blob downloads)
if (typeof HTMLCanvasElement !== "undefined") {
  const blankPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  HTMLCanvasElement.prototype.toDataURL = function () {
    return blankPng;
  };

  const dummyCtx: Partial<CanvasRenderingContext2D> = {
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 } as TextMetrics),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    createImageData: ((..._args: unknown[]) => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    })) as unknown as CanvasRenderingContext2D["createImageData"],
    putImageData: () => {},
    drawImage: () => {},
  };

  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === "2d") {
      return dummyCtx as CanvasRenderingContext2D;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof window !== "undefined" && window.URL) {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:netscape-mock-url";
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {};
  }
}
