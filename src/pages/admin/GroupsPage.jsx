import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApi } from '@/api';
import { getSocket, joinAdmin } from '@/lib/socket';
import { confirm } from '@/components/ui/confirm';
import { BroadcastComposer } from '@/components/BroadcastComposer';

/*
 * ═══ TELEGRAM GURUHLAR VA KANALLAR ═══
 * Ikki xil chat (server: services/telegramGroup.js):
 *   • UMUMIY — bot admin qilinganda o'zi "Buyurtma berish" ni pin qiladi → LokmaGo bosh sahifasi (avvalgidek, o'zgarmagan).
 *   • RESTORAN — admin restoran biriktiradi → bot restoran nomi + tugmani pin qiladi → tugma SHU restoran sahifasini ochadi.
 *     Restoran chatiga umumiy LokmaGo promo pin qilinmaydi; reklama standart holda o'chiq (kalit bilan yoqiladi).
 * «Reklama yuborish» — chatlarni tanlab olish oynasi; reklamasi o'chirilgan chatlar tanlanmaydi.
 */
const fmtTime = (d) => (d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const canAdvertise = (g) => g.isActive !== false && g.isBotAdmin && g.adsEnabled !== false;

export function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [composer, setComposer] = useState(null);       // { chatId, title } | { all: true, chatIds } | null
  const [picking, setPicking] = useState(null);         // restoran tanlanayotgan chat
  const [choosingTargets, setChoosingTargets] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { setGroups(await adminApi.getGroups()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Real-time: bot yangi guruh/kanalga admin bo'lsa darhol ko'rinadi
  useEffect(() => {
    const socket = getSocket();
    joinAdmin();
    const refresh = () => load();
    socket.on('group:new', refresh);
    return () => socket.off('group:new', refresh);
  }, [load]);

  // Bot allaqachon guruhga qo'shilgan bo'lsa — chat ID bilan qo'shamiz (Telegram bot qaysi guruhlarda ekanini o'zi aytmaydi)
  const addManual = async () => {
    const chatId = prompt("Guruh yoki kanal chat ID sini kiriting (masalan -1001234567890)\n\nQanday bilish: guruhga @userinfobot ni qo'shing yoki\nbotni chiqarib qayta admin qiling — o'zi qo'shiladi.");
    if (!chatId?.trim()) return;
    setAddingGroup(true);
    try { await adminApi.addGroup(chatId.trim()); load(); } catch (e) { alert(e.message); } finally { setAddingGroup(false); }
  };
  const runCheck = async () => {
    setChecking(true);
    try { const r = await adminApi.runGroupCheck(); alert(`Tekshirildi: ${r.checked} ta chat, ${r.fixed} ta tuzatildi`); load(); } catch (e) { alert(e.message); } finally { setChecking(false); }
  };
  const act = async (chatId, fn) => {
    setBusyId(chatId);
    try { await fn(); await load(); } catch (e) { alert(e.message); } finally { setBusyId(null); }
  };
  const resend = (g) => act(g.chatId, () => adminApi.resendGroupPromo(g.chatId));
  const toggleAds = (g) => act(g.chatId, () => adminApi.setGroupAds(g.chatId, g.adsEnabled === false));
  const repin = (g) => act(g.chatId, () => adminApi.repinGroupRestaurant(g.chatId));
  const unbind = async (g) => {
    const ok = await confirm({ title: 'Restoran ajratilsinmi?', content: `«${g.title || 'Chat'}» dan «${g.restaurant?.name}» pini olinadi.${g.kind === 'channel' ? '' : ' Guruhda umumiy LokmaGo tugmasi qaytadi.'}`, okText: 'Ajratish', tone: 'danger' });
    if (ok) act(g.chatId, () => adminApi.setGroupRestaurant(g.chatId, null));
  };
  const bind = async (g, r) => {
    setPicking(null);
    act(g.chatId, () => adminApi.setGroupRestaurant(g.chatId, r.id));
  };

  const counts = useMemo(() => ({
    all: groups.length,
    general: groups.filter((g) => !g.restaurant && g.kind !== 'channel').length,
    restaurant: groups.filter((g) => g.restaurant).length,
    channel: groups.filter((g) => g.kind === 'channel').length,
  }), [groups]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (filter === 'general' && (g.restaurant || g.kind === 'channel')) return false;
      if (filter === 'restaurant' && !g.restaurant) return false;
      if (filter === 'channel' && g.kind !== 'channel') return false;
      return !s || `${g.title} ${g.restaurant?.name || ''} ${g.chatId}`.toLowerCase().includes(s);
    });
  }, [groups, filter, q]);

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Telegram guruhlar va kanallar</h1>
          <p className="text-sm text-muted mt-0.5">Bot admin qilingan chatlar — pin, restoran va reklama</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setChoosingTargets(true)} disabled={!groups.some(canAdvertise)} className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
            <i className="ti ti-send" /> Reklama yuborish
          </button>
          <button onClick={addManual} disabled={addingGroup} className="border border-line text-muted font-medium px-4 py-2 rounded-xl hover:bg-canvas transition-colors disabled:opacity-50">
            <i className="ti ti-plus" /> {addingGroup ? '...' : "Qo'lda qo'shish"}
          </button>
          <button onClick={runCheck} disabled={checking} className="border border-line text-muted font-medium px-4 py-2 rounded-xl hover:bg-canvas transition-colors disabled:opacity-50">
            <i className="ti ti-refresh" /> {checking ? 'Tekshirilmoqda...' : 'Tekshirish'}
          </button>
        </div>
      </div>

      {/* Yo'riqnoma: ikki xil chat */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm">
          <div className="font-medium text-ink flex items-center gap-1.5"><i className="ti ti-users text-brand-600" /> Umumiy guruh</div>
          <p className="text-muted mt-1 leading-relaxed">Botni admin qiling — o‘zi «Buyurtma berish» tugmasini tepaga pin qiladi. Tugma <b className="text-ink">LokmaGo bosh sahifasini</b> ochadi. Har kuni tekshiriladi.</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm">
          <div className="font-medium text-ink flex items-center gap-1.5"><i className="ti ti-tools-kitchen-2 text-orange-600" /> Restoran guruhi yoki kanali</div>
          <p className="text-muted mt-1 leading-relaxed">Chatga restoran biriktiring — bot restoran nomi va tugmani pin qiladi, tugma <b className="text-ink">shu restoran sahifasini</b> ochadi. Umumiy reklama bu chatga yuborilmaydi (kalit bilan yoqish mumkin).</p>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chat yoki restoran nomi" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-line bg-surface text-sm" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[['all', 'Hammasi'], ['general', 'Umumiy'], ['restaurant', 'Restoran'], ['channel', 'Kanallar']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
                className={`flex-none rounded-full px-3.5 py-2 text-sm font-medium ${filter === id ? 'bg-ink text-white' : 'border border-line bg-surface text-muted'}`}>
                {label} <span className="opacity-60">{counts[id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Hali birorta guruh yoki kanal yo‘q. Botni guruh/kanalga admin qiling — shu yerda ko‘rinadi.
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center text-muted text-sm py-10">Hech narsa topilmadi</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((g) => (
            <GroupCard key={g.chatId} g={g} busy={busyId === g.chatId}
              onAd={() => setComposer({ chatId: g.chatId, title: g.title })} onResend={() => resend(g)} onToggleAds={() => toggleAds(g)}
              onPick={() => setPicking(g)} onRepin={() => repin(g)} onUnbind={() => unbind(g)} />
          ))}
        </div>
      )}

      {picking && <RestaurantPicker group={picking} onPick={(r) => bind(picking, r)} onClose={() => setPicking(null)} />}
      {choosingTargets && (
        <TargetPicker groups={groups} onClose={() => setChoosingTargets(false)}
          onNext={(chatIds) => { setChoosingTargets(false); setComposer({ all: true, chatIds }); }} />
      )}
      {composer && <BroadcastComposer target={composer} onClose={() => setComposer(null)} onSent={load} />}
    </div>
  );
}

function Chip({ ok, warn, icon, children }) {
  return <span className={ok ? 'text-green-600' : warn ? 'text-amber-600' : 'text-red-500'}><i className={`ti ${icon}`} /> {children}</span>;
}

export function GroupCard({ g, busy, onAd, onResend, onToggleAds, onPick, onRepin, onUnbind }) {
  const isChannel = g.kind === 'channel';
  const rp = g.restaurantPin || {};
  const ads = g.adsEnabled !== false;
  return (
    <article className={`bg-surface border rounded-xl p-4 min-w-0 ${g.restaurant ? 'border-orange-200' : 'border-line'}`} data-testid="group-card">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-none ${g.restaurant ? 'bg-orange-100' : 'bg-brand-100'}`}>
          <i className={`ti ${isChannel ? 'ti-speakerphone' : 'ti-users'} text-xl ${g.restaurant ? 'text-orange-600' : 'text-brand-text'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{g.title || (isChannel ? 'Kanal' : 'Guruh')}</div>
            <span className="flex-none text-[10px] uppercase tracking-wide text-muted">{isChannel ? 'kanal' : 'guruh'}</span>
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-[11px] flex-wrap">
            {g.isActive === false ? <Chip icon="ti-door-exit">Bot chiqarilgan</Chip>
              : g.isBotAdmin ? <Chip ok icon="ti-shield-check">Bot admin</Chip> : <Chip icon="ti-shield-x">Admin emas</Chip>}
            {g.restaurant
              ? (rp.isPinned ? <Chip ok icon="ti-pin">Restoran pini</Chip> : <Chip warn icon="ti-pin">Pin yo‘q</Chip>)
              : isChannel ? null : (g.isPinned ? <Chip ok icon="ti-pin">Pin qilingan</Chip> : <Chip warn icon="ti-pin">Pin yo‘q</Chip>)}
            {g.lastCheckedAt && <span className="text-muted">tekshiruv {fmtTime(g.lastCheckedAt)}</span>}
          </div>
        </div>
        {/* Umumiy reklama kaliti */}
        <button type="button" role="switch" aria-checked={ads} onClick={onToggleAds} disabled={busy}
          className="flex-none flex flex-col items-center gap-1 disabled:opacity-50" title={ads ? 'Umumiy reklama yuboriladi' : 'Umumiy reklama yuborilmaydi'} data-testid="ads-switch">
          <span className={`relative h-6 w-11 rounded-full transition-colors ${ads ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ads ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
          <span className="text-[10px] text-muted">reklama</span>
        </button>
      </div>

      {/* Restoran bloki */}
      {g.restaurant ? (
        <div className="mt-3 rounded-xl bg-orange-50 p-3" data-testid="bound-restaurant">
          <div className="flex items-center gap-3">
            {g.restaurant.imageUrl
              ? <img src={g.restaurant.imageUrl} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" />
              : <div className="h-10 w-10 flex-none rounded-lg bg-white flex items-center justify-center"><i className="ti ti-tools-kitchen-2 text-orange-600" /></div>}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{g.restaurant.name}</div>
              <div className="text-[11px] text-muted">Pin tugmasi shu restoran sahifasini ochadi</div>
            </div>
          </div>
          {rp.error && <div className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600"><i className="ti ti-alert-triangle" /> {rp.error}</div>}
          {g.restaurant.isActive === false && <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700"><i className="ti ti-alert-triangle" /> Restoran faol emas — mijozlar buyurtma bera olmaydi</div>}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button onClick={onPick} disabled={busy || !g.isBotAdmin} className="rounded-lg bg-white px-2 py-2 text-xs font-medium text-ink disabled:opacity-40"><i className="ti ti-replace" /> Almashtirish</button>
            <button onClick={onRepin} disabled={busy || !g.isBotAdmin} className="rounded-lg bg-white px-2 py-2 text-xs font-medium text-ink disabled:opacity-40">{busy ? '...' : <><i className="ti ti-pin" /> Pinni yangilash</>}</button>
            <button onClick={onUnbind} disabled={busy} className="rounded-lg bg-white px-2 py-2 text-xs font-medium text-red-600 disabled:opacity-40"><i className="ti ti-unlink" /> Ajratish</button>
          </div>
        </div>
      ) : (
        <button onClick={onPick} disabled={busy || !g.isBotAdmin} className="mt-3 w-full rounded-xl border border-dashed border-orange-300 px-3 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-40" data-testid="bind-restaurant">
          <i className="ti ti-link" /> Restoran biriktirish
        </button>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button onClick={onAd} disabled={!g.isBotAdmin || !ads} className="px-3 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg text-sm hover:bg-brand-100 disabled:opacity-40"
          title={!g.isBotAdmin ? 'Bot admin emas' : !ads ? 'Bu chatda reklama o‘chirilgan' : 'Reklama yaratib yuborish'}>
          <i className="ti ti-ad-2" /> Reklama
        </button>
        {!g.restaurant && !isChannel && (
          <button onClick={onResend} disabled={busy || !g.isBotAdmin} className="px-3 py-2 border border-line rounded-lg text-sm text-muted hover:bg-canvas disabled:opacity-40" title="Umumiy LokmaGo tugmasini qayta yuborish + pin">
            {busy ? '...' : <><i className="ti ti-refresh" /> Umumiy pinni qayta yuborish</>}
          </button>
        )}
        {!ads && <span className="text-[11px] text-muted"><i className="ti ti-volume-off" /> umumiy reklama yuborilmaydi</span>}
      </div>
    </article>
  );
}

function Modal({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0"><h3 className="text-lg font-semibold text-ink">{title}</h3>{subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Yopish" className="text-muted hover:text-ink"><i className="ti ti-x text-xl" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Restoran tanlash: qidiruv bilan, faol restoranlar tepada. */
function RestaurantPicker({ group, onPick, onClose }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    adminApi.getRestaurants().then((r) => setList((Array.isArray(r) ? r : r?.restaurants || []).map((x) => ({ id: x._id || x.id, name: x.name, cuisine: x.cuisine, imageUrl: x.imageUrl || '', isActive: x.isActive !== false }))))
      .catch((e) => setError(e.message || 'Yuklanmadi'));
  }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((r) => !s || `${r.name} ${r.cuisine || ''}`.toLowerCase().includes(s)).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [list, q]);
  return (
    <Modal title="Restoran biriktirish" subtitle={`«${group.title || 'Chat'}» — pin tugmasi shu restoran sahifasini ochadi`} onClose={onClose}>
      <div className="relative mb-3">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Restoran nomi" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-line text-sm" />
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!list && !error && <div className="py-8 text-center text-sm text-muted">Yuklanmoqda...</div>}
      {list && shown.length === 0 && <div className="py-8 text-center text-sm text-muted">Restoran topilmadi</div>}
      <div className="space-y-1.5">
        {shown.map((r) => (
          <button key={r.id} onClick={() => onPick(r)} disabled={!r.isActive || String(group.restaurantId) === String(r.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left hover:bg-canvas disabled:opacity-50">
            {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-11 w-11 flex-none rounded-lg object-cover" /> : <div className="h-11 w-11 flex-none rounded-lg bg-canvas flex items-center justify-center"><i className="ti ti-tools-kitchen-2 text-muted" /></div>}
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{r.name}</div><div className="truncate text-xs text-muted">{r.cuisine}</div></div>
            {String(group.restaurantId) === String(r.id) ? <span className="text-[11px] text-green-600">hozirgi</span> : !r.isActive ? <span className="text-[11px] text-muted">faol emas</span> : <i className="ti ti-chevron-right text-muted" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Reklama uchun chatlarni tanlash. Reklamasi o'chirilgan / bot admin bo'lmagan chatlar tanlanmaydi (sababi yoziladi). */
export function TargetPicker({ groups, onClose, onNext }) {
  const eligible = groups.filter(canAdvertise);
  const [sel, setSel] = useState(() => new Set(eligible.map((g) => g.chatId)));
  const [q, setQ] = useState('');
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = eligible.length > 0 && eligible.every((g) => sel.has(g.chatId));
  const s = q.trim().toLowerCase();
  const list = groups.filter((g) => !s || `${g.title} ${g.restaurant?.name || ''}`.toLowerCase().includes(s))
    .sort((a, b) => Number(canAdvertise(b)) - Number(canAdvertise(a)));
  const reason = (g) => (g.isActive === false ? 'bot chiqarilgan' : !g.isBotAdmin ? 'bot admin emas' : g.adsEnabled === false ? 'reklama o‘chirilgan' : '');
  return (
    <Modal title="Reklama kimga?" subtitle={`${sel.size} ta chat tanlandi`} onClose={onClose}
      footer={(
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2.5 text-sm">Bekor</button>
          <button onClick={() => onNext([...sel])} disabled={sel.size === 0} className="flex-[2] rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-50" data-testid="targets-next">
            Davom etish ({sel.size})
          </button>
        </div>
      )}>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish" className="w-full pl-9 pr-3 py-2 rounded-xl border border-line text-sm" />
        </div>
        <button onClick={() => setSel(allOn ? new Set() : new Set(eligible.map((g) => g.chatId)))} className="flex-none rounded-xl border border-line px-3 text-sm font-medium">
          {allOn ? 'Hech biri' : 'Hammasi'}
        </button>
      </div>
      <div className="space-y-1.5">
        {list.map((g) => {
          const why = reason(g);
          const on = sel.has(g.chatId);
          return (
            <label key={g.chatId} className={`flex items-center gap-3 rounded-xl border p-2.5 ${why ? 'border-line bg-canvas opacity-60' : on ? 'border-brand-400 bg-brand-50' : 'border-line'} ${why ? '' : 'cursor-pointer'}`} data-testid="target-row">
              <input type="checkbox" checked={on && !why} disabled={Boolean(why)} onChange={() => toggle(g.chatId)} className="h-4 w-4 accent-brand-400" />
              <i className={`ti ${g.kind === 'channel' ? 'ti-speakerphone' : 'ti-users'} text-muted`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{g.title || 'Chat'}</div>
                <div className="truncate text-[11px] text-muted">{g.restaurant ? `🍽 ${g.restaurant.name}` : g.kind === 'channel' ? 'kanal' : 'umumiy guruh'}{why ? ` · ${why}` : ''}</div>
              </div>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
