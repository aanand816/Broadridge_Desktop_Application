/* ───────────────────────────────────────────────
   Calculations Module
   Hour calculation with shift rules & pay logic
   ─────────────────────────────────────────────── */

/* ── Shift Definitions (minutes from midnight) ── */
const SHIFTS = {
    morning: { start: 480 },    // 08:00 – 16:00
    evening: { start: 960 },    // 16:00 – 00:00
    night:   { start: 0 }       // 00:00 – 08:00
};

const SHIFT_DURATION = 480;     // every shift is 8 hours (480 min)

/* ── Time Helpers ── */
function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Floors minutes to the nearest 15-minute (quarter-hour) block.
 * No credit / penalty until a full 15-min block is exceeded.
 *
 *   10 min → 0      14 min → 0
 *   15 min → 15     16 min → 15
 *   29 min → 15     30 min → 30
 */
function roundToQuarter(minutes) {
    return Math.floor(minutes / 15) * 15;
}

/**
 * Overtime-specific rounding: rounds UP at 12+ minutes.
 *   10 min → 0      12 min → 15
 *   14 min → 15     16 min → 15
 *   27 min → 30     28 min → 30
 */
function roundToQuarterOT(minutes) {
    const remainder = minutes % 15;
    const base = Math.floor(minutes / 15) * 15;
    return remainder >= 12 ? base + 15 : base;
}

/**
 * Calculate net working hours based on punch-in/out and shift rules.
 *
 * ── Punch-In Rules ──
 *  • Before shift start → time counted from standard start only (no early credit)
 *  • 1–15 min late      → no penalty (grace period)
 *  • 16+ min late       → deduct in 15-min blocks  (16 min → −15, 31 min → −30)
 *
 * ── Punch-Out Rules ──
 *  • 1–15 min early      → no penalty (grace period)
 *  • 16+ min early       → deduct in 15-min blocks  (3:44 → −15 min)
 *  • 1–11 min overtime   → no credit
 *  • 12+ min overtime    → credit rounded up to 15-min block  (4:12 → +15 min)
 *
 * ── Lunch Deduction ──
 *  • Gross hours ≤ 11.5  → deduct 30 min  (0.5 h)
 *  • Gross hours > 11.5  → deduct 60 min  (1.0 h)
 *
 * ── Result ──
 *  Always in 0.25-hour increments (7.25, 7.50, 7.75, 8.00, …)
 */
function calculateHours(punchIn, punchOut, shift) {
    const shiftKey = shift.toLowerCase();
    const shiftInfo = SHIFTS[shiftKey];
    if (!shiftInfo) return 0;

    const shiftStart = shiftInfo.start;

    /* Convert punch times to minutes from midnight */
    const inMin  = timeToMinutes(punchIn);
    const outMin = timeToMinutes(punchOut);

    /* Normalize relative to shift start (handles midnight crossing) */
    let inRel  = inMin  - shiftStart;
    if (inRel  >  720) inRel  -= 1440;
    if (inRel  < -720) inRel  += 1440;

    let outRel = outMin - shiftStart;
    if (outRel >  720) outRel -= 1440;
    if (outRel < -720) outRel += 1440;

    /* Ensure punch-out is after punch-in */
    if (outRel <= inRel) outRel += 1440;

    /* ── Effective Start ── */
    let effStart;
    if (inRel <= 0) {
        /* Punched in early or on time → cap at shift start */
        effStart = 0;
    } else {
        /* Late → floor to 15-min blocks (1-15 min grace, 16+ penalised) */
        effStart = roundToQuarter(inRel);
    }

    /* ── Effective End ── */
    let effEnd;
    if (outRel < SHIFT_DURATION) {
        /* Left early → deduct quarter-rounded penalty */
        const earlyMin = SHIFT_DURATION - outRel;
        effEnd = SHIFT_DURATION - roundToQuarter(earlyMin);
    } else {
        /* On time or overtime → round up at 12+ min */
        const extraMin = outRel - SHIFT_DURATION;
        effEnd = SHIFT_DURATION + roundToQuarterOT(extraMin);
    }

    /* ── Gross Hours ── */
    const grossMinutes = Math.max(0, effEnd - effStart);
    const grossHours   = grossMinutes / 60;

    /* ── Lunch Deduction ──
       ≤ 11.5 h gross → 30-min break
       > 11.5 h gross → 1-hour break (two 30-min breaks)          */
    let lunchDeduction = 0;
    if (grossHours > 11.5) {
        lunchDeduction = 1.0;
    } else if (grossHours > 0) {
        lunchDeduction = 0.5;
    }

    let netHours = Math.max(0, grossHours - lunchDeduction);

    /* ── Final Quarter Rounding ──
       Ensure result is always in 0.25 increments                  */
    netHours = roundToQuarter(Math.round(netHours * 60)) / 60;

    return netHours;
}


/* ──────────────────────────────────────────
   Pay Calculation
   Overtime kicks in after 44 h per employee/week
   ────────────────────────────────────────── */

function calculatePay(empId, employeeDept, hours, deptData) {
    const dept = deptData.find(d => d.department === employeeDept);
    if (!dept) return { regularHours: hours, overtimeHours: 0, cost: 0, rate: 0, otRate: 0 };

    const rate   = Number(dept.hourly_rate);
    const otRate = Number(dept.overtime_rate);

    /* Sum existing hours for this employee */
    const prevHours = AppData.attendance
        .filter(r => r.emp_id === empId)
        .reduce((sum, r) => sum + Number(r.hours || 0), 0);

    const totalAfterAdd  = prevHours + hours;
    const overtimeHours  = Math.max(totalAfterAdd - 44, 0);
    const regularHours   = overtimeHours > 0 ? Math.max(hours - overtimeHours, 0) : hours;

    const cost = (regularHours * rate) + (overtimeHours * otRate);
    return {
        regularHours:  Math.round(regularHours  * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        cost:          Math.round(cost * 100) / 100,
        rate,
        otRate
    };
}