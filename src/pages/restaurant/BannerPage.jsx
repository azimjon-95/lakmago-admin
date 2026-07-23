import { useState, useEffect } from 'react';
import { panelApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';

export function RestaurantBannerPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [hasBanner, setHasBanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    panelApi.getBanner()
      .then((b) => {
        if (b?.imageUrl) {
          setImageUrl(b.imageUrl);
          setHasBanner(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!imageUrl) { alert('Banner rasmini yuklang'); return; }
    setSaving(true);
    try {
      // Restoran banneri — faqat rasm, matn va tugma yo'q
      await panelApi.setBanner({ imageUrl, hasButton: false });
      setHasBanner(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Banneringiz o'chirilsinmi?")) return;
    try {
      await panelApi.deleteBanner();
      setImageUrl('');
      setHasBanner(false);
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) {
    return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;
  }

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-lg">
      <h1 className="text-lg sm:text-xl font-semibold text-ink">Mening bannerim</h1>
      <p className="text-xs sm:text-sm text-muted mt-0.5 mb-5">
        Restoran sahifangizda ko'rinadigan reklama rasmi. Istalgan vaqt almashtiring.
      </p>

      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          folder="banners"
          label="Banner rasmi"
          aspect="3/1"
        />
        <p className="text-[11px] text-muted mt-2">
          Tavsiya: 1200×400 px, chekkalarida muhim matn bo'lmasin
        </p>

        {saved && (
          <div className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mt-4">
            Saqlandi
          </div>
        )}

        <div className="flex gap-3 mt-5">
          {hasBanner && (
            <button
              onClick={remove}
              className="px-4 py-2.5 border border-line text-muted rounded-xl hover:bg-canvas flex-none"
            >
              O'chirish
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !imageUrl}
            className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : hasBanner ? 'Almashtirish' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
