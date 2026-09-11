import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { adminApi } from '@/api';

/*
 * ═══════════════════════════════════════════════════════════
 * RESTORAN — TO'LOV REKVIZITI (Moliya)
 * ═══════════════════════════════════════════════════════════
 *
 * Buxgalter pulni qo'lda qayerga (bank hisobi yoki karta)
 * o'tkazishini shu yerda belgilaydi.
 *
 * ═══ BITTA "SAQLASH" TUGMASI ═══
 *
 * ILGARI bu komponent o'zining ALOHIDA "Saqlash" tugmasiga ega
 * edi — sahifada ikkita tugma paydo bo'lardi (asosiy forma
 * uchun bittasi, bu yerda yana bittasi), foydalanuvchi qaysi
 * birini bosish kerakligini bilmasdi.
 *
 * ENDI: bu komponent `forwardRef` orqali TASHQARIGA faqat bitta
 * `save()` funksiyasini ochadi. Sahifaning PASTKI, YAGONA
 * "Saqlash" tugmasi bosilganda, asosiy forma bilan BIRGA shu
 * funksiya ham chaqiriladi (RestaurantSettingsPage.jsx dagi
 * save() ga qarang). Bu yerda o'z tugmasi YO'Q.
 *
 * ═══ ICHKI RAMKALAR OLIB TASHLANDI ═══
 *
 * Ilgari har bo'lim ("Karta rekvizitlari", "Bank rekvizitlari",
 * "Hisob-kitob") o'z ramkasiga ega edi, TASHQI "Moliya"
 * ramkasining ICHIDA — "ramka ichida ramka" ko'rinishi hosil
 * qilardi, torroq va chalkash edi. Endi bo'limlar oddiy
 * sarlavha + bo'shliq bilan ajratiladi, faqat TASHQI ramka
 * qoladi (RestaurantSettingsPage.jsx dagi "Moliya" <section>).
 */
export const RestaurantPayoutSection = forwardRef(function RestaurantPayoutSection({ restaurantId }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Tashqariga ochiladigan yagona metod. Hech narsa
   * o'zgartirilmagan bo'lsa ham xavfsiz — backend "noChanges"
   * deb qaytaradi, xato tashlamaydi.
   */
  useImperativeHandle(ref, () => ({
    save: async () => {
      setErr('');
      try {
        const payload = { method };
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
        throw e; // asosiy save() bu xatoni ko'rib, xabar chiqarishi uchun
      }
    },
  }), [method, bank, cardNumber, cardHolder, cardBank, restaurantId, load]);

  if (loading) return <div className="text-sm text-muted py-4">Yuklanmoqda...</div>;

  return (
    <div className="space-y-6">
      {/* ═══ KARTA REKVIZITLARI ═══ */}
      <div>
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          💳 Karta rekvizitlari
        </div>
        <p className="mb-3 text-xs text-muted">
          Hozirgi: {data?.card?.hasCard ? data.card.cardMasked : 'kiritilmagan'}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
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
      </div>

      <div className="h-px bg-line" />

      {/* ═══ BANK REKVIZITLARI ═══ */}
      <div>
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          🏦 Bank rekvizitlari
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['accountNumber', 'Hisob raqami', data?.bank?.hasAccountNumber ? data.bank.accountNumber : ''],
            ['bankName', 'Bank nomi', data?.bank?.bankName],
            ['mfo', 'MFO', data?.bank?.mfo],
            ['inn', 'STIR', data?.bank?.inn],
            ['holderName', 'Hisob egasi', data?.bank?.holderName],
          ].map(([key, label, current]) => (
            <label key={key} className="block">
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
      </div>

      <div className="h-px bg-line" />

      {/* ═══ HISOB-KITOB — QAYSI USUL ASOSIY ═══ */}
      <div>
        <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
          💰 Hisob-kitob
        </div>
        <label className="block sm:max-w-xs">
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
    </div>
  );
});
