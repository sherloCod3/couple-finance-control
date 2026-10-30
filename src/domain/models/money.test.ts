import { describe, expect, it } from "vitest";
import { DomainError, Money } from "./money";

describe("Money value object (Section 04 — Money & Math)", () => {
  it("accepts integer cents", () => {
    expect(Money.fromCents(1999).cents).toBe(1999);
  });

  it("rejects fractional cents — no float may enter the domain", () => {
    expect(() => Money.fromCents(10.5)).toThrow(DomainError);
    expect(() => Money.fromCents(Number.NaN)).toThrow(DomainError);
    expect(() => Money.fromCents(Number.POSITIVE_INFINITY)).toThrow(DomainError);
  });

  it("converts decimals at the boundary by rounding into cent space", () => {
    expect(Money.fromDecimal(19.99).cents).toBe(1999);
    expect(Money.fromDecimal(0.1).cents).toBe(10);
    expect(Money.fromDecimal(-5).cents).toBe(-500);
  });

  it("classic float trap stays exact: 0.1 + 0.2 === 0.3", () => {
    const sum = Money.fromDecimal(0.1).add(Money.fromDecimal(0.2));
    expect(sum.eq(Money.fromDecimal(0.3))).toBe(true);
  });

  it("performs pure integer arithmetic", () => {
    const a = Money.fromCents(1050);
    const b = Money.fromCents(325);
    expect(a.add(b).cents).toBe(1375);
    expect(a.sub(b).cents).toBe(725);
    expect(b.sub(a).cents).toBe(-725);
    expect(b.sub(a).abs().cents).toBe(725);
    expect(b.neg().cents).toBe(-325);
  });

  it("rounds non-integer factors back into cent space immediately", () => {
    const midpoint = Money.fromCents(800).add(Money.fromCents(1200)).mulRound(0.5);
    expect(midpoint.cents).toBe(1000);
    expect(Number.isSafeInteger(midpoint.cents)).toBe(true);
  });

  it("compares by value", () => {
    expect(Money.fromCents(1).gt(Money.ZERO)).toBe(true);
    expect(Money.ZERO.isZero()).toBe(true);
    expect(Money.fromCents(-1).isNegative()).toBe(true);
    expect(Money.fromCents(5).gte(Money.fromCents(5))).toBe(true);
    expect(Money.fromCents(4).lt(Money.fromCents(5))).toBe(true);
  });

  it("rejects pathological magnitudes that overflow safe integer cents", () => {
    expect(() => Money.fromDecimal(1e21)).toThrow(DomainError);
    expect(() => Money.fromDecimal(Number.MAX_VALUE)).toThrow(DomainError);
    expect(() => Money.fromDecimal(Number.POSITIVE_INFINITY)).toThrow(DomainError);
    expect(() => Money.fromDecimal(Number.NaN)).toThrow(DomainError);
  });

  it("sums iterables in integer space", () => {
    const total = Money.sum([Money.fromCents(1), Money.fromCents(2), Money.fromCents(3)]);
    expect(total.cents).toBe(6);
    expect(Money.sum([]).cents).toBe(0);
  });
});
