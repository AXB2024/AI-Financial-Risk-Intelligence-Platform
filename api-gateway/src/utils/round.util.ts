import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function round(value: number, precision = 6): number {
  return new Decimal(value).toDecimalPlaces(precision).toNumber();
}

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function decimalSum(values: Decimal.Value[]): Decimal {
  return values.reduce<Decimal>((sum, value) => sum.plus(value), new Decimal(0));
}

export function toNumericString(value: Decimal.Value, scale = 10): string {
  return new Decimal(value).toDecimalPlaces(scale).toFixed(scale);
}
