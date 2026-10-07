import { CashierShift } from '../types';

/**
 * Utility to parse Indonesian date/time strings and ISO strings safely into unix milliseconds
 */
export function parseDateString(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-') return null;

  // Direct parse check (ISO or RFC)
  const direct = Date.parse(trimmed);
  if (!isNaN(direct) && direct > 0) return direct;

  try {
    const cleaned = trimmed.replace(/\./g, ':');
    const monthNames: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      mei: '05',
      may: '05',
      jun: '06',
      jul: '07',
      agu: '08',
      aug: '08',
      sep: '09',
      okt: '10',
      oct: '10',
      nop: '11',
      nov: '11',
      des: '12',
      dec: '12'
    };

    // Match format: "7 Okt 2026, 20:30:19" or "16 Sep 2026, 08:00" or "7 Okt 2026"
    const match = cleaned.match(
      /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (match) {
      const day = match[1].padStart(2, '0');
      const monStr = match[2].toLowerCase().slice(0, 3);
      const mon = monthNames[monStr] || '01';
      const year = match[3];
      const hour = (match[4] || '00').padStart(2, '0');
      const min = (match[5] || '00').padStart(2, '0');
      const sec = (match[6] || '00').padStart(2, '0');
      const iso = `${year}-${mon}-${day}T${hour}:${min}:${sec}`;
      const parsed = Date.parse(iso);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {}

  return null;
}

/**
 * Gets the most accurate timestamp for a cashier shift (end timestamp preferred for closed shifts)
 */
export function getShiftTimestamp(shift: CashierShift): number {
  if (!shift) return 0;
  if (typeof shift.endTimestamp === 'number' && shift.endTimestamp > 0) {
    return shift.endTimestamp;
  }
  const parsedEnd = parseDateString(shift.endTime);
  if (parsedEnd && parsedEnd > 0) {
    return parsedEnd;
  }
  if (typeof shift.startTimestamp === 'number' && shift.startTimestamp > 0) {
    return shift.startTimestamp;
  }
  const parsedStart = parseDateString(shift.startTime);
  if (parsedStart && parsedStart > 0) {
    return parsedStart;
  }
  return 0;
}

/**
 * Checks if a shift is an initial dummy/mock test shift from demo data
 */
export function isMockOrTestShift(shift: CashierShift): boolean {
  if (!shift) return false;
  if (shift.id === 'shift-1' || shift.id === 'shift-test') return true;
  if (shift.notes && shift.notes.includes('ditutup balance 100%') && shift.id === 'shift-1') return true;
  return false;
}

/**
 * Finds the most recently closed shift with high precision
 */
export function getLatestClosedShift(
  shiftHistory: CashierShift[] = [],
  currentShift?: CashierShift | null
): CashierShift | null {
  const list: CashierShift[] = [];

  if (Array.isArray(shiftHistory)) {
    list.push(...shiftHistory);
  }

  if (currentShift && !currentShift.isOpen) {
    if (currentShift.actualCash !== undefined || currentShift.expectedCash !== undefined) {
      const exists = list.some((s) => s.id === currentShift.id);
      if (!exists) {
        list.push(currentShift);
      }
    }
  }

  // Filter only closed shifts with recorded cash
  const closedShifts = list.filter(
    (s) => !s.isOpen && (s.actualCash !== undefined || s.expectedCash !== undefined)
  );

  if (closedShifts.length === 0) return null;

  // If there are real closed shifts, exclude legacy mock shifts (e.g. shift-1)
  const realClosed = closedShifts.filter((s) => !isMockOrTestShift(s));
  const candidatePool = realClosed.length > 0 ? realClosed : closedShifts;

  const sorted = [...candidatePool].sort((a, b) => {
    const timeB = getShiftTimestamp(b);
    const timeA = getShiftTimestamp(a);
    if (timeB !== timeA) return timeB - timeA;
    // Tie-break by shiftNumber descending
    return (b.shiftNumber || 0) - (a.shiftNumber || 0);
  });

  return sorted[0] || null;
}

export interface ResolvedClosingCash {
  amount: number;
  shiftInfo: string;
  source: 'history' | 'current' | 'server' | 'storage' | 'map' | 'fallback';
}

/**
 * Resolves the true closing cash balance from the previous day / previous shift
 */
export function resolveLastClosingCash(options: {
  shiftHistory?: CashierShift[];
  currentShift?: CashierShift | null;
  serverLastClosingCash?: number;
  targetDate?: string;
  dailyMap?: Record<string, number>;
}): ResolvedClosingCash {
  const { shiftHistory, currentShift, serverLastClosingCash, targetDate, dailyMap } = options;

  // 1. Check daily map override for specific review date if provided
  if (targetDate && dailyMap && dailyMap[targetDate] !== undefined) {
    return {
      amount: dailyMap[targetDate],
      shiftInfo: `Revisi Tanggal ${targetDate}`,
      source: 'map'
    };
  }

  // 2. Find the most recently closed shift
  const lastShift = getLatestClosedShift(shiftHistory, currentShift);
  if (lastShift) {
    const val = lastShift.actualCash !== undefined ? lastShift.actualCash : (lastShift.expectedCash || 0);
    const dateLabel = lastShift.endTime || lastShift.startTime || 'Sebelumnya';
    return {
      amount: val,
      shiftInfo: `Shift #${lastShift.shiftNumber || ''} (${dateLabel})`,
      source: 'history'
    };
  }

  // 3. Check persistent marker from server
  if (typeof serverLastClosingCash === 'number' && serverLastClosingCash > 0) {
    return {
      amount: serverLastClosingCash,
      shiftInfo: 'Penutupan Kas Terakhir Cloud/Server',
      source: 'server'
    };
  }

  // 4. Check persistent localStorage marker
  try {
    const saved = localStorage.getItem('athree_last_closing_cash');
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val >= 0) {
        return {
          amount: val,
          shiftInfo: 'Penutupan Kas Terakhir',
          source: 'storage'
        };
      }
    }
  } catch {}

  // 5. Check daily starting cash map for today's date if stored
  try {
    const savedMap = localStorage.getItem('athree_daily_starting_cash');
    if (savedMap) {
      const map = JSON.parse(savedMap);
      const todayStr = new Date().toISOString().split('T')[0];
      if (map[todayStr] !== undefined && Number(map[todayStr]) >= 0) {
        return {
          amount: Number(map[todayStr]),
          shiftInfo: `Saldo Awal Harian (${todayStr})`,
          source: 'map'
        };
      }
    }
  } catch {}

  // 6. Default fallback
  return {
    amount: 500000,
    shiftInfo: 'Modal Standar',
    source: 'fallback'
  };
}
