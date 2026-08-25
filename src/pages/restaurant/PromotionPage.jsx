import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';
import { confirm } from '@/components/ui/confirm';
import { Img } from '@/components/Img';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const STATUS_LABELS = {
  pending: { text: 'Ko\u2018rib chiqilmoqda', cls: 'bg-amber-50 text-amber-700' },
  approved: { text: 'Tasdiqlangan', cls: 'bg-green-50 text-green-700' },
  active: { text: 'Hozir ko\u2018rinmoqda', cls: 'bg-green-50 text-green-700' },
  rejected: { text: 'Rad etilgan', cls: 'bg-red-50 text-red-600' },
  expired: { text: 'Muddati tugagan', cls: 'bg-gray-100 text-gray-500' },
  cancelled: { text: 'Bekor qilingan', cls: 'bg-gray-100 text-gray-500' },
};

/**
 * Mijozlarni jalb qilish — SODDALASHTIRILGAN.
 *
 * Avval uchta bo'lim bor edi (Aksiyalar/Reklama/Bonuslar) — endi
 * FAQAT ikkita yo'nalishda reklama: restoranni yoki bitta taomni
 * bosh sahifa banner karuselida ko'rsatish. Admin tasdiqlagandan
 * keyingina jonli bo'ladi.
 */
export function PromotionPage() {
  const [ads, setAds] = useState([]);
  const [pricePerDay, setPricePerDay] = useState(20000);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, price] = await Promise.all([
        panelApi.getAds(),
        panelApi.getAdPrice(),
      ]);
      setAds(list);
      setPricePerDay(price.pricePerDaySom);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancelAd = async (ad) => {
    const ok = await confirm({
      title: 'So\u2018rov bekor qilinsinmi?',
      content: 'Bu reklama so\u2018rovi butunlay bekor qilinadi.',
      tone: 'danger',
      okText: 'Bekor qilish',
    });
    if (!ok) return;
    await panelApi.cancelAd(ad._id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-ink mb-1">Mijozlarni jalb qilish</h1>
      <p className="text-sm text-muted mb-5">
        Restoraningizni yoki bitta taomingizni bosh sahifa banneriga chiqaring
      </p>

      <div className="mb-5 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted">Bannerda 1 kun turish narxi</div>
            <div className="text-lg font-bold text-brand-600">{som(pricePerDay)} so'm / kun</div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text"
          >
            + Reklama berish
          </button>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
          So'rov yuborilgandan so'ng LokmaGo admin tasdiqlaydi — shundan keyin
          bosh sahifa banner karuselida boshqa rasmlar orasida ko'rina boshlaydi.
        </p>
      </div>

      {showForm && (
        <AdForm
          pricePerDay={pricePerDay}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : ads.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">Hozircha reklama so'rovi yo'q</div>
      ) : (
        <div className="space-y-2.5">
          {ads.map((ad) => (
            <div key={ad._id} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
              <Img src={ad.imageUrl} w={128} className="h-16 w-16 flex-none rounded-lg object-cover bg-canvas" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {ad.targetType === 'dish'
                        ? (ad.dishId?.name || ad.customTitle || 'Taom')
                        : (ad.customTitle || 'Restoran reklamasi')}
                    </div>
                    <div className="text-xs text-muted">
                      {ad.days} kun · {som(ad.totalPrice / 100)} so'm
                    </div>
                  </div>
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_LABELS[ad.status]?.cls}`}>
                    {STATUS_LABELS[ad.status]?.text}
                  </span>
                </div>
                {ad.status === 'rejected' && ad.rejectReason && (
                  <div className="mt-1 text-[11px] text-red-600">Sabab: {ad.rejectReason}</div>
                )}
                {(ad.status === 'approved' || ad.status === 'active') && ad.startsAt && (
                  <div className="mt-1 text-[11px] text-muted">
                    {fmtDate(ad.startsAt)} — {fmtDate(ad.endsAt)}
                  </div>
                )}
                {ad.status === 'pending' && (
                  <button onClick={() => cancelAd(ad)} className="mt-1.5 text-[11px] text-red-500 hover:underline">
                    Bekor qilish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdForm({ pricePerDay, onClose, onCreated }) {
  const [targetType, setTargetType] = useState('restaurant');
  // Faqat targetType==='dish' uchun: 'existing' — mavjud taomga
  // bog'lash, 'custom' — o'zi rasm+matn yozadi (taomga bog'lanmaydi)
  const [dishMode, setDishMode] = useState('existing');
  const [dishId, setDishId] = useState('');
  const [imageMode, setImageMode] = useState('existing');   // 'existing' | 'upload'
  const [selectedImage, setSelectedImage] = useState('');
  const [uploadedImage, setUploadedImage] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [days, setDays] = useState(3);
  const [images, setImages] = useState({ restaurantImages: [], dishImages: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    panelApi.getAdImages().then(setImages).catch(() => {});
  }, []);

  const isCustomDish = targetType === 'dish' && dishMode === 'custom';

  // Tanlangan turga mos "mavjud rasmlar" ro'yxati.
  // O'zi yozadigan (custom) holatda ham taom rasmlariga emas,
  // restoranning umumiy galereyasiga tayanadi — chunki hech
  // qanday aniq taomga bog'lanmagan.
  const availableImages = (targetType === 'restaurant' || isCustomDish)
    ? images.restaurantImages
    : images.dishImages.filter((d) => !dishId || String(d.dishId) === dishId).map((d) => d.url);

  // Taom tanlash uchun noyob ro'yxat
  const dishOptions = [...new Map(images.dishImages.map((d) => [String(d.dishId), d])).values()];

  const finalImage = imageMode === 'upload' ? uploadedImage : selectedImage;
  const total = days * pricePerDay;

  const submit = async () => {
    setError('');
    if (targetType === 'dish' && dishMode === 'existing' && !dishId) {
      setError('Taom tanlanmagan'); return;
    }
    if (isCustomDish && !customTitle.trim()) {
      setError('Reklama uchun sarlavha yozing'); return;
    }
    if (!finalImage) { setError('Rasm tanlanmagan yoki yuklanmagan'); return; }
    if (!days || days < 1) { setError('Kunlar sonini kiriting'); return; }

    setSaving(true);
    try {
      await panelApi.createAd({
        targetType,
        dishId: targetType === 'dish' && dishMode === 'existing' ? dishId : undefined,
        imageUrl: finalImage, days: Number(days),
        customTitle: customTitle.trim() || undefined,
        customDescription: customDescription.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="mb-5 rounded-xl border border-line bg-surface p-4">
      {/* 1. Tur tanlash */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink">Nimani reklama qilasiz?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setTargetType('restaurant'); setDishId(''); setSelectedImage(''); }}
            className={`rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors ${
              targetType === 'restaurant' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
            }`}
          >
            <i className="ti ti-building-store mb-1 block text-lg" /> Restoranni
          </button>
          <button
            onClick={() => { setTargetType('dish'); setSelectedImage(''); }}
            className={`rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors ${
              targetType === 'dish' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
            }`}
          >
            <i className="ti ti-soup mb-1 block text-lg" /> Bitta taomni
          </button>
        </div>
      </div>

      {/* 2. Taom turi: mavjud taomdan yoki o'zi yozadi */}
      {targetType === 'dish' && (
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-ink">Qanday?</label>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => { setDishMode('existing'); setSelectedImage(''); }}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                dishMode === 'existing' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
              }`}
            >
              Mavjud taom
            </button>
            <button
              onClick={() => { setDishMode('custom'); setDishId(''); setSelectedImage(''); }}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                dishMode === 'custom' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
              }`}
            >
              O'zim yozaman
            </button>
          </div>

          {dishMode === 'existing' ? (
            <select
              value={dishId}
              onChange={(e) => { setDishId(e.target.value); setSelectedImage(''); }}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            >
              <option value="">Tanlang...</option>
              {dishOptions.map((d) => (
                <option key={d.dishId} value={d.dishId}>{d.dishName}</option>
              ))}
            </select>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted">
              Menyuda hali yo'q maxsus taklif yoki kombinatsiya bo'lsa shu yerni tanlang —
              pastda o'zingiz sarlavha va tavsif yozasiz.
            </p>
          )}
        </div>
      )}

      {/* 3. Moslashtirilgan matn — restoran reklamasida ixtiyoriy,
          "o'zim yozaman" taom reklamasida majburiy */}
      {(targetType === 'restaurant' || isCustomDish) && (
        <div className="mb-4 rounded-lg bg-canvas p-3">
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Sarlavha {isCustomDish ? '' : <span className="text-muted font-normal">(ixtiyoriy)</span>}
          </label>
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            maxLength={80}
            placeholder={targetType === 'restaurant' ? 'Masalan: Yangi filial ochildi!' : 'Masalan: Bayram seti'}
            className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Tavsif <span className="text-muted font-normal">(ixtiyoriy)</span>
          </label>
          <input
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            maxLength={200}
            placeholder="Qisqa izoh — mijoz modalda ko'radi"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* 4. Rasm — mavjuddan yoki yangi */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink">Banner rasmi</label>
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setImageMode('existing')}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
              imageMode === 'existing' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
            }`}
          >
            Mavjud rasmdan
          </button>
          <button
            onClick={() => setImageMode('upload')}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
              imageMode === 'upload' ? 'border-brand-400 bg-brand-tint text-ink' : 'border-line text-muted'
            }`}
          >
            Yangi yuklash
          </button>
        </div>

        {imageMode === 'existing' ? (
          availableImages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line py-4 text-center text-xs text-muted">
              {targetType === 'dish' && dishMode === 'existing' && !dishId ? 'Avval taomni tanlang' : 'Mavjud rasm topilmadi'}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableImages.map((url) => (
                <button
                  key={url}
                  onClick={() => setSelectedImage(url)}
                  className={`aspect-square overflow-hidden rounded-lg border-2 ${
                    selectedImage === url ? 'border-brand-400' : 'border-transparent'
                  }`}
                >
                  <Img src={url} w={600} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )
        ) : (
          <ImageUpload value={uploadedImage} onChange={setUploadedImage} folder="banners" label="" aspect="16/9" />
        )}
      </div>

      {/* 5. Necha kun */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink">Necha kun ko'rsatilsin?</label>
        <input
          type="number" min={1} max={90}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
        />
      </div>

      {/* Jami narx */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-canvas px-3 py-2.5">
        <span className="text-sm text-muted">Jami to'lov</span>
        <span className="text-base font-bold text-ink">{som(total)} so'm</span>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm">
          Bekor
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-400 py-2 text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {saving ? '...' : 'Yuborish'}
        </button>
      </div>
    </div>
  );
}
