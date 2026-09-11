/** Offline behavior: the UI must reflect connectivity changes live (FIN-01). */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOnline } from "./ui";

describe("offline detection", () => {
  it("tracks browser connectivity events", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
