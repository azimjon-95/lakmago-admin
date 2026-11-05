/** Masofa matni: 8200 → "8,2 km", 640 → "640 m" (server services/deviceCheck.js formatMeters bilan bir xil). */
export function fmtMeters(m) {
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
