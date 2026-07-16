import { useState, useEffect } from 'react';
import { panelApi } from '@/api';
import { useAuth } from '@/store/auth';
import { ImageUpload } from '@/components/ImageUpload';

const EMPTY = { title: '', eyebrow: '', cta: "Ko'rish", bg: '#411E00', imageUrl: '', icon: 'ti-discount-2' };
const BG_PRESETS = ['#411E00', '#993C1D', '#1E3A2F', '#2C2140', '#0E2A3A', '#3A1E2E'];

export function RestaurantBannerPage() {
  const restaurant = useAuth((s) => s.restaurant);
  const [form, setForm] = useState(EMPTY);
  const [hasBanner, setHasBanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    panelApi.getBanner()
      .then((b) => {
        if (b) {
          setForm({ title: b.title, eyebrow: b.eyebrow || '', cta: b.cta || "Ko'rish", bg: b.bg || '#411E00', imageUrl: b.imageUrl || '', icon: b.icon || 'ti-discount-2' });
          setHasBanner(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.title.trim()) { alert('Sarlavha kiriting'); return; }
    setSaving(true);
    try {
      await panelApi.setBanner(form);
      setHasBanner(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm("Banneringiz o'chirilsinmi?")) return;
    await panelApi.deleteBanner();
    setForm(EMPTY);
    setHasBanner(false);
  };

  if (loading) return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="flex-1 p-6 min-w-0 max-w-lg">
      <h1 className="text-xl font-semibold text-ink">Mening bannerim</h1>
      <p className="text-sm text-muted mt-0.5 mb-5">
        Webapp bosh sahifasida ko'rinadigan reklama banneringiz. Istalgan vaqt almashtiring.
      </p>

      {/* Jonli ko'rinish */}
      <div className="rounded-2xl p-5 mb-5 flex items-center justify-between min-h-[110px]" style={{ background: form.imageUrl ? `center/cover url(${form.imageUrl})` : form.bg }}>
        <div>
          <div className="text-[11px] font-medium" style={{ color: '#FAC775' }}>{form.eyebrow || restaurant?.name?.toUpperCase() || 'RESTORAN'}</div>
          <div className="text-white text-lg font-medium mt-0.5">{form.title || 'Banner sarlavhasi'}</div>
          <div className="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-lg bg-brand-400 text-brand-text">{form.cta}</div>
        </div>
        <i className={`ti ${form.icon} text-4xl text-brand-400`} />
      </div>

      <label className="block text-xs text-muted mb-1">Sarlavha *</label>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" placeholder="Bugun 2ta osh — 1tasi bepul!" />

      <label className="block text-xs text-muted mb-1">Kichik sarlavha</label>
      <input value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" placeholder="MAXSUS TAKLIF" />

      <label className="block text-xs text-muted mb-1">Tugma matni</label>
      <input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-ink outline-none focus:border-brand-400" />

      <div className="mb-3">
        <ImageUpload
          value={form.imageUrl}
          onChange={(url) => setForm({ ...form, imageUrl: url })}
          folder="banners"
          label="Banner rasmi (ixtiyoriy)"
          aspect="3/1"
        />
      </div>

      <label className="block text-xs text-muted mb-1">Fon rangi</label>
      <div className="flex gap-2 mb-5">
        {BG_PRESETS.map((c) => (
          <button key={c} onClick={() => setForm({ ...form, bg: c })} className={`w-8 h-8 rounded-lg border-2 ${form.bg === c ? 'border-brand-400' : 'border-transparent'}`} style={{ background: c }} />
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white disabled:opacity-50">
          {saving ? 'Saqlanmoqda...' : saved ? '✓ Saqlandi' : hasBanner ? 'Yangilash' : 'Bannerni joylash'}
        </button>
        {hasBanner && (
          <button onClick={remove} className="px-5 border border-line text-red-500 rounded-xl hover:bg-red-50">O'chirish</button>
        )}
      </div>
    </div>
  );
}
