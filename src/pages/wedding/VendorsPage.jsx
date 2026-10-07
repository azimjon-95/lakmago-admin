import { useEffect, useState, useCallback, useMemo } from 'react';
import { weddingApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm, confirmWithReason } from '@/components/ui/confirm';
import { PageHeader, ErrorBox, Empty, Badge, Modal, Field, som } from './common';

/*
 * ═══ VIDEOCHILAR / KAMERACHILAR va KORTEJLAR ═══
 * Bitta komponent, ikki bo'lim (type='video' | 'cortege') — har biri o'z
 * sahifasida, alohida ro'yxat. To'liq ma'lumot: aloqa, tajriba, portfolio,
 * videochi uchun jihozlar/xizmatlar, kortej uchun mashinalar ro'yxati.
 * Bloklash (sababi bilan), o'chirish (bronlarda ishlatilmagan bo'lsa).
 */
const VIDEO_SERVICES = { video: 'Video', foto: 'Foto', klip: 'Klip', love_story: 'Love story', jonli_efir: 'Jonli efir', montaj: 'Montaj' };

const META = {
  video: { title: 'Videochilar', subtitle: 'Videochi va kamerachilar', icon: 'ti-video', add: "Videochi qo'shish", one: 'Videochi' },
  cortege: { title: 'Kortejlar', subtitle: 'Kortej xizmatlari va mashinalar', icon: 'ti-car', add: "Kortej qo'shish", one: 'Kortej' },
};

export function VendorsPage({ type }) {
  const meta = META[type];
  const [list, setList] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setErr(null); setLoading(true);
    try { setList(await weddingApi.vendors(type)); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [type]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { weddingApi.venues().then(setVenues).catch(() => {}); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((v) => [v.name, v.contact_name, v.phone, v.district].filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [list, q]);

  const replace = (r) => setList((l) => l.map((x) => (x._id === r._id ? r : x)));
  const block = async (v) => {
    const reason = await confirmWithReason(`"${v.name}" bloklansinmi? Mijozlarga taklif qilinmaydi.`, 'Sabab (majburiy)');
    if (reason === false) return;
    if (String(reason || '').trim().length < 2) { setErr('Bloklash sababini yozing'); return; }
    setBusy(v._id);
    try { replace(await weddingApi.blockVendor(v._id, String(reason).trim())); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const unblock = async (v) => {
    setBusy(v._id);
    try { replace(await weddingApi.unblockVendor(v._id)); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const toggleActive = async (v) => {
    setBusy(v._id);
    try { replace(await weddingApi.updateVendor(v._id, { active: !v.active })); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const remove = async (v) => {
    if (!await confirm({ title: `"${v.name}" o'chirilsinmi?`, tone: 'danger' })) return;
    setBusy(v._id);
    try { await weddingApi.deleteVendor(v._id); setList((l) => l.filter((x) => x._id !== v._id)); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <PageHeader title={meta.title} subtitle={`${meta.subtitle} · ${list.length} ta`}>
        <button onClick={() => setForm({})} className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white flex items-center gap-2">
          <i className="ti ti-plus" /> {meta.add}
        </button>
      </PageHeader>
      <input className="inp mb-4" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nomi, mas'ul, telefon, tuman" />
      <ErrorBox error={err} onRetry={load} />

      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : shown.length === 0 ? <Empty icon={meta.icon}>{list.length ? 'Topilmadi' : `Hali ${meta.one.toLowerCase()} yo'q`}</Empty>
          : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((v) => (
                <div key={v._id} className={`bg-surface border rounded-xl p-3 sm:p-4 ${v.blocked ? 'border-red-200' : 'border-line'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-canvas overflow-hidden flex-none flex items-center justify-center">
                      {v.photo || v.photos?.[0] ? <img src={v.photo || v.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <i className={`ti ${meta.icon} text-2xl text-muted`} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-ink">{v.name}</span>
                        {v.blocked ? <Badge cls="bg-red-50 text-red-600">Bloklangan</Badge>
                          : v.active ? <Badge cls="bg-green-50 text-green-700">Faol</Badge>
                            : <Badge cls="bg-canvas text-muted">Yashirin</Badge>}
                        {v.rating > 0 && <Badge cls="bg-amber-50 text-amber-700" icon="ti-star">{v.rating}</Badge>}
                      </div>
                      <div className="text-sm font-semibold text-ink mt-0.5">{som(v.price)} so'm</div>
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {[v.contact_name, v.phone, v.district, v.experience_years ? `${v.experience_years} yil tajriba` : ''].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {type === 'video' && v.video && (
                        <div className="text-xs text-muted mt-0.5">
                          {v.video.cameras} kamera{v.video.has_drone ? ' · dron' : ''}
                          {v.video.delivery_days ? ` · ${v.video.delivery_days} kunda tayyor` : ''}
                          {v.video.services?.length ? ` · ${v.video.services.map((s) => VIDEO_SERVICES[s] || s).join(', ')}` : ''}
                        </div>
                      )}
                      {type === 'cortege' && v.cars?.length > 0 && (
                        <div className="text-xs text-muted mt-0.5">
                          {v.cars.map((c) => `${c.model}${c.color ? ` (${c.color})` : ''}${c.count > 1 ? ` ×${c.count}` : ''}`).join(', ')}
                        </div>
                      )}
                      {v.blocked && v.block_reason && <div className="text-xs text-red-600 mt-0.5">Sabab: {v.block_reason}</div>}
                      <div className="text-[11px] text-muted mt-0.5">
                        {v.venue_ids?.length ? `${v.venue_ids.length} ta to'yxonada` : "Barcha to'yxonalarda"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => setForm({ vendor: v })} className="px-3 py-1.5 rounded-lg border border-line text-sm"><i className="ti ti-pencil" /> Tahrirlash</button>
                    {!v.blocked && (
                      <button disabled={busy === v._id} onClick={() => toggleActive(v)} className="px-3 py-1.5 rounded-lg border border-line text-sm text-muted disabled:opacity-50">
                        {v.active ? 'Yashirish' : 'Faollashtirish'}
                      </button>
                    )}
                    {v.blocked ? (
                      <button disabled={busy === v._id} onClick={() => unblock(v)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50"><i className="ti ti-lock-open" /> Blokdan chiqarish</button>
                    ) : (
                      <button disabled={busy === v._id} onClick={() => block(v)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm disabled:opacity-50"><i className="ti ti-lock" /> Bloklash</button>
                    )}
                    <button disabled={busy === v._id} onClick={() => remove(v)} className="w-8 h-8 rounded-lg border border-line text-red-500 disabled:opacity-50" aria-label="O'chirish"><i className="ti ti-trash" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {form && (
        <VendorForm type={type} vendor={form.vendor} venues={venues}
          onClose={() => setForm(null)}
          onSaved={(r) => { setForm(null); setList((l) => (form.vendor ? l.map((x) => (x._id === r._id ? r : x)) : [r, ...l])); }} />
      )}
    </div>
  );
}

const urlOk = (s) => /^https?:\/\/\S+$/i.test(s);

function VendorForm({ type, vendor, venues, onClose, onSaved }) {
  const isEdit = Boolean(vendor?._id);
  const [f, setF] = useState(() => ({
    name: vendor?.name || '', description: vendor?.description || '', price: vendor?.price ?? null,
    rating: vendor?.rating ?? '', photo: vendor?.photo || '', photos: vendor?.photos || [],
    portfolio: (vendor?.portfolio_urls || []).join('\n'),
    contact_name: vendor?.contact_name || '', phone: vendor?.phone || '', telegram: vendor?.telegram || '',
    district: vendor?.district || '', experience_years: vendor?.experience_years || 0, note: vendor?.note || '',
    venue_ids: (vendor?.venue_ids || []).map(String),
    video: { cameras: 1, has_drone: false, equipment: '', delivery_days: 0, services: ['video'], ...(vendor?.video || {}) },
    cars: (vendor?.cars || []).map(({ _id, ...c }) => c),
  }));
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setV = (k, v) => setF((x) => ({ ...x, video: { ...x.video, [k]: v } }));
  const setCar = (i, patch) => setF((x) => ({ ...x, cars: x.cars.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const save = async () => {
    if (f.name.trim().length < 2) { setErr('Nomini kiriting'); return; }
    if (!(f.price >= 0) || f.price === null) { setErr('Narxni kiriting'); return; }
    const portfolio = f.portfolio.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (portfolio.some((u) => !urlOk(u))) { setErr('Portfolio havolalari https:// bilan boshlanishi kerak'); return; }
    if (type === 'cortege') {
      if (!f.cars.length) { setErr("Kamida bitta mashina qo'shing"); return; }
      if (f.cars.some((c) => !c.model.trim())) { setErr('Mashina modelini kiriting'); return; }
    }
    const rating = f.rating === '' ? undefined : Number(f.rating);
    if (rating !== undefined && (rating < 0 || rating > 5)) { setErr('Reyting 0–5'); return; }
    setErr(null); setSaving(true);
    const payload = {
      type, name: f.name.trim(), description: f.description.trim(), price: Number(f.price),
      ...(rating !== undefined ? { rating } : {}),
      ...(f.photo ? { photo: f.photo } : {}),
      photos: f.photos, portfolio_urls: portfolio,
      contact_name: f.contact_name.trim(), phone: f.phone.trim(), telegram: f.telegram.trim().replace(/^@/, ''),
      district: f.district.trim(), experience_years: Number(f.experience_years) || 0, note: f.note.trim(),
      venue_ids: f.venue_ids,
      ...(type === 'video'
        ? { video: { cameras: Number(f.video.cameras) || 0, has_drone: Boolean(f.video.has_drone), equipment: f.video.equipment.trim(), delivery_days: Number(f.video.delivery_days) || 0, services: f.video.services } }
        : { cars: f.cars.map((c) => ({ model: c.model.trim(), color: (c.color || '').trim(), ...(c.year ? { year: Number(c.year) } : {}), count: Number(c.count) || 1, price: Number(c.price) || 0 })) }),
    };
    try {
      const r = isEdit ? await weddingApi.updateVendor(vendor._id, payload) : await weddingApi.createVendor(payload);
      onSaved(r);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const meta = META[type];
  return (
    <Modal wide title={isEdit ? `${meta.one}: tahrirlash` : meta.add} onClose={onClose} footer={(
      <>
        <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl">Bekor</button>
        <button onClick={save} disabled={saving} className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </>
    )}>
      <div className="grid sm:grid-cols-[160px_1fr] gap-4">
        <ImageUpload value={f.photo} onChange={(url) => set('photo', url)} folder="weddings" label="Asosiy rasm" aspect="1/1" />
        <div>
          <Field label="Nomi *"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={type === 'video' ? 'Studio Kadr' : 'VIP kortej'} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Narx (so'm) *"><MoneyInput value={f.price} onChange={(v) => set('price', v)} /></Field>
            <Field label="Reyting"><input className="inp" type="number" step="0.1" min="0" max="5" value={f.rating} onChange={(e) => set('rating', e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <Field label="Tavsif"><textarea className="inp resize-none" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>

      <div className="grid sm:grid-cols-3 gap-x-3">
        <Field label="Mas'ul shaxs"><input className="inp" value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
        <Field label="Telefon"><input className="inp" value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" /></Field>
        <Field label="Telegram"><input className="inp" value={f.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="@username" /></Field>
        <Field label="Tuman"><input className="inp" value={f.district} onChange={(e) => set('district', e.target.value)} /></Field>
        <Field label="Tajriba (yil)"><input className="inp" type="number" min="0" value={f.experience_years} onChange={(e) => set('experience_years', e.target.value)} /></Field>
      </div>

      {type === 'video' ? (
        <div className="rounded-xl border border-line p-3 mb-3">
          <div className="text-xs font-semibold text-ink mb-2">Jihozlar va xizmatlar</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kameralar"><input className="inp" type="number" min="0" value={f.video.cameras} onChange={(e) => setV('cameras', e.target.value)} /></Field>
            <Field label="Tayyor bo'ladi (kun)"><input className="inp" type="number" min="0" value={f.video.delivery_days} onChange={(e) => setV('delivery_days', e.target.value)} /></Field>
            <Field label="Dron"><label className="h-10 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.video.has_drone} onChange={(e) => setV('has_drone', e.target.checked)} /> Bor</label></Field>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(VIDEO_SERVICES).map(([k, l]) => {
              const on = f.video.services.includes(k);
              return (
                <button key={k} type="button" onClick={() => setV('services', on ? f.video.services.filter((x) => x !== k) : [...f.video.services, k])}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-medium ${on ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>{l}</button>
              );
            })}
          </div>
          <input className="inp" value={f.video.equipment} onChange={(e) => setV('equipment', e.target.value)} placeholder="Jihozlar: Sony FX3, gimbal, yorug'lik..." />
        </div>
      ) : (
        <div className="rounded-xl border border-line p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-ink">Mashinalar</div>
            <button type="button" onClick={() => set('cars', [...f.cars, { model: '', color: '', year: '', count: 1, price: 0 }])} className="text-sm text-brand-600 font-medium"><i className="ti ti-plus" /> Mashina</button>
          </div>
          {f.cars.length === 0 && <p className="text-xs text-muted">Hali mashina yo'q</p>}
          {f.cars.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_70px_56px_auto] gap-1.5 items-center mb-1.5">
              <input className="inp" value={c.model} onChange={(e) => setCar(i, { model: e.target.value })} placeholder="Model (Malibu)" />
              <input className="inp" value={c.color} onChange={(e) => setCar(i, { color: e.target.value })} placeholder="Rang" />
              <input className="inp" type="number" value={c.year || ''} onChange={(e) => setCar(i, { year: e.target.value })} placeholder="Yil" />
              <input className="inp" type="number" min="1" value={c.count} onChange={(e) => setCar(i, { count: e.target.value })} title="Soni" />
              <button type="button" onClick={() => set('cars', f.cars.filter((_, j) => j !== i))} className="w-9 h-9 rounded-lg border border-line text-red-500" aria-label="O'chirish"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}

      <Field label="Portfolio rasmlari" hint={`${f.photos.length}/30`}>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {f.photos.map((u, i) => (
            <div key={u + i} className="relative aspect-square rounded-lg overflow-hidden border border-line">
              <img src={u} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => set('photos', f.photos.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="O'chirish"><i className="ti ti-x text-xs" /></button>
            </div>
          ))}
          {f.photos.length < 30 && <ImageUpload key={f.photos.length} value="" onChange={(url) => url && set('photos', [...f.photos, url])} folder="weddings" label="+" aspect="1/1" />}
        </div>
      </Field>
      <Field label="Video havolalar" hint="Har qatorda bitta: YouTube, Instagram, Telegram (https://...)">
        <textarea className="inp resize-none" rows={2} value={f.portfolio} onChange={(e) => set('portfolio', e.target.value)} />
      </Field>
      <Field label="Qaysi to'yxonalarda taklif qilinadi" hint="Hech biri tanlanmasa — barcha to'yxonalarda">
        <div className="flex flex-wrap gap-1.5">
          {venues.map((v) => {
            const on = f.venue_ids.includes(String(v._id));
            return (
              <button key={v._id} type="button" onClick={() => set('venue_ids', on ? f.venue_ids.filter((x) => x !== String(v._id)) : [...f.venue_ids, String(v._id)])}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium ${on ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>{v.name}</button>
            );
          })}
        </div>
      </Field>
      <Field label="Admin izohi"><input className="inp" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Shartnoma, kelishuv (mijozga ko'rinmaydi)" /></Field>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
    </Modal>
  );
}
