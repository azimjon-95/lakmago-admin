/** 1234567 → "1 234 567" (Moliya sahifalarining yagona raqam ko'rinishi). */
export const som = (n) => (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/** Toshkent vaqti bilan: "27.09 14:32". */
export const fmtDateTime = (d) => new Date(d).toLocaleString('ru-RU', {
  timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
