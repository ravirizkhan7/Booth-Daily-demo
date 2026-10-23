import { Shift } from '../../types';
import { getOperationalDate } from '../../utils/shiftCalculation';

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function filterShiftsForTest(
  shifts: Shift[],
  {
    filterPeriod,
    filterType,
    customStartDate = '',
    customEndDate = '',
    now = new Date(),
    cutoffTime = '04:00',
  }: {
    filterPeriod: 'all' | 'today' | 'week' | 'month' | 'custom';
    filterType: 'shift_time' | 'operational_date';
    customStartDate?: string;
    customEndDate?: string;
    now?: Date;
    cutoffTime?: string;
  }
): Shift[] {
  const currentOperationalDate = getOperationalDate(now, cutoffTime);
  const currentActualDate = toLocalDateString(now);

  return shifts.filter(shift => {
    if (filterPeriod === 'all') return true;

    let shiftDateStr: string;
    if (filterType === 'operational_date') {
      shiftDateStr = shift.operational_date || getOperationalDate(new Date(shift.opened_at), cutoffTime);
    } else {
      shiftDateStr = toLocalDateString(new Date(shift.opened_at));
    }

    if (filterPeriod === 'today') {
      const targetToday = filterType === 'operational_date' ? currentOperationalDate : currentActualDate;
      return shiftDateStr === targetToday;
    }

    if (filterPeriod === 'week') {
      let targetEndStr: string;
      let targetStartStr: string;

      if (filterType === 'operational_date') {
        targetEndStr = currentOperationalDate;
        const [y, m, d] = currentOperationalDate.split('-').map(Number);
        const startDate = new Date(y, m - 1, d - 6);
        targetStartStr = toLocalDateString(startDate);
      } else {
        targetEndStr = currentActualDate;
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        targetStartStr = toLocalDateString(startDate);
      }

      return shiftDateStr >= targetStartStr && shiftDateStr <= targetEndStr;
    }

    if (filterPeriod === 'month') {
      const targetMonth = filterType === 'operational_date'
        ? currentOperationalDate.slice(0, 7)
        : currentActualDate.slice(0, 7);
      return shiftDateStr.startsWith(targetMonth);
    }

    if (filterPeriod === 'custom') {
      if (customStartDate && shiftDateStr < customStartDate) return false;
      if (customEndDate && shiftDateStr > customEndDate) return false;
      return true;
    }

    return true;
  });
}

export function runShiftDateFilterTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — SHIFT DATE & PERIOD FILTERS VALIDATION SUITE');
  console.log('===============================================================');

  // Anggap 'now' adalah 23 Oktober 2026 jam 02:00 WIB (sebelum cutoff 04:00)
  // Di UTC, ini adalah 22 Oktober 2026 jam 19:00 UTC
  const mockNowEarlyMorning = new Date(2026, 9, 23, 2, 0, 0); // 23 Okt 2026 02:00
  const mockNowAfternoon = new Date(2026, 9, 23, 14, 0, 0);   // 23 Okt 2026 14:00

  const mockShifts: Shift[] = [
    // Shift 1: Dibuka kemarin siang 22 Okt 11:00
    {
      id: 'shift-1',
      shift_number: 'SH-001',
      operational_date: '2026-10-22',
      status: 'closed',
      opened_at: new Date(2026, 9, 22, 11, 0, 0).toISOString(),
      closed_at: new Date(2026, 9, 22, 18, 0, 0).toISOString(),
      opened_by_user_id: 'usr-1',
      opened_by_name: 'Budi',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 22, 11, 0, 0).toISOString(),
    },
    // Shift 2: Lintas tengah malam, buka 22 Okt 23:30, tutup 23 Okt 02:30 (operational_date: 2026-10-22)
    {
      id: 'shift-2',
      shift_number: 'SH-002',
      operational_date: '2026-10-22',
      status: 'closed',
      opened_at: new Date(2026, 9, 22, 23, 30, 0).toISOString(),
      closed_at: new Date(2026, 9, 23, 2, 30, 0).toISOString(),
      opened_by_user_id: 'usr-1',
      opened_by_name: 'Budi',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 22, 23, 30, 0).toISOString(),
    },
    // Shift 3: Dibuka subuh 23 Okt 01:30 (sebelum cutoff 04:00, jadi operational_date: 2026-10-22)
    {
      id: 'shift-3',
      shift_number: 'SH-003',
      operational_date: '2026-10-22',
      status: 'closed',
      opened_at: new Date(2026, 9, 23, 1, 30, 0).toISOString(),
      closed_at: new Date(2026, 9, 23, 3, 30, 0).toISOString(),
      opened_by_user_id: 'usr-2',
      opened_by_name: 'Dinda',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 23, 1, 30, 0).toISOString(),
    },
    // Shift 4: Dibuka 23 Okt 08:00 (setelah cutoff 04:00, operational_date: 2026-10-23)
    {
      id: 'shift-4',
      shift_number: 'SH-004',
      operational_date: '2026-10-23',
      status: 'closed',
      opened_at: new Date(2026, 9, 23, 8, 0, 0).toISOString(),
      closed_at: new Date(2026, 9, 23, 13, 0, 0).toISOString(),
      opened_by_user_id: 'usr-2',
      opened_by_name: 'Dinda',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 23, 8, 0, 0).toISOString(),
    },
    // Shift 5: Shift 7 hari lalu (16 Okt 2026)
    {
      id: 'shift-5',
      shift_number: 'SH-005',
      operational_date: '2026-10-16',
      status: 'closed',
      opened_at: new Date(2026, 9, 16, 9, 0, 0).toISOString(),
      closed_at: new Date(2026, 9, 16, 15, 0, 0).toISOString(),
      opened_by_user_id: 'usr-1',
      opened_by_name: 'Budi',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 16, 9, 0, 0).toISOString(),
    },
    // Shift 6: Shift 6 hari lalu (17 Okt 2026 - batas masuk 7 hari)
    {
      id: 'shift-6',
      shift_number: 'SH-006',
      operational_date: '2026-10-17',
      status: 'closed',
      opened_at: new Date(2026, 9, 17, 8, 30, 0).toISOString(),
      closed_at: new Date(2026, 9, 17, 14, 0, 0).toISOString(),
      opened_by_user_id: 'usr-1',
      opened_by_name: 'Budi',
      cash_initial: 100000,
      created_at: new Date(2026, 9, 17, 8, 30, 0).toISOString(),
    },
    // Shift 7: Shift bulan lalu (30 September 2026)
    {
      id: 'shift-7',
      shift_number: 'SH-007',
      operational_date: '2026-09-30',
      status: 'closed',
      opened_at: new Date(2026, 8, 30, 10, 0, 0).toISOString(),
      closed_at: new Date(2026, 8, 30, 17, 0, 0).toISOString(),
      opened_by_user_id: 'usr-1',
      opened_by_name: 'Budi',
      cash_initial: 100000,
      created_at: new Date(2026, 8, 30, 10, 0, 0).toISOString(),
    },
  ];

  // -------------------------------------------------------------------------
  // Test 1: Early morning around UTC/local date boundary
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Early Morning Around UTC/Local Boundary ---');
  // Jam 02:00 WIB tanggal 23 Okt. Di UTC jam 19:00 tgl 22 Okt.
  // Dengan basis 'shift_time', filter 'today' harus mencocokkan shift-3 (opened_at jam 01:30 WIB tgl 23 Okt)
  const t1Actual = filterShiftsForTest(mockShifts, {
    filterPeriod: 'today',
    filterType: 'shift_time',
    now: mockNowEarlyMorning,
  });
  if (!t1Actual.some(s => s.id === 'shift-3')) {
    throw new Error(`Test 1 Gagal: shift-3 (dibuka 01:30 tanggal 23) harus masuk filter today pada basis shift_time`);
  }
  console.log('✓ TEST 1 PASS: Filter local date boundary berfungsi akurat tanpa bug UTC offset.');

  // -------------------------------------------------------------------------
  // Test 2: Shift crossing midnight with operational cutoff (04:00)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Shift Lintas Tengah Malam dengan Cutoff 04:00 ---');
  // Jam 02:00 WIB tgl 23 Okt (sebelum cutoff 04:00).
  // Tanggal operasional sekarang adalah 2026-10-22 (kemarin).
  // Shift-1 (22 Okt), Shift-2 (buka 23:30 tgl 22), dan Shift-3 (buka 01:30 tgl 23) memiliki operational_date 2026-10-22!
  const t2Op = filterShiftsForTest(mockShifts, {
    filterPeriod: 'today',
    filterType: 'operational_date',
    now: mockNowEarlyMorning,
    cutoffTime: '04:00',
  });
  const t2Ids = t2Op.map(s => s.id);
  if (!t2Ids.includes('shift-1') || !t2Ids.includes('shift-2') || !t2Ids.includes('shift-3')) {
    throw new Error(`Test 2 Gagal: shift-1, shift-2, shift-3 harus masuk filter today pada basis operational_date saat dini hari (cutoff 04:00)`);
  }
  if (t2Ids.includes('shift-4')) {
    throw new Error(`Test 2 Gagal: shift-4 (dibuka jam 08:00) tidak boleh masuk tanggal operasional kemarin`);
  }
  console.log('✓ TEST 2 PASS: Shift lintas tengah malam terkategori tepat pada hari operasional sesuai cutoff.');

  // -------------------------------------------------------------------------
  // Test 3: Today, 7-day, Month filters
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Range Filter Today, 7-Day, dan Month ---');
  // Sekarang jam 14:00 WIB tanggal 23 Okt
  const t3Today = filterShiftsForTest(mockShifts, {
    filterPeriod: 'today',
    filterType: 'operational_date',
    now: mockNowAfternoon,
  });
  if (t3Today.length !== 1 || t3Today[0].id !== 'shift-4') {
    throw new Error(`Test 3a Gagal: Pada siang hari tgl 23, today operational harus menghasilkan shift-4 saja`);
  }

  const t3Week = filterShiftsForTest(mockShifts, {
    filterPeriod: 'week',
    filterType: 'operational_date',
    now: mockNowAfternoon,
  });
  // 7 hari dari tgl 23 adalah tgl 17 s/d 23.
  // Shift-6 (17 Okt), Shift-1 (22 Okt), Shift-2 (22 Okt), Shift-3 (22 Okt), Shift-4 (23 Okt) masuk.
  // Shift-5 (16 Okt) dan Shift-7 (30 Sep) KELUAR.
  const t3WeekIds = t3Week.map(s => s.id);
  if (t3WeekIds.includes('shift-5') || t3WeekIds.includes('shift-7')) {
    throw new Error(`Test 3b Gagal: shift 16 Okt dan 30 Sep tidak boleh masuk 7 hari terakhir`);
  }
  if (!t3WeekIds.includes('shift-6') || !t3WeekIds.includes('shift-4')) {
    throw new Error(`Test 3b Gagal: shift-6 (17 Okt) dan shift-4 (23 Okt) harus masuk rentang 7 hari normal`);
  }

  const t3Month = filterShiftsForTest(mockShifts, {
    filterPeriod: 'month',
    filterType: 'operational_date',
    now: mockNowAfternoon,
  });
  // Bulan Oktober 2026: semua shift kecuali shift-7 (September)
  const t3MonthIds = t3Month.map(s => s.id);
  if (t3MonthIds.includes('shift-7')) {
    throw new Error(`Test 3c Gagal: shift-7 (September) tidak boleh masuk filter Bulan Ini`);
  }
  if (t3Month.length !== 6) {
    throw new Error(`Test 3c Gagal: Seluruh 6 shift Oktober harus masuk filter Bulan Ini`);
  }
  console.log('✓ TEST 3 PASS: Today, 7-day, dan Month menyaring data dengan batas normalisasi yang benar.');

  // -------------------------------------------------------------------------
  // Test 4: Switching between operational date and actual timestamp
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Beralih Basis Waktu Shift vs Hari Operasional ---');
  // Ambil shift-3 (dibuka 23 Okt 01:30 WIB, operational_date 22 Okt)
  // Pada tgl 23 siang:
  // - Basis 'shift_time': shift-3 dan shift-4 adalah tgl 23!
  // - Basis 'operational_date': shift-3 adalah tgl 22, hanya shift-4 yang tgl 23!
  const byActual = filterShiftsForTest(mockShifts, {
    filterPeriod: 'today',
    filterType: 'shift_time',
    now: mockNowAfternoon,
  });
  const byOp = filterShiftsForTest(mockShifts, {
    filterPeriod: 'today',
    filterType: 'operational_date',
    now: mockNowAfternoon,
  });

  const byActualIds = byActual.map(s => s.id);
  const byOpIds = byOp.map(s => s.id);

  if (!byActualIds.includes('shift-3') || !byActualIds.includes('shift-4')) {
    throw new Error(`Test 4 Gagal: byActual harus mencakup shift-3 dan shift-4`);
  }
  if (byOpIds.includes('shift-3')) {
    throw new Error(`Test 4 Gagal: byOp pada tgl 23 siang tidak boleh mencakup shift-3 karena operational_date nya adalah 22 Okt`);
  }
  console.log('✓ TEST 4 PASS: Pergantian basis Waktu Shift vs Hari Operasional mengubah hasil data secara konsisten.');

  // -------------------------------------------------------------------------
  // Test 5: Custom Date Range (Start Date == End Date)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Custom Date Range (Start Date == End Date) ---');
  const t5SingleDay = filterShiftsForTest(mockShifts, {
    filterPeriod: 'custom',
    filterType: 'operational_date',
    customStartDate: '2026-10-17',
    customEndDate: '2026-10-17',
    now: mockNowAfternoon,
  });
  if (t5SingleDay.length !== 1 || t5SingleDay[0].id !== 'shift-6') {
    throw new Error(`Test 5 Gagal: Single day custom filter 2026-10-17 harus mengembalikan shift-6 saja`);
  }
  console.log('✓ TEST 5 PASS: Custom date range dengan tanggal awal sama dengan akhir berfungsi presisi.');

  // -------------------------------------------------------------------------
  // Test 6: Empty Results & Reset to All
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Hasil Kosong & Reset Filter ke Semua ---');
  const t6Empty = filterShiftsForTest(mockShifts, {
    filterPeriod: 'custom',
    filterType: 'operational_date',
    customStartDate: '2025-01-01',
    customEndDate: '2025-01-05',
    now: mockNowAfternoon,
  });
  if (t6Empty.length !== 0) {
    throw new Error(`Test 6a Gagal: Filter di tahun 2025 harus menghasilkan array kosong`);
  }

  const t6All = filterShiftsForTest(mockShifts, {
    filterPeriod: 'all',
    filterType: 'operational_date',
    now: mockNowAfternoon,
  });
  if (t6All.length !== mockShifts.length) {
    throw new Error(`Test 6b Gagal: Reset ke 'all' harus mengembalikan seluruh data shift (${mockShifts.length})`);
  }
  console.log('✓ TEST 6 PASS: Hasil kosong menghasilkan array kosong dan reset ke "Semua" memulihkan seluruh data.');

  console.log('\n===============================================================');
  console.log('   SELURUH TEST FILTER SHIFT TANGGAL & PERIODE LULUS (PASS)');
  console.log('===============================================================');
}

// Execute tests if invoked directly
runShiftDateFilterTests();
