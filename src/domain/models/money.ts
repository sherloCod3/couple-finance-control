/**
 * ADR-010 — Money value object.
 * Monetary math is performed exclusively on integer cents; floating-point
 * arithmetic is forbidden inside the domain (Section 04, "Money & Math").
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class Money {
  private readonly _cents: number;

  private constructor(cents: number) {
    this._cents = cents;
  }

  static readonly ZERO = new Money(0);

  /** The only way to build Money inside the domain. */
  static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new DomainError(`Money must be an integer number of cents, received: ${cents}`);
    }
    return new Money(cents);
  }

  /**
   * Boundary conversion for user input or seed constants expressed in
   * decimal units. Rounds to the nearest cent and immediately returns to
   * integer space — no float ever escapes into calculations.
   */
  static fromDecimal(decimal: number): Money {
    if (!Number.isFinite(decimal)) throw new DomainError("Invalid monetary amount");
    return Money.fromCents(Math.round(decimal * 100));
  }

  get cents(): number {
    return this._cents;
  }

  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  sub(other: Money): Money {
    return new Money(this._cents - other._cents);
  }

  neg(): Money {
    return new Money(-this._cents);
  }

  abs(): Money {
    return new Money(Math.abs(this._cents));
  }

  /**
   * Integer multiplication. A non-integer factor (e.g. 0.5 for a midpoint)
   * is rounded back into cent space immediately; used only for estimates.
   */
  mulRound(factor: number): Money {
    return new Money(Math.round(this._cents * factor));
  }

  eq(other: Money): boolean {
    return this._cents === other._cents;
  }
  gt(other: Money): boolean {
    return this._cents > other._cents;
  }
  gte(other: Money): boolean {
    return this._cents >= other._cents;
  }
  lt(other: Money): boolean {
    return this._cents < other._cents;
  }
  lte(other: Money): boolean {
    return this._cents <= other._cents;
  }
  isZero(): boolean {
    return this._cents === 0;
  }
  isPositive(): boolean {
    return this._cents > 0;
  }
  isNegative(): boolean {
    return this._cents < 0;
  }

  static sum(values: Iterable<Money>): Money {
    let total = 0;
    for (const v of values) total += v.cents;
    return Money.fromCents(total);
  }

  toString(): string {
    return `${this._cents}`;
  }
}
