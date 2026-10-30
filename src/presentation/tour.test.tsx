import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeCard, TOUR_KEY, Tour, type Rect } from "./tour";

const vp = { width: 1200, height: 800 };
const card = { width: 336, height: 160 };

describe("placeCard", () => {
  it("sits below a target with room under it", () => {
    const box: Rect = { top: 100, left: 400, width: 200, height: 60 };
    const pos = placeCard(box, card, vp);
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(172);
    expect(pos.left).toBe(400 + 100 - 168);
  });

  it("flips above a target near the bottom edge", () => {
    const box: Rect = { top: 700, left: 400, width: 200, height: 60 };
    const pos = placeCard(box, card, vp);
    expect(pos.placement).toBe("above");
    expect(pos.top).toBe(700 - 12 - 160);
  });

  it("clamps inside the viewport at both horizontal edges", () => {
    expect(placeCard({ top: 100, left: 0, width: 40, height: 40 }, card, vp).left).toBe(12);
    expect(placeCard({ top: 100, left: 1180, width: 20, height: 40 }, card, vp).left).toBe(
      vp.width - card.width - 12
    );
  });

  it("never returns a negative top for a target above the viewport", () => {
    expect(placeCard({ top: -200, left: 40, width: 40, height: 40 }, card, vp).top).toBe(12);
  });
});

const Targets = () => (
  <div>
    {[
      "shell-head",
      "quick-add",
      "dash-position",
      "tx-filters",
      "page-accounts",
      "page-cards",
      "page-plans",
      "page-loans",
    ].map((id) => (
      <div key={id} data-tour={id} />
    ))}
  </div>
);

describe("Tour", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom has no scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("walks forward through the steps and rings the current target", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <>
        <Targets />
        <Tour open page="overview" onNavigate={vi.fn()} onClose={onClose} />
      </>
    );

    expect(screen.getByText("Step 1 of 8")).toBeTruthy();
    await waitFor(() => expect(container.querySelector(".tour-ring")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 8")).toBeTruthy();
    expect(screen.getByText("Record a movement first")).toBeTruthy();
  });

  it("navigates to the step's page when the workflow moves elsewhere", () => {
    const onNavigate = vi.fn();
    render(
      <>
        <Targets />
        <Tour open page="overview" onNavigate={onNavigate} onClose={vi.fn()} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNavigate).toHaveBeenCalledWith("transactions");
  });

  it("remembers the tour was seen when skipped", () => {
    const onClose = vi.fn();
    render(<Tour open page="overview" onNavigate={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_KEY)).toBe("1");
  });
});
