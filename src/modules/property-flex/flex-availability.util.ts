export interface FlexBookedPeriodLike {
  startDate: string;
  endDate: string;
}

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  return toDateOnly(date);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = parseDateOnly(aStart).getTime();
  const aE = parseDateOnly(aEnd).getTime();
  const bS = parseDateOnly(bStart).getTime();
  const bE = parseDateOnly(bEnd).getTime();
  return aS < bE && aE > bS;
}

function isRangeAvailable(
  startISO: string,
  endISO: string,
  periods: FlexBookedPeriodLike[],
): boolean {
  return !periods.some((period) =>
    rangesOverlap(startISO, endISO, period.startDate, period.endDate),
  );
}

/** Primer día (YYYY-MM-DD) desde hoy donde cabe una estadía de stayMonths meses. */
export function findNextAvailableStart(
  periods: FlexBookedPeriodLike[],
  stayMonths: number,
  searchHorizonMonths = 18,
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const searchEnd = new Date(today);
  searchEnd.setMonth(searchEnd.getMonth() + searchHorizonMonths);

  const cursor = new Date(today);
  while (cursor < searchEnd) {
    const startISO = toDateOnly(cursor);
    const endISO = addMonthsISO(startISO, stayMonths);
    if (isRangeAvailable(startISO, endISO, periods)) {
      return startISO;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}
