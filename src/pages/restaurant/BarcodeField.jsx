import { useState } from 'react';
import { panelApi } from '@/api';

/*
 * Shtrix-kod maydoni (do'kon mahsuloti). Majburiy emas:
 *   • mahsulot ustidagi kodni o'zingiz yozasiz, YOKI
 *   • "Yaratish" tugmasi — server unikal EAN-13 beradi (ichki prefiks 200,
 *     boshqa do'konlar va haqiqiy ishlab chiqaruvchi kodlari bilan to'qnashmaydi).
 * Kod mahsulot saqlanganda yoziladi; do'kon ichida takrorlansa server rad etadi.
 */
export function BarcodeField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await panelApi.generateBarcode();
      onChange(r.barcode);
    } catch (e) { setErr(e.message || 'Yaratib bo‘lmadi'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-ink mb-1">Shtrix-kod</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
          inputMode="numeric"
          placeholder="Ixtiyoriy"
          maxLength={32}
          className="inp min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          title="Unikal shtrix-kod yaratish"
          className="flex-none rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink active:bg-canvas disabled:opacity-50 flex items-center gap-1.5"
        >
          <i className={`ti ${busy ? 'ti-loader-2 animate-spin' : 'ti-wand'} text-base`} />
          Yaratish
        </button>
      </div>
      <p className="text-[11px] text-muted mt-1">Yozilmasa ham bo‘ladi. Tugma bilan tizim o‘zi unikal kod beradi.</p>
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
    </div>
  );
}
