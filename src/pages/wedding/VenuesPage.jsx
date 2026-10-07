import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { weddingApi } from '@/api';
import { confirm, confirmWithReason } from '@/components/ui/confirm';
import { PageHeader, ErrorBox, Empty, Badge, SubBadge, VENUE_STATUS, som } from './common';

/* To'yxonalar ro'yxati: qidiruv, holat filtri, obuna holati, bloklash */
export function VenuesPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setList(await weddingApi.venues({ status, q: q.trim() || undefined })); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [status, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const block = async (v) => {
    const reason = await confirmWithReason(`"${v.name}" bloklansinmi? Mijozlarga ko'rinmaydi, yangi bron qabul qilinmaydi.`, 'Sabab (majburiy): masalan, to‘lov qilinmagan');
    if (reason === false) return;
    if (!String(reason || '').trim() || String(reason).trim().length < 2) { setErr('Bloklash sababini yozing'); return; }
    setBusy(v._id);
    try { const r = await weddingApi.blockVenue(v._id, String(reason).trim()); setList((l) => l.map((x) => (x._id === v._id ? r : x))); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const unblock = async (v) => {
    if (!await confirm({ title: `"${v.name}" blokdan chiqarilsinmi?` })) return;
    setBusy(v._id);
    try { const r = await weddingApi.unblockVenue(v._id); setList((l) => l.map((x) => (x._id === v._id ? r : x))); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <PageHeader title="To'yxonalar" subtitle="Ma'lumotlar, zallar, seanslar, menyu va oylik to'lov">
        <button onClick={() => navigate('/weddings/venues/new')}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white flex items-center gap-2">
          <i className="ti ti-plus" /> Yangi to'yxona
        </button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <label className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nomi, tuman, egasi yoki telefon"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-line bg-surface text-sm outline-none focus:border-brand-400" />
        </label>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1">
          {[['', 'Hammasi'], ['active', 'Faol'], ['hidden', 'Yashirin'], ['blocked', 'Blok']].map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${status === k ? 'bg-brand-400 text-brand-text' : 'text-muted hover:bg-canvas'}`}>{l}</button>
          ))}
        </div>
      </div>

      <ErrorBox error={err} onRetry={load} />

      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : list.length === 0 ? <Empty icon="ti-building-castle">To'yxona topilmadi</Empty>
          : (
            <div className="grid gap-3">
              {list.map((v) => {
                const st = VENUE_STATUS[v.status] || VENUE_STATUS.active;
                const cap = (v.halls || []).reduce((m, h) => Math.max(m, h.capacity_max || 0), 0);
                return (
                  <div key={v._id} className={`bg-surface border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${v.status === 'blocked' ? 'border-red-200' : 'border-line'}`}>
                    <button onClick={() => navigate(`/weddings/venues/${v._id}`)} className="flex items-start gap-3 min-w-0 flex-1 text-left">
                      <div className="w-14 h-14 rounded-xl bg-canvas overflow-hidden flex-none flex items-center justify-center">
                        {v.photos?.[0] ? <img src={v.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : <i className="ti ti-building-castle text-2xl text-muted" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-ink">{v.name}</span>
                          <Badge cls={st.cls}>{st.label}</Badge>
                          <SubBadge s={v.subscription_state} />
                        </div>
                        <div className="text-xs text-muted mt-0.5 truncate">
                          {[v.district, `${(v.halls || []).length} zal`, cap && `${cap} kishigacha`, v.owner?.name, v.owner?.phone].filter(Boolean).join(' · ')}
                        </div>
                        {v.subscription?.monthly_fee > 0 && (
                          <div className="text-xs text-muted mt-0.5">
                            Oylik: <b className="text-ink">{som(v.subscription.monthly_fee)} so'm</b>
                            {v.subscription.paid_until && ` · ${v.subscription.paid_until} gacha to'langan`}
                          </div>
                        )}
                        {v.status === 'blocked' && v.block_reason && <div className="text-xs text-red-600 mt-0.5">Sabab: {v.block_reason}</div>}
                      </div>
                    </button>
                    <div className="flex gap-2 sm:flex-none">
                      <button onClick={() => navigate(`/weddings/venues/${v._id}`)} className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-line text-sm text-ink hover:bg-canvas">
                        <i className="ti ti-pencil" /> Ochish
                      </button>
                      {v.status === 'blocked' ? (
                        <button disabled={busy === v._id} onClick={() => unblock(v)} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50">
                          <i className="ti ti-lock-open" /> Blokdan chiqarish
                        </button>
                      ) : (
                        <button disabled={busy === v._id} onClick={() => block(v)} className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50">
                          <i className="ti ti-lock" /> Bloklash
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}
