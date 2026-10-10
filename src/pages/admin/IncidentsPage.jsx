import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';
import { useLockScroll } from '@/hooks/useLockScroll';
import { confirm } from '@/components/ui/confirm';

/*
 * ═══ MUAMMOLI MIJOZLAR ═══
 * Restoran qabul qilgan buyurtmadan mijoz voz kechdi → restoran "Mijoz rad etdi"
 * so'rovini yuboradi → shu yerda admin hal qiladi:
 *   ✅ bekor qilishni tasdiqlash (+ xohlasa naqd to'lovni o'chirish / bloklash, sababi bilan)
 *   ❌ rad etish (buyurtma davom etadi)
 * "Cheklangan mijozlar" — naqd o'chirilgan yoki bloklanganlar, cheklovni olib tashlash.
 * Telegram guruhidagi "Ko'rib chiqish" tugmasi shu sahifani ?id=<hodisa> bilan ochadi.
 */
const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const dt = (d) => (d ? new Date(d).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Bekor qilindi', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Rad etildi', cls: 'bg-canvas text-muted' },
};
// POST rejim (standart): buyurtma restoran tomonidan darhol bekor qilingan, admin faqat baholaydi
const POST_STATUS = {
  pending: { label: 'Ko‘rib chiqilmagan', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Mijoz voz kechgan', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Asossiz', cls: 'bg-canvas text-muted' },
};
const stOf = (i) => (i.mode === 'post' ? POST_STATUS : STATUS)[i.status];
const CODE_LABEL = {
  no_answer: 'Javob bermadi', not_confirmed: 'Tasdiqlamadi',
  refused_not_needed: 'Kerak emas dedi', refused_changed_mind: 'Fikrini o‘zgartirdi', refused_no_answer: 'Javob bermadi (qabuldan keyin)',
  refused_refused_at_door: 'Eshik oldida qabul qilmadi', refused_wrong_address: 'Manzil noto‘g‘ri', refused_other: 'Boshqa (voz kechdi)',
  out: 'Taom tugagan', busy: 'Oshxona band', far: 'Uzoq', closing: 'Yopilish', other: 'Boshqa',
};
const ORDER_STATUS = { accepted: 'Qabul qilingan', preparing: 'Tayyorlanmoqda', ready: 'Tayyor', delivering: "Yo'lda" };
const fullName = (s = {}) => [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Mijoz';

export function IncidentsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const openId = params.get('id');

  const load = useCallback(async () => {
    setErr(null);
    try {
      if (tab === 'restricted' || tab === 'stats') return;
      const r = await adminApi.incidents(tab === 'all' ? '' : tab === 'done' ? '' : 'pending');
      const list = tab === 'done' ? r.items.filter((i) => i.status !== 'pending') : r.items;
      setItems(list); setPending(r.pending);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  // Jonli: yangi so'rov yoki qaror — ro'yxat yangilanadi
  useEffect(() => {
    const s = getSocket(); joinAdmin();
    const on = () => load();
    s.on('incident:new', on); s.on('incident:update', on);
    return () => { s.off('incident:new', on); s.off('incident:update', on); };
  }, [load]);

  const open = (id) => setParams(id ? { id } : {}, { replace: false });

  return (
    <div className="min-w-0 flex-1 p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink sm:text-xl">Muammoli mijozlar</h1>
        <p className="mt-0.5 text-xs text-muted sm:text-sm">Qabul qilingan buyurtmadan voz kechgan mijozlar: bekor qilish, naqdni o‘chirish, bloklash</p>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1 sm:inline-grid">
        {[['pending', `Ko‘rib chiqish${pending ? ` (${pending})` : ''}`], ['done', 'Hal qilingan'], ['stats', 'Tahlil'], ['restricted', 'Cheklanganlar']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${tab === k ? 'bg-brand-400 text-brand-text' : 'text-muted hover:bg-canvas'}`}>{l}</button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}

      {tab === 'stats' ? <StatsView /> : tab === 'restricted' ? <RestrictedList /> : loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
          <i className="ti ti-mood-happy mb-2 block text-3xl opacity-40" />
          {tab === 'pending' ? 'Ko‘rib chiqiladigan so‘rov yo‘q' : 'Hali hal qilingan so‘rov yo‘q'}
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((i) => (
            <button key={i._id} onClick={() => open(i._id)} className={`rounded-xl border bg-surface p-3 text-left transition-colors hover:border-brand-400 ${i.status === 'pending' ? 'border-amber-200' : 'border-line'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{fullName(i.snapshot)}{i.snapshot?.username ? <span className="font-normal text-muted"> · @{i.snapshot.username}</span> : null}</div>
                  <div className="truncate text-xs text-muted">{i.restaurantName} · {i.orderLabel} · {som(i.order?.total)} so'm · {i.order?.paymentMethod === 'cash' ? 'Naqd' : 'Karta'}</div>
                </div>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${stOf(i).cls}`}>{stOf(i).label}</span>
              </div>
              <div className="mt-1.5 text-sm text-ink"><i className="ti ti-message-report text-muted" /> {i.reason}{i.note ? ` — ${i.note}` : ''}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <span>{dt(i.createdAt)}</span>
                {i.snapshot?.previousIncidents > 0 && <span className="font-medium text-red-600">⚠ avval {i.snapshot.previousIncidents} marta</span>}
                {i.decision?.cashDisabled && <span className="text-amber-700">💵 naqd o‘chirildi</span>}
                {i.decision?.blocked && <span className="text-red-600">⛔ bloklandi</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {openId && <IncidentSheet id={openId} onClose={() => open(null)} onDone={() => { open(null); load(); }} />}
    </div>
  );
}

function IncidentSheet({ id, onClose, onDone }) {
  useLockScroll();
  const [data, setData] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState(null);
  // Avtomatik jazo yo'q (TZ): cheklov faqat admin o'zi belgilasa
  const [disableCash, setDisableCash] = useState(false);
  const [block, setBlock] = useState(false);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url = null;
    adminApi.incident(id).then((d) => { setData(d); setMessage(d.defaultMessage || ''); }).catch((e) => setErr(e.message));
    adminApi.incidentPhotoUrl(id).then((u) => { url = u; setPhoto(u); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);

  const decide = async (approve) => {
    if (approve && (disableCash || block) && message.trim().length < 5) { setErr('Mijozga ko‘rsatiladigan sababni yozing'); return; }
    const post = data?.incident?.mode === 'post';
    const ok = await confirm({
      title: post
        ? (approve ? 'Mijoz voz kechgan deb belgilansinmi?' : 'Holat asossiz deb belgilansinmi?')
        : (approve ? 'Buyurtma bekor qilinsinmi?' : 'So‘rov rad etilsinmi?'),
      content: approve
        ? [disableCash && 'mijozning naqd to‘lovi o‘chiriladi', block && 'mijoz bloklanadi'].filter(Boolean).join(', ') || 'Mijozga cheklov qo‘yilmaydi'
        : post ? 'Mijozga hech qanday chora ko‘rilmaydi' : 'Buyurtma bekor qilinmaydi, restoran davom ettiradi',
      tone: approve ? 'danger' : 'warning',
    });
    if (!ok) return;
    setBusy(true); setErr(null);
    try {
      await adminApi.decideIncident(id, { approve, disableCash: approve && disableCash, block: approve && block, customerMessage: message.trim(), note: note.trim() });
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const inc = data?.incident;
  const s = inc?.snapshot || {};
  const user = data?.user;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">Mijoz buyurtmadan voz kechdi</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!inc ? (err ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div> : <div className="py-8 text-center text-sm text-muted">Yuklanmoqda...</div>) : (
            <>
              {/* Mijoz */}
              <div className="mb-4 flex gap-3 rounded-2xl border border-line p-3">
                <div className="h-20 w-20 flex-none overflow-hidden rounded-2xl bg-canvas">
                  {photo || s.photoUrl ? <img src={photo || s.photoUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-muted"><i className="ti ti-user" /></div>}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="text-base font-semibold text-ink">{fullName(s)}</div>
                  {s.username && <a href={`https://t.me/${s.username}`} target="_blank" rel="noreferrer" className="text-brand-600">@{s.username}</a>}
                  <div className="mt-1 space-y-0.5 text-xs text-muted">
                    <div><i className="ti ti-phone" /> {s.phone ? <a href={`tel:${s.phone}`} className="text-ink">{s.phone}</a> : '—'}</div>
                    <div><i className="ti ti-brand-telegram" /> ID: {s.telegramId || '—'}</div>
                    <div>Ro‘yxatdan o‘tgan: {dt(s.createdAt)} · buyurtmalar: {s.ordersCount ?? '—'}</div>
                    {s.previousIncidents > 0 && <div className="font-medium text-red-600">⚠ Avval {s.previousIncidents} marta buyurtmadan voz kechgan</div>}
                  </div>
                  {user && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {user.cashDisabled?.active && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">💵 Naqd o‘chirilgan</span>}
                      {user.status === 'BLOCKED' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">⛔ Bloklangan</span>}
                    </div>
                  )}
                </div>
              </div>

              {s.addresses?.length > 0 && (
                <Block title="Mijoz manzillari">
                  {s.addresses.map((a, k) => (
                    <div key={k} className="flex items-start justify-between gap-2 py-1 text-sm">
                      <span><b>{a.title || 'Manzil'}</b> — {a.address}{a.city ? `, ${a.city}` : ''}</span>
                      {a.lat && a.lng && <a href={`https://yandex.uz/maps/?pt=${a.lng},${a.lat}&z=17`} target="_blank" rel="noreferrer" className="flex-none text-xs text-brand-600">xarita</a>}
                    </div>
                  ))}
                </Block>
              )}

              <Block title="Buyurtma">
                <div className="text-sm text-ink"><b>{inc.restaurantName}</b> · {inc.orderLabel} · {ORDER_STATUS[inc.orderStatusAtRequest] || inc.orderStatusAtRequest}</div>
                <div className="mt-1 text-xs text-muted">
                  {dt(inc.order?.createdAt)} · {som(inc.order?.total)} so'm · {inc.order?.paymentMethod === 'cash' ? 'Naqd' : 'Karta'}{inc.order?.isPaid ? ' (to‘langan)' : ''}
                  {inc.order?.address ? ` · ${inc.order.address}` : ''}
                </div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {(inc.order?.items || []).map((it, k) => <li key={k}>• {it.name} × {it.qty} <span className="text-muted">({som(it.price)})</span></li>)}
                </ul>
              </Block>

              <Block title="Restoran sababi">
                <div className="text-sm font-medium text-ink">{inc.reason}</div>
                {inc.note && <div className="mt-0.5 text-sm text-ink">💬 {inc.note}</div>}
                <div className="mt-1 text-xs text-muted">{dt(inc.createdAt)}{inc.requestedBy ? ` · ${inc.requestedBy}` : ''}</div>
              </Block>

              {data.history?.length > 0 && (
                <Block title="Mijozning boshqa holatlari">
                  {data.history.map((h) => (
                    <div key={h._id} className="flex justify-between gap-2 py-0.5 text-xs">
                      <span className="text-ink">{h.restaurantName} · {h.orderLabel} — {h.reason}</span>
                      <span className={`flex-none ${h.status === 'approved' ? 'text-red-600' : 'text-muted'}`}>{stOf(h).label} · {dt(h.createdAt)}</span>
                    </div>
                  ))}
                </Block>
              )}

              {inc.status === 'pending' ? (
                <div className="rounded-2xl border border-line p-3">
                  <div className="mb-1 text-sm font-semibold text-ink">Qaror</div>
                  {inc.mode === 'post' && <p className="mb-2 text-xs text-muted">Buyurtma restoran tomonidan allaqachon bekor qilingan. Holatni baholang; cheklov — faqat zarur bo‘lsa.</p>}
                  {data?.settings?.restrictionsEnabled !== false ? (
                    <>
                      <label className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={disableCash} onChange={(e) => setDisableCash(e.target.checked)} /> 💵 Naqd to‘lovni o‘chirish (keyin faqat karta bilan)</label>
                      <label className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> ⛔ Mijozni bloklash (LokmaGo’dan foydalana olmaydi)</label>
                    </>
                  ) : <p className="text-xs text-muted">Mijoz cheklovlari o‘chirilgan (sozlama).</p>}
                  {(disableCash || block) && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-medium text-ink">Mijozga ko‘rsatiladigan sabab</label>
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={600} className="inp resize-none" />
                    </div>
                  )}
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ichki izoh (ixtiyoriy)" className="inp mt-2" />
                  {err && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
                </div>
              ) : (
                <div className={`rounded-2xl p-3 text-sm ${inc.status === 'approved' ? 'bg-red-50 text-red-700' : 'bg-canvas text-muted'}`}>
                  <b>{stOf(inc).label}</b> · {inc.decision?.by} · {dt(inc.decision?.at)}
                  {inc.decision?.cashDisabled && <div>💵 Naqd to‘lov o‘chirildi</div>}
                  {inc.decision?.blocked && <div>⛔ Mijoz bloklandi</div>}
                  {inc.decision?.customerMessage && <div className="mt-1 text-xs">Mijozga: “{inc.decision.customerMessage}”</div>}
                  {inc.decision?.note && <div className="mt-1 text-xs">Izoh: {inc.decision.note}</div>}
                </div>
              )}
            </>
          )}
        </div>
        {inc?.status === 'pending' && (
          <div className="flex gap-2 border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button onClick={() => decide(false)} disabled={busy} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink disabled:opacity-50">
              {inc.mode === 'post' ? 'ℹ️ Asossiz' : '❌ Rad etish'}
            </button>
            <button onClick={() => decide(true)} disabled={busy} className="flex-[1.4] rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Saqlanmoqda...' : inc.mode === 'post' ? '🧾 Mijoz voz kechgan' : '✅ Bekor qilishni tasdiqlash'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="mb-3 rounded-2xl border border-line p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  );
}

/* Cheklangan mijozlar: naqd o'chirilgan / bloklangan — cheklovni boshqarish */
function RestrictedList() {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => adminApi.restrictedCustomers().then((r) => setUsers(r.users)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const change = async (u, patch, title) => {
    if (!await confirm({ title })) return;
    setBusy(u._id); setErr(null);
    try { await adminApi.setCustomerRestrictions(u._id, patch); await load(); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const blockUser = async (u) => {
    const reason = window.prompt('Mijozga ko‘rsatiladigan bloklash sababi:', u.cashDisabled?.reason || '');
    if (!reason || reason.trim().length < 5) return;
    setBusy(u._id); setErr(null);
    try { await adminApi.setCustomerRestrictions(u._id, { block: { active: true, reason: reason.trim() } }); await load(); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  if (!users) return err ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div> : <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>;
  if (!users.length) return <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">Cheklangan mijoz yo‘q</div>;
  return (
    <>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
      <div className="grid gap-2 lg:grid-cols-2">
        {users.map((u) => {
          const blocked = u.status === 'BLOCKED';
          return (
            <div key={u._id} className={`rounded-xl border bg-surface p-3 ${blocked ? 'border-red-200' : 'border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 flex-none overflow-hidden rounded-full bg-canvas">
                  {u.photoUrl ? <img src={u.photoUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted"><i className="ti ti-user" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{fullName(u)}{u.username ? <span className="font-normal text-muted"> · @{u.username}</span> : null}</div>
                  <div className="text-xs text-muted">{u.phone || '—'} · ID {u.telegramId || '—'}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {u.cashDisabled?.active && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">💵 Naqd o‘chirilgan · {dt(u.cashDisabled.at)}</span>}
                    {blocked && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">⛔ Bloklangan · {dt(u.blockInfo?.at)}</span>}
                  </div>
                  <div className="mt-1 text-xs text-ink">{blocked ? u.blockInfo?.reason : u.cashDisabled?.reason}</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {u.cashDisabled?.active && <button disabled={busy === u._id} onClick={() => change(u, { cash: { active: false } }, 'Naqd to‘lov qayta yoqilsinmi?')} className="rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-50">💵 Naqdni yoqish</button>}
                {blocked
                  ? <button disabled={busy === u._id} onClick={() => change(u, { block: { active: false } }, 'Mijoz blokdan chiqarilsinmi?')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">Blokdan chiqarish</button>
                  : <button disabled={busy === u._id} onClick={() => blockUser(u)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50">⛔ Bloklash</button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* TAHLIL — takroran bekor bo'lgan buyurtmalar (jazo emas, qaror admin qo'lida) */
function StatsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setData(null); setErr(null);
    adminApi.cancellationStats(days, 2).then(setData).catch((e) => setErr(e.message));
  }, [days]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-muted">Davr:</span>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`rounded-lg border px-3 py-1.5 text-xs ${days === d ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>{d} kun</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">Kamida 2 ta buyurtmasi sabab bilan bekor bo‘lgan mijozlar. Bu tahlil — avtomatik chora ko‘rilmaydi.</p>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
      {!data && !err && <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>}
      {data && data.items.length === 0 && <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">Takroriy holat yo‘q</div>}
      <div className="grid gap-2 lg:grid-cols-2">
        {data?.items.map((r) => (
          <div key={String(r.user._id)} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{fullName(r.user)}{r.user.username ? <span className="font-normal text-muted"> · @{r.user.username}</span> : null}</div>
                <div className="text-xs text-muted">
                  {r.user.phone || '—'}{r.user.phoneVerified ? ' ✓' : ''} · {r.restaurants.join(', ')}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-lg font-semibold text-red-600">{r.cancelled}</div>
                <div className="text-[11px] text-muted">/ {r.totalOrders} buyurtma</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(r.byCode).map(([c, n]) => (
                <span key={c} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink">{CODE_LABEL[c] || c}: <b>{n}</b></span>
              ))}
              {r.user.cashDisabled?.active && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">💵 naqd o‘chirilgan</span>}
              {r.user.status === 'BLOCKED' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600">⛔ bloklangan</span>}
            </div>
            <div className="mt-1 text-[11px] text-muted">Oxirgisi: {dt(r.lastAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
