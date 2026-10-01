/*
 * ═══════════════════════════════════════════════════════════
 * TOP JOYLAR (PIN) — VAQT, TO'QNASHUV, HISOB-KITOB (sof funksiyalar)
 * ═══════════════════════════════════════════════════════════
 * Qoidalar serverdagi bilan AYNAN bir xil (lakmago-server services/restaurantPins.js):
 * oraliq [boshlanish, tugash) — chegara teng bo'lsa kesishmaydi; bir o'rin bir vaqtda
 * bitta restoranga; bir restoran bir vaqtda bitta o'rinda. Panel shu qoidani
 * OLDINDAN ko'rsatadi (serverga ketmasdan), server baribir qayta tekshiradi.
 *
 * VAQT: hamma narsa TOSHKENT vaqti (UTC+5, yozgi vaqt yo'q). Admin qurilmasi
 * qaysi mintaqada bo'lishidan qat'i nazar, "18:00" — Toshkentdagi 18:00.
 */

const OFFSET_MS = 5 * 60 * 60_000;
export const POSITIONS = [1, 2, 3];
const MIN = 60_000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;

/** Tezkor muddatlar (boshlanishga qo'shiladi) */
export const DURATIONS = [
  { label: '1 soat', ms: HOUR },
  { label: '1 kun', ms: DAY },
  { label: '3 kun', ms: 3 * DAY },
  { label: '7 kun', ms: 7 * DAY },
  { label: '30 kun', ms: 30 * DAY },
];

/** Date → "YYYY-MM-DDTHH:mm" (Toshkent devor soati) — <input type="datetime-local"> uchun. */
export function toInputValue(date) {
  const d = new Date(new Date(date).getTime() + OFFSET_MS);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 16) : '';
}

/** "YYYY-MM-DDTHH:mm" (Toshkent devor soati) → UTC ISO matn; noto'g'ri bo'lsa null. */
export function fromInputValue(str) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(str || ''))) return null;
  const ms = Date.parse(`${str}:00Z`) - OFFSET_MS;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** "03.10 18:00" (Toshkent) */
export function fmtDT(d) {
  if (!d) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d)).replace(',', '');
}

/** "faol" | "rejalashtirilgan" | "tugagan" | "bekor" */
export function pinState(p, now = Date.now()) {
  if (p.cancelledAt) return 'cancelled';
  if (new Date(p.endsAt).getTime() <= now) return 'ended';
  if (new Date(p.startsAt).getTime() <= now) return 'active';
  return 'scheduled';
}

/** Qolgan vaqt: "2 soat 10 daq", "3 kun 4 soat", "5 daq", "tugadi" */
export function remainingText(end, now = Date.now()) {
  let ms = new Date(end).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'tugadi';
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const h = Math.floor(ms / HOUR); ms -= h * HOUR;
  const m = Math.ceil(ms / MIN);
  if (d > 0) return h > 0 ? `${d} kun ${h} soat` : `${d} kun`;
  if (h > 0) return m > 0 && m < 60 ? `${h} soat ${m} daq` : `${h} soat`;
  return `${Math.max(1, m)} daq`;
}

/** Faol/rejalashtirilgan (bekor qilinmagan, tugamagan) pinlar */
export const livePins = (pins, now = Date.now()) => pins.filter((p) => ['active', 'scheduled'].includes(pinState(p, now)));

/**
 * Nomzod pin boshqa pin bilan to'qnashadimi.
 * @returns {{ type: 'position'|'restaurant', pin: object } | null}
 *   position — o'rin shu oraliqda band; restaurant — bu restoran shu vaqtda boshqa o'rinda.
 */
export function findConflict(pins, { restaurantId, position, startsAt, endsAt, excludeId }, now = Date.now()) {
  const s = new Date(startsAt).getTime(); const e = new Date(endsAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  const overlapping = livePins(pins, now)
    .filter((p) => p._id !== excludeId)
    .filter((p) => new Date(p.startsAt).getTime() < e && new Date(p.endsAt).getTime() > s)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const slot = overlapping.find((p) => p.position === position);
  if (slot) return { type: 'position', pin: slot };
  const same = overlapping.find((p) => String(p.restaurantId) === String(restaurantId) && p.position !== position);
  return same ? { type: 'restaurant', pin: same } : null;
}

/** Tushunarli xabar (panelda ko'rsatish uchun) */
export function conflictMessage(c, position) {
  if (!c) return '';
  const name = c.pin.restaurant?.name || 'restoran';
  return c.type === 'position'
    ? `${position}-o‘rin ${fmtDT(c.pin.startsAt)} — ${fmtDT(c.pin.endsAt)} oralig‘ida band: ${name}`
    : `Bu restoran shu vaqtda ${c.pin.position}-o‘rinda pin qilingan (${fmtDT(c.pin.startsAt)} — ${fmtDT(c.pin.endsAt)})`;
}

/**
 * Shu o'rin, berilgan davomiylikka, `from` dan keyin ENG ERTA qachon bo'sh.
 * "Band" xabaridan keyin: "bo'shaydigan vaqtdan boshlash" tugmasi shuni ishlatadi.
 * @returns {number} ms (UTC)
 */
export function nextFreeStart(pins, position, from, durationMs, now = Date.now()) {
  const rows = livePins(pins, now)
    .filter((p) => p.position === position)
    .map((p) => [new Date(p.startsAt).getTime(), new Date(p.endsAt).getTime()])
    .sort((a, b) => a[0] - b[0]);
  let cursor = from;
  for (const [s, e] of rows) {
    if (e <= cursor) continue;
    if (s >= cursor + durationMs) break; // oraliq shu bo'shliqqa sig'adi
    cursor = Math.max(cursor, e);
  }
  return cursor;
}

/** Har o'rin uchun: hozir faol pin va kelgusi (rejalashtirilgan) pinlar vaqt tartibida. */
export function slotsView(pins, now = Date.now()) {
  return POSITIONS.map((position) => {
    const mine = livePins(pins, now)
      .filter((p) => p.position === position)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return {
      position,
      active: mine.find((p) => pinState(p, now) === 'active') || null,
      upcoming: mine.filter((p) => pinState(p, now) === 'scheduled'),
    };
  });
}

/**
 * Formani tekshirish → { error } yoki { startsAt, endsAt } (UTC ISO).
 * "Hozirdan" — boshlanish `now`. Xabarlar serverdagi qoidalar bilan mos.
 */
export function validateForm({ restaurantId, position, startNow, startInput, endInput }, now = Date.now()) {
  if (!restaurantId) return { error: 'Restoranni tanlang' };
  if (!POSITIONS.includes(position)) return { error: 'O‘rinni tanlang (1, 2 yoki 3)' };
  const startsAt = startNow ? new Date(now).toISOString() : fromInputValue(startInput);
  if (!startsAt) return { error: 'Boshlanish vaqtini kiriting' };
  const endsAt = fromInputValue(endInput);
  if (!endsAt) return { error: 'Tugash vaqtini kiriting' };
  const s = new Date(startsAt).getTime(); const e = new Date(endsAt).getTime();
  if (e <= s) return { error: 'Tugash vaqti boshlanishdan keyin bo‘lishi kerak' };
  if (e <= now) return { error: 'Tugash vaqti o‘tib ketgan' };
  if (e - s < 5 * MIN) return { error: 'Pin muddati kamida 5 daqiqa bo‘lsin' };
  if (e - s > 400 * DAY) return { error: 'Pin muddati 400 kundan oshmasin' };
  if (!startNow && s < now - 10 * MIN) return { error: 'Boshlanish vaqti o‘tib ketgan' };
  return { startsAt, endsAt };
}
