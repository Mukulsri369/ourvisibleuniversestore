import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

if (typeof globalThis.DOMRect === "undefined") {
  class MockDOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;

    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.left = x;
      this.right = x + width;
      this.bottom = y + height;
    }

    static fromRect(other?: DOMRectInit) {
      return new MockDOMRect(other?.x ?? 0, other?.y ?? 0, other?.width ?? 0, other?.height ?? 0);
    }

    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left,
      };
    }
  }
  globalThis.DOMRect = MockDOMRect as unknown as typeof DOMRect;
  window.DOMRect = MockDOMRect as unknown as typeof DOMRect;
}

if (typeof window !== "undefined" && typeof window.HTMLMediaElement !== "undefined") {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: () => {},
  });
}
