import { useEffect, useMemo, useState, useCallback } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { slugifyKey } from '@/lib/marketKey';
import { makeRoundImage } from '@/lib/roundImage';
import { uploadImage } from '@/lib/cloudinary';

/*
 * ═══ MARKET KATEGORIYALARI — MARKAZIY RO'YXAT ═══
 * Bu yerda qo'shilgan/o'chirilgan/tahrirlangan kategoriya HAMMA joyda bir xil aks etadi:
 * do'kon mahsulot formasi, Lokma Market bosh sahifa qatori va mahsulot qidiruvi (kalit bo'yicha).
 * Kalit (ID) yaratilgandan keyin o'zgarmaydi. Ishlatilayotgan kategoriyani o'chirib bo'lmaydi — nofaol qiling.
 */
const KEY_RE = /^[a-z0-9_]{2,60}$/;
const empty = { key: '', nameUz: '', nameUzc: '', nameRu: '', emoji: '🛒', imageUrl: '', cardUrl: '', description: '', order: '', isActive: true };

// Yumaloq rasm yuklovchi: tanlash → doiraga kesish → Cloudinary (market-categories papkasi)
function RoundUpload({ label, value, busy, onBusy, onChange, onError }) {
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onBusy(true);
    try {
      const round = await makeRoundImage(file, 512);
      const up = await uploadImage(round, 'market-categories');
      onChange(up.url);
    } catch (err) { onError(err.message || 'Rasm yuklanmadi'); }
    finally { onBusy(false); }
  };
  return (
    <div className="text-sm">
      <div className="mb-1">{label} <span className="text-muted">(yumaloq kesiladi)</span></div>
      <div className="flex items-center gap-3">
        <span className="w-16 h-16 rounded-full bg-canvas border border-line overflow-hidden flex items-center justify-center flex-none">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <i className="ti ti-photo text-muted text-xl" />}
        </span>
        <label className={`px-3 py-2 rounded-xl border border-line text-sm cursor-pointer hover:bg-canvas ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Yuklanmoqda…' : (value ? 'Almashtirish' : 'Rasm tanlash')}
          <input type="file" accept="image/*" onChange={pick} className="hidden" />
        </label>
        {value && <button type="button" onClick={() => onChange('')} className="text-sm text-red-600">O‘chirish</button>}
      </div>
    </div>
  );
}

export function MarketCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);   // null | { mode: 'new' | 'edit', data }
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setRows(await adminApi.getMarketCategoryList()); }
    catch (e) { setErr(e.message || 'Yuklab bo‘lmadi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);

  const save = async () => {
    const d = editing.data;
    if (!d.nameUz.trim()) { setErr('Lotincha nomi kiritilishi shart'); return; }
    if (uploading) { setErr('Rasm yuklanmoqda — tugashini kuting'); return; }
    if (editing.mode === 'new' && !KEY_RE.test((d.key || '').trim().toLowerCase())) {
      setErr('Kalit: faqat a–z, 0–9 va _ (2–60 belgi). Nomni yozing yoki kalitni qo‘lda kiriting'); return;
    }
    const body = {
      nameUz: d.nameUz.trim(), nameUzc: d.nameUzc.trim(), nameRu: d.nameRu.trim(),
      emoji: d.emoji.trim() || '🛒', imageUrl: d.imageUrl || '', cardUrl: d.cardUrl || '',
      description: (d.description || '').trim(), isActive: !!d.isActive,
      ...(d.order !== '' && d.order !== null ? { order: Number(d.order) } : {}),
    };
    setBusy(true); setErr('');
    try {
      if (editing.mode === 'new') await adminApi.createMarketCategory({ ...body, key: (d.key || '').trim().toLowerCase() });
      else await adminApi.updateMarketCategory(editing.data.key, body);
      setEditing(null); await load();
    } catch (e) { setErr(e.message || 'Saqlab bo‘lmadi'); }
    finally { setBusy(false); }
  };

  const toggle = async (r) => {
    try { await adminApi.updateMarketCategory(r.key, { isActive: !r.isActive }); await load(); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (r) => {
    if (r.usage > 0) { setErr(`«${r.uz}» da ${r.usage} ta mahsulot bor — o‘chirib bo‘lmaydi. Nofaol qiling.`); return; }
    const ok = await confirm({ title: 'Kategoriya o‘chirilsinmi?', content: `«${r.uz}» (${r.key}) ro‘yxatdan o‘chadi.`, okText: 'O‘chirish', tone: 'danger' });
    if (!ok) return;
    try { await adminApi.deleteMarketCategory(r.key); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Market kategoriyalari</h1>
          <p className="text-sm text-muted mt-0.5">Bitta ro‘yxat: do‘kon formasi, Market qatori va qidiruv shu yerdan. Faol: {activeCount} / {rows.length}</p>
        </div>
        <button onClick={() => setEditing({ mode: 'new', keyTouched: false, data: { ...empty, order: (rows.at(-1)?.order || 0) + 10 } })}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white transition-colors">
          <i className="ti ti-plus" /> Yangi kategoriya
        </button>
      </div>

      {err && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{err}</div>}

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <div className="bg-surface border border-line rounded-xl divide-y divide-line">
          {rows.map((r) => (
            <div key={r.key} className={`flex items-center gap-3 px-4 py-3 ${r.isActive ? '' : 'opacity-60'}`} data-testid="mcat-row">
              <span className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-xl flex-none overflow-hidden">
                {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-full h-full object-cover" /> : r.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{r.uz} <span className="text-muted font-normal">· {r.uzc || '—'} · {r.ru || '—'}</span></div>
                <div className="text-[11px] text-muted font-mono truncate">{r.key} · tartib {r.order} · mahsulot: {r.usage}</div>
              </div>
              <button type="button" role="switch" aria-checked={r.isActive} onClick={() => toggle(r)}
                className={`relative h-6 w-11 rounded-full flex-none transition-colors ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`} title={r.isActive ? 'Faol' : 'Nofaol'}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.isActive ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <button onClick={() => setEditing({ mode: 'edit', data: { ...empty, ...r, order: r.order, imageUrl: r.imageUrl || '', cardUrl: r.cardUrl || '', description: r.description || '' } })}
                className="px-2.5 py-1.5 border border-line rounded-lg text-sm text-muted hover:bg-canvas"><i className="ti ti-pencil" /></button>
              <button onClick={() => remove(r)} disabled={r.usage > 0}
                className="px-2.5 py-1.5 border border-line rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => !busy && setEditing(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-ink mb-4">{editing.mode === 'new' ? 'Yangi kategoriya' : `Tahrirlash: ${editing.data.key}`}</h3>
            <div className="grid gap-3">
              <label className="text-sm">Nomi (lotin) *
                <input value={editing.data.nameUz} placeholder="masalan: Sut mahsulotlari"
                  onChange={(e) => {
                    const nameUz = e.target.value;
                    setEditing((ed) => ({ ...ed, data: { ...ed.data, nameUz, ...(ed.mode === 'new' && !ed.keyTouched ? { key: slugifyKey(nameUz) } : {}) } }));
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
              </label>
              <label className="text-sm">Kalit (ID) {editing.mode === 'new' ? <span className="text-muted">— nomdan avtomatik, xohlasangiz o‘zgartiring</span> : <span className="text-muted">— o‘zgarmaydi</span>}
                <input value={editing.data.key} disabled={editing.mode === 'edit'} placeholder="nomdan avtomatik yasaladi"
                  onChange={(e) => setEditing((ed) => ({ ...ed, keyTouched: true, data: { ...ed.data, key: e.target.value.toLowerCase() } }))}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-line font-mono text-sm disabled:bg-canvas" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">Nomi (kirill)
                  <input value={editing.data.nameUzc} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, nameUzc: e.target.value } })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
                </label>
                <label className="text-sm">Nomi (ruscha)
                  <input value={editing.data.nameRu} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, nameRu: e.target.value } })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
                </label>
              </div>
              <label className="text-sm">Tavsif <span className="text-muted">({(editing.data.description || '').length}/300)</span>
                <textarea rows={3} maxLength={300} value={editing.data.description}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })}
                  placeholder="Mijoz kategoriyani ochganda ko‘radigan qisqa matn"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <RoundUpload label="Ikon" value={editing.data.imageUrl} busy={uploading === 'icon'}
                  onBusy={(v) => setUploading(v ? 'icon' : '')} onError={setErr}
                  onChange={(url) => setEditing({ ...editing, data: { ...editing.data, imageUrl: url } })} />
                <RoundUpload label="Karta rasmi" value={editing.data.cardUrl} busy={uploading === 'card'}
                  onBusy={(v) => setUploading(v ? 'card' : '')} onError={setErr}
                  onChange={(url) => setEditing({ ...editing, data: { ...editing.data, cardUrl: url } })} />
              </div>
              <div className="grid grid-cols-3 gap-3 items-end">
                <label className="text-sm">Emoji
                  <input value={editing.data.emoji} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, emoji: e.target.value } })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
                </label>
                <label className="text-sm">Tartib
                  <input type="number" min="0" value={editing.data.order} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, order: e.target.value } })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-line text-sm" />
                </label>
                <label className="text-sm flex items-center gap-2 pb-2">
                  <input type="checkbox" checked={!!editing.data.isActive} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, isActive: e.target.checked } })} />
                  Faol
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} disabled={busy} className="flex-1 rounded-xl border border-line py-2.5 text-sm">Bekor</button>
              <button onClick={save} disabled={busy || !!uploading} className="flex-[2] rounded-xl bg-brand-400 text-brand-text py-2.5 text-sm font-semibold disabled:opacity-50">
                {busy ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
