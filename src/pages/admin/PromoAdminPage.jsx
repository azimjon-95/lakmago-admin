import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { Img } from '@/components/Img';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const TABS = [
  ['pending', 'Kutilmoqda'],
  ['approved', 'Tasdiqlangan'],
  ['rejected', 'Rad etilgan'],
  ['', 'Barchasi'],
];

/**
 * Reklama so'rovlarini tasdiqlash navbati — Moliya bo'limidagi
 * Kunlik hisobot bilan bir xil ruhda: aniq, tushunarli, ikki
 * bosqichli tasdiqlash (tasodifiy bosishning oldini olish uchun
 * emas, bu yerda oddiy — lekin RAD ETISH uchun sabab so'raladi,
 * chunki restoran buni ko'radi).
 */
export function PromoAdminPage() {
  const [tab, setTab] = useState('pending');
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAds(await adminApi.getAllAds(tab));
    } catch { setAds([]); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const approve = async (ad) => {
    const ok = await confirm({
      title: 'Reklama tasdiqlansinmi?',
      content: `${ad.restaurantId?.name} — ${ad.days} kun bosh sahifa banner karuselida ko'rinadi (bugundan boshlab).`,
      tone: 'success',
      okText: 'Tasdiqlash',
    });
    if (!ok) return;
    setBusyId(ad._id);
    try {
      await adminApi.approveAd(ad._id);
      await load();
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  const reject = async (ad) => {
    const reason = await confirm({
      title: 'Rad etish sababi',
      content: 'Restoran shu sababni ko\u2018radi.',
      input: true,
      inputPlaceholder: 'Masalan: rasm sifati past',
      tone: 'danger',
      okText: 'Rad etish',
    });
    if (reason === false) return;
    setBusyId(ad._id);
    try {
      await adminApi.rejectAd(ad._id, reason || '');
      await load();
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-ink mb-1">Reklama so'rovlari</h1>
      <p className="text-sm text-muted mb-5">
        Restoranlar yuborgan banner reklama so'rovlarini ko'rib chiqish
      </p>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line no-scrollbar">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-none whitespace-nowrap border-b-2 -mb-px px-3.5 py-2 text-sm font-medium ${
              tab === k ? 'border-brand-400 text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : ads.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">Bu bo'limda so'rov yo'q</div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad._id} className="rounded-xl border border-line bg-surface p-3.5 sm:flex sm:gap-4">
              <Img
                src={ad.imageUrl} w={400}
                className="mb-3 h-40 w-full flex-none rounded-lg object-cover bg-canvas sm:mb-0 sm:h-28 sm:w-40"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{ad.restaurantId?.name}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">
                    {ad.targetType === 'dish'
                      ? `Taom: ${ad.dishId?.name || ad.customTitle || '\u2014'}`
                      : (ad.customTitle || 'Restoran reklamasi')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {ad.days} kun · {som(ad.totalPrice / 100)} so'm · {fmtDateTime(ad.createdAt)} yuborilgan
                </div>
                {ad.customDescription && (
                  <div className="mt-1 text-xs text-ink">"{ad.customDescription}"</div>
                )}
                {ad.status === 'rejected' && ad.rejectReason && (
                  <div className="mt-1.5 text-xs text-red-600">Sabab: {ad.rejectReason}</div>
                )}
                {(ad.status === 'approved' || ad.status === 'active') && ad.startsAt && (
                  <div className="mt-1.5 text-xs text-green-700">
                    {fmtDate(ad.startsAt)} — {fmtDate(ad.endsAt)} oralig'ida ko'rinadi
                  </div>
                )}

                {ad.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => approve(ad)}
                      disabled={busyId === ad._id}
                      className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none sm:px-5"
                    >
                      Tasdiqlash
                    </button>
                    <button
                      onClick={() => reject(ad)}
                      disabled={busyId === ad._id}
                      className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 sm:flex-none sm:px-5"
                    >
                      Rad etish
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
