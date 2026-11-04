import { useState } from 'react';
import { panelApi } from '@/api';

/**
 * Buyurtma kartasida "kim yetkazadi" (server: services/courierPool.js, panelOrderView.lokmaCourierView).
 *
 *  • LokmaGo kuryeri buyurtmasi: holat — qutida (kuryer qidirilmoqda) → kuryer oldi (ismi, telefoni) → yo'lda.
 *    Restoran «Yo'lda»ni o'zi bosmaydi — kuryer taomni olganda o'zi belgilaydi.
 *  • 'both' rejimi (LokmaGo admini belgilagan): restoran HAR buyurtmada tanlaydi — «O'zim yetkazaman» / «LokmaGo kuryeri».
 *    Kuryer olgach o'zgartirib bo'lmaydi (server ham rad etadi).
 */
export function LokmaCourierBar({ order: o, courierMode, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (o.fulfillment !== 'delivery' || ['delivered', 'cancelled'].includes(o.status)) return null;

  const isLokma = o.courierParty === 'lokma';
  const lc = o.lokmaCourier || null;
  const open = ['pending', 'accepted', 'preparing', 'ready'].includes(o.status);
  const canChoose = courierMode === 'both' && open && !(isLokma && lc?.assigned);
  if (!isLokma && !canChoose) return null;

  const choose = async (party) => {
    if (busy || o.courierParty === party) return;
    setBusy(true); setErr('');
    try { await panelApi.setCourierParty(o._id, party); onChanged?.(); }
    catch (e) { setErr(e?.message || 'Saqlanmadi'); }
    setBusy(false);
  };

  let status = null;
  if (isLokma) {
    if (o.status === 'delivering') {
      status = { tone: 'bg-purple-50 text-purple-700', icon: 'ti-motorbike', text: `LokmaGo kuryeri${lc?.name ? ` ${lc.name}` : ''} yo‘lda` };
    } else if (lc?.assigned) {
      status = { tone: 'bg-green-50 text-green-700', icon: 'ti-user-check', text: `LokmaGo kuryeri oldi${lc.name ? `: ${lc.name}` : ''} — taom tayyor bo‘lgach unga bering` };
    } else if (o.status === 'pending') {
      status = { tone: 'bg-canvas text-muted', icon: 'ti-info-circle', text: 'Qabul qilganingizdan keyin LokmaGo kuryerlariga ko‘rinadi' };
    } else {
      status = { tone: 'bg-amber-50 text-amber-800', icon: 'ti-search', text: 'LokmaGo kuryeri qidirilmoqda — buyurtma umumiy qutida' };
    }
  }

  return (
    <div className="mx-4 mb-3 space-y-2" data-testid="lokma-courier-bar">
      {status && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ${status.tone}`}>
          <i className={`ti ${status.icon} mt-0.5`} />
          <div className="min-w-0 flex-1">
            <div>{status.text}</div>
            {lc?.phone && <a href={`tel:${lc.phone}`} className="mt-0.5 inline-block underline">{lc.phone}</a>}
            {o.finance?.freeDeliveryByLokma
              ? <div className="mt-0.5 font-normal opacity-80">Mijozga yetkazish tekin (LokmaGo hisobidan)</div>
              : <div className="mt-0.5 font-normal opacity-80">Yetkazish puli kuryerga — sizga taom ulushi tushadi</div>}
          </div>
        </div>
      )}
      {canChoose && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Kim yetkazadi:</span>
          {[['restaurant', 'O‘zim yetkazaman', 'ti-building-store'], ['lokma', 'LokmaGo kuryeri', 'ti-motorbike']].map(([p, label, icon]) => {
            const on = o.courierParty === p;
            return (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => choose(p)}
                aria-pressed={on}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${on ? 'border-brand-400 bg-brand-tint text-brand-600' : 'border-line text-ink hover:bg-canvas'} disabled:opacity-60`}
              >
                <i className={`ti ${icon} mr-1`} />{label}
              </button>
            );
          })}
        </div>
      )}
      {courierMode === 'both' && open && o.courierParty == null && (
        <div className="text-[11px] text-amber-700">Tanlang: tanlanmasa buyurtmani o‘zingiz yetkazasiz deb hisoblanadi.</div>
      )}
      {err && <div className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</div>}
    </div>
  );
}
