import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

const EMPTY = { title: '', eyebrow: '', cta: "Ko'rish", bg: '#411E00', imageUrl: '', icon: 'ti-gift' };
const BG_PRESETS = ['#411E00', '#993C1D', '#1E3A2F', '#2C2140', '#0E2A3A', '#3A1E2E'];

export function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | banner obyekti
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.getBanners();
      setBanners(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const platform = banners.filter((b) => b.kind === 'platform');
  const restaurant = banners.filter((b) => b.kind === 'restaurant');

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (b) => {
    setForm({ title: b.title, eyebrow: b.eyebrow || '', cta: b.cta || "Ko'rish", bg: b.bg || '#411E00', imageUrl: b.imageUrl || '', icon: b.icon || 'ti-gift' });
    setEditing(b);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('Sarlavha kiriting'); return; }
    setSaving(true);
    try {
      if (editing === 'new') await adminApi.createBanner(form);
      else await adminApi.updateBanner(editing._id, form);
      setEditing(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (b) => {
    const label = b.kind === 'restaurant' ? `"${b.restaurantName}" restoran banneri` : 'banner';
    if (!confirm(`${label} o'chirilsinmi?`)) return;
    await adminApi.deleteBanner(b._id);
    load();
  };

  if (loading) return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bannerlar</h1>
          <p className="text-sm text-muted mt-0.5">Webapp reklama bannerlarini boshqaring</p>
        </div>
        <button onClick={openNew} className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white transition-colors">
          <i className="ti ti-plus" /> Yangi banner
        </button>
      </div>

      {/* Platforma bannerlari */}
      <h2 className="text-sm font-medium text-ink mb-3">Platforma bannerlari</h2>
      {platform.length === 0 ? (
        <div className="text-center text-muted text-sm py-8 border border-dashed border-line rounded-xl mb-6">
          Platforma banneri yo'q. "Yangi banner" tugmasi bilan qo'shing.
        </div>
      ) : (
        <div className="grid gap-3 mb-6">
          {platform.map((b) => (
            <BannerCard key={b._id} banner={b} onEdit={() => openEdit(b)} onDelete={() => remove(b)} />
          ))}
        </div>
      )}

      {/* Restoran bannerlari */}
      <h2 className="text-sm font-medium text-ink mb-3">Restoran bannerlari</h2>
      {restaurant.length === 0 ? (
        <div className="text-center text-muted text-sm py-8 border border-dashed border-line rounded-xl">
          Restoranlar hali banner qo'shmagan. Ular o'z panelidan qo'shadi, siz esa bu yerdan o'chira olasiz.
        </div>
      ) : (
        <div className="grid gap-3">
          {restaurant.map((b) => (
            <BannerCard key={b._id} banner={b} onDelete={() => remove(b)} showOwner />
          ))}
        </div>
      )}

      {/* Tahrirlash modali */}
      {editing && (
        <div onClick={() => setEditing(null)} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-ink mb-4">{editing === 'new' ? 'Yangi banner' : 'Bannerni tahrirlash'}</h3>

            {/* Jonli ko'rinish */}
            <div className="rounded-xl p-4 mb-4 flex items-center justify-between" style={{ background: form.imageUrl ? `center/cover url(${form.imageUrl})` : form.bg }}>
              <div>
                <div className="text-[11px] font-medium" style={{ color: '#FAC775' }}>{form.eyebrow || 'REKLAMA'}</div>
                <div className="text-white font-medium mt-0.5">{form.title || 'Banner sarlavhasi'}</div>
                <div className="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-lg bg-brand-400 text-brand-text">{form.cta}</div>
              </div>
              <i className={`ti ${form.icon} text-3xl text-brand-400`} />
            </div>

            <label className="block text-xs text-muted mb-1">Sarlavha *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" placeholder="Birinchi buyurtmaga −30%" />

            <label className="block text-xs text-muted mb-1">Kichik sarlavha</label>
            <input value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" placeholder="TANLANGAN AKSIYA" />

            <label className="block text-xs text-muted mb-1">Tugma matni</label>
            <input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" />

            <label className="block text-xs text-muted mb-1">Rasm URL (ixtiyoriy)</label>
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" placeholder="https://..." />

            <label className="block text-xs text-muted mb-1">Fon rangi</label>
            <div className="flex gap-2 mb-4">
              {BG_PRESETS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, bg: c })} className={`w-8 h-8 rounded-lg border-2 ${form.bg === c ? 'border-brand-400' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 border border-line text-muted py-2.5 rounded-xl hover:bg-canvas">Bekor</button>
              <button onClick={save} disabled={saving} className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50">
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BannerCard({ banner: b, onEdit, onDelete, showOwner }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3">
      <div className="w-24 h-16 rounded-lg flex items-center justify-center flex-none" style={{ background: b.imageUrl ? `center/cover url(${b.imageUrl})` : b.bg }}>
        <i className={`ti ${b.icon || 'ti-photo'} text-xl text-brand-400`} />
      </div>
      <div className="flex-1 min-w-0">
        {b.eyebrow && <div className="text-[11px] text-brand-600 font-medium">{b.eyebrow}</div>}
        <div className="text-sm font-medium text-ink truncate">{b.title}</div>
        {showOwner && <div className="text-xs text-muted mt-0.5"><i className="ti ti-building-store text-[11px]" /> {b.restaurantName || 'Restoran'}</div>}
      </div>
      <div className="flex items-center gap-2 flex-none">
        {onEdit && (
          <button onClick={onEdit} title="Tahrirlash" className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted">
            <i className="ti ti-pencil" />
          </button>
        )}
        <button onClick={onDelete} title="O'chirish" className="w-9 h-9 rounded-lg border border-line hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-500">
          <i className="ti ti-trash" />
        </button>
      </div>
    </div>
  );
}
