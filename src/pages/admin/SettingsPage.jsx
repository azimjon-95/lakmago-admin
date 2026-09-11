import { useState, useEffect } from 'react';
import { adminApi } from '@/api';
import { useTempFlag } from '@/hooks/useTempFlag';

/*
 * ═══ GLOBAL KOMISSIYA TANLAGICHI OLIB TASHLANDI ═══
 *
 * Bu sahifada ilgari "Komissiyasiz / Narx ustiga qo'shish /
 * Narxdan olish" va foiz slayderi bor edi — BARCHA restoranlarga
 * bitta umumiy sozlama sifatida taqdim etilgan.
 *
 * MUAMMO: har bir restoran allaqachon O'ZINING alohida
 * komissiya foiziga ega (Restoranlar → tanlangan restoran →
 * Komissiya, billingController.setCommission orqali belgilanadi).
 * Bu ekran esa ikkinchi, GLOBAL qiymatni tahrirlardi — ikkalasi
 * turlicha ishlatilib, adashtirardi: kimdir shu yerda "10%"
 * qo'ysa, bu HAMMA restoranlarga emas, faqat individual foizi
 * BELGILANMAGAN restoranlarga zaxira sifatida ta'sir qilardi.
 *
 * Bundan tashqari "Daromad" sahifasi bu global qiymatni BARCHA
 * restoranlarga qo'llab, ularning o'z foizini butunlay
 * e'tiborsiz qoldirar edi — bu alohida tuzatildi
 * (controllers/admin.js, revenue()).
 *
 * Shu sababli bu ekran olib tashlandi. Har bir restoranning
 * komissiyasi FAQAT o'sha restoran sahifasida ko'riladi va
 * o'zgartiriladi.
 */
export function SettingsPage() {
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, flashSaved] = useTempFlag();

  useEffect(() => {
    adminApi.getSettings()
      .then((s) => setReferralEnabled(s.referralEnabled !== false))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings({ referralEnabled });
      flashSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-ink">Sozlamalar</h1>
      <p className="text-sm text-muted mt-0.5 mb-6">
        Restoran komissiyasi endi shu yerda emas — har bir restoran
        sahifasida alohida belgilanadi.
      </p>

      {/* Referral tizimi */}
      <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5 mb-4">
        <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
          <i className="ti ti-users text-brand-600" /> Do'stlarni taklif qilish
        </h2>
        <p className="text-xs text-muted mb-4">
          O'chirilsa: mijoz profilida karta ko'rinmaydi, havola ishlamaydi,
          bonus berilmaydi
        </p>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="min-w-0">
            <div className="text-sm text-ink">Referral tizimi</div>
            <div className={`text-xs mt-0.5 ${referralEnabled ? 'text-green-600' : 'text-muted'}`}>
              {referralEnabled ? 'Yoqilgan — bonuslar beriladi' : "O'chirilgan"}
            </div>
          </div>
          <input
            type="checkbox"
            checked={referralEnabled}
            onChange={(e) => setReferralEnabled(e.target.checked)}
            className="w-5 h-5 accent-brand-400 flex-none"
          />
        </label>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="bg-brand-400 text-brand-text font-medium px-6 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
      >
        {saving ? 'Saqlanmoqda...' : saved ? '✓ Saqlandi' : 'Saqlash'}
      </button>
    </div>
  );
}
