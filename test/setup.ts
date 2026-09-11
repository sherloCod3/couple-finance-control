/** Environment shims for running the app's tests under Node. */
import "fake-indexeddb/auto";

// jsdom lacks matchMedia (used by the reduced-motion guard in useCountUp).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom lacks IntersectionObserver (used by the scroll-reveal component).
if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverShim {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverShim;
}
