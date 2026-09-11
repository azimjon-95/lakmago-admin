import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

/*
 * ═══════════════════════════════════════════════════════════
 * RESTORAN — TO'LOV REKVIZITI (Moliya)
 * ═══════════════════════════════════════════════════════════
 *
 * Buxgalter pulni qo'lda qayerga (bank hisobi yoki karta)
 * o'tkazishini shu yerda belgilaydi.
 *
 * ATAYLAB ALOHIDA KOMPONENT, asosiy tahrirlash formasidan
 * MUSTAQIL: o'z holati, o'z saqlash tugmasi bor. Sabab:
 *   • asosiy forma (RestaurantSettingsPage) ALLAQACHON katta —
 *     TZ 20-band "yaratish formasi keragidan ortiq
 *     murakkablashtirilmasin" deydi
 *   • bu ma'lumot BOSHQA huquq darajasi bilan himoyalangan
 *     (backend 'billing' permission talab qiladi) — asosiy
 *     forma esa umumiy restoran tahrirlash huquqi bilan ishlaydi
 *   • ikkalasini bitta "Saqlash" tugmasiga bog'lash xato
 *     ehtimolini oshirardi (masalan admin nom o'zgartirib
 *     "Saqlash" bossa, bexosdan bank rekvizitini ham qayta
 *     yozib yuborishi mumkin edi)
 */
export function RestaurantPayoutSection({ restaurantId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [method, setMethod] = useState('bank');
  const [bank, setBank] = useState({ accountNumber: '', bankName: '', mfo: '', inn: '', holderName: '' });
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardBank, setCardBank] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRestaurantPayout(restaurantId);
      setData(res);
      setMethod(res.method || 'bank');
      setCardHolder(res.card?.holderName || '');
      setCardBank(res.card?.bankName || '');
      // Bank maydonlari — hisob raqami MASKALANGAN holda keladi,
      // qayta yozib yubormaslik uchun input bo'sh qoldiriladi
      // (placeholder orqali "hozirgi" ko'rsatiladi)
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const payload = { method };
      // Faqat TO'LDIRILGAN maydonlar yuboriladi — bo'sh qoldirilsa
      // eski qiymat saqlanib qoladi (backend shunday ishlaydi)
      const bankPatch = Object.fromEntries(
        Object.entries(bank).filter(([, v]) => v.trim() !== ''),
      );
      if (Object.keys(bankPatch).length > 0) payload.bank = bankPatch;

      if (cardNumber.trim() || cardHolder.trim() || cardBank.trim()) {
        payload.card = {
          ...(cardNumber.trim() ? { cardNumber: cardNumber.trim() } : {}),
          ...(cardHolder.trim() ? { holderName: cardHolder.trim() } : {}),
          ...(cardBank.trim() ? { bankName: cardBank.trim() } : {}),
        };
      }

      await adminApi.updateRestaurantPayout(restaurantId, payload);
      setCardNumber(''); // to'liq raqam ekranda ham saqlanmaydi
      setBank({ accountNumber: '', bankName: '', mfo: '', inn: '', holderName: '' });
      await load();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted py-4">Yuklanmoqda...</div>;

  return (
    <div className="space-y-4">
      {/* ═══ KARTA REKVIZITLARI ═══ */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          💳 Karta rekvizitlari
        </div>
        <p className="mb-3 text-xs text-muted">
          Hozirgi: {data?.card?.hasCard ? data.card.cardMasked : 'kiritilmagan'}
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Yangi karta raqami (to'liq — faqat o'zgartirishda)
          </span>
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder="8600 **** **** ****"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm tracking-wide"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Karta egasi</span>
          <input
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            placeholder={data?.card?.holderName || 'F.I.Sh.'}
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      {/* ═══ BANK REKVIZITLARI ═══ */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          🏦 Bank rekvizitlari
        </div>

        {[
          ['accountNumber', 'Hisob raqami', data?.bank?.hasAccountNumber ? data.bank.accountNumber : ''],
          ['bankName', 'Bank nomi', data?.bank?.bankName],
          ['mfo', 'MFO', data?.bank?.mfo],
          ['inn', 'STIR', data?.bank?.inn],
          ['holderName', 'Hisob egasi', data?.bank?.holderName],
        ].map(([key, label, current]) => (
          <label key={key} className="mb-3 block last:mb-0">
            <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
            <input
              value={bank[key]}
              onChange={(e) => setBank((b) => ({ ...b, [key]: e.target.value }))}
              placeholder={current || ''}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
            />
          </label>
        ))}
      </div>

      {/* ═══ HISOB-KITOB — QAYSI USUL ASOSIY ═══ */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          💰 Hisob-kitob
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">To'lov usuli</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
          >
            <option value="bank">Bank hisob raqami</option>
            <option value="card">Plastik karta</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">
          Buxgalter pulni shu usul bo'yicha yuboradi. Ikkinchi usul
          ma'lumoti ham saqlanadi — keyin osongina almashtirish mumkin.
        </p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-brand-400 py-3 font-semibold text-brand-text disabled:opacity-50"
      >
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}
