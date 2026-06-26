/**
 * Groups an array of quarter objects by year (descending).
 * Requires each quarter to have a `year: number` field.
 */
export function groupByYear<T extends { year: number }>(
  quarters: T[]
): { year: number; quarters: T[] }[] {
  const map = new Map<number, T[]>();
  for (const q of quarters) {
    if (!map.has(q.year)) map.set(q.year, []);
    map.get(q.year)!.push(q);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, qs]) => ({ year, quarters: qs }));
}
