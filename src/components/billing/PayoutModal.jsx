import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/api';
import { RestaurantPayoutSection } from '@/pages/admin/RestaurantPayoutSection';
import { formatCard, copyText } from '@/lib/billingPeriod';
import { Sheet } from './Sheet';
import { som } from './format';

/*
 * ═══════════════════════════════════════════════════════════
 * "TO'LASH" OYNASI
 * ═══════════════════════════════════════════════════════════
 *
 * Avval "To'lash" faqat summa so'raydigan oddiy dialog edi —
 * PUL QAYERGA o'tkazilishi ko'rsatilmasdi, buxgalter rekvizitni
 * boshqa joydan qidirardi.
 *
 * Endi shu yerda: restoranning karta / bank rekviziti TO'LIQ
 * ko'rinadi (nusxa olish tugmasi bilan), kerak bo'lsa shu yerning
 * o'zida yangilanadi, so'ng to'lov qayd qilinadi.
 *
 * MUHIM: tizim PUL O'TKAZMAYDI. Buxgalter pulni bank ilovasidan
 * o'zi o'tkazadi, bu oyna esa o'tkazilganini QAYD qiladi (balans
 * kamayadi, jurnalga yoziladi). Tugma matni shuni aniq aytadi.
 *
 * To'liq rekvizit serverdan `reveal` endpointi orqali olinadi —
 * har ochilish serverda audit'ga yoziladi (kim, qachon).
 */

function CopyRow({ label, value, display, big }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const onCopy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
        <div className={`break-all font-mono text-ink ${big ? 'text-lg font-semibold tracking-wider' : 'text-sm'}`}>
          {display || value}
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={`flex-none rounded-lg border px-2.5 py-1.5 text-xs ${
          copied ? 'border-green-500 text-green-600' : 'border-line text-muted hover:bg-canvas'
        }`}
      >
        {copied ? '✓ Nusxa olindi' : 'Nusxa'}
      </button>
    </div>
  );
}

function Info({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

function Block({ title, primary, children }) {
  return (
    <div className={`rounded-xl border p-3 ${primary ? 'border-brand-400 bg-brand-400/5' : 'border-line'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {primary && (
          <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold text-brand-text">ASOSIY</span>
        )}
      </div>
      {children}
    </div>
  );
}

function CardBlock({ card, primary }) {
  if (!card.last4 && !card.number) return null;
  return (
    <Block title="💳 Plastik karta" primary={primary}>
      {card.number ? (
        <CopyRow label="Karta raqami" value={card.number} display={formatCard(card.number)} big />
      ) : (
        <div className="my-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {card.error || `Karta raqami to‘liq saqlanmagan (faqat oxirgi 4 xona: …${card.last4}).`}
          {' '}«Rekvizitni o‘zgartirish» orqali to‘liq raqamni kiriting.
        </div>
      )}
      <Info label="Karta egasi" value={card.holderName} />
      <Info label="Bank" value={card.bankName} />
    </Block>
  );
}

function BankBlock({ bank, primary }) {
  if (!bank.accountNumber && !bank.holderName) return null;
  return (
    <Block title="🏦 Bank hisob raqami" primary={primary}>
      <CopyRow label="Hisob raqami" value={bank.accountNumber} big />
      <CopyRow label="Hisob egasi" value={bank.holderName} />
      <div className="grid grid-cols-2 gap-x-3">
        <CopyRow label="MFO" value={bank.mfo} />
        <CopyRow label="STIR" value={bank.inn} />
      </div>
      <Info label="Bank" value={bank.bankName} />
    </Block>
  );
}

export function PayoutModal({ restaurant, onClose, onDone }) {
  const balance = Math.round(restaurant.balans || 0);

  const [reveal, setReveal] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const editorRef = useRef(null);

  const [amount, setAmount] = useState(String(balance));
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState('');
  // Tez ikki marta bosishdan himoya (server idempotencyKey bilan ham himoyalangan)
  const payingRef = useRef(false);

  const loadReveal = useCallback(async () => {
    setLoadErr('');
    try {
      setReveal(await adminApi.revealRestaurantPayout(restaurant._id));
    } catch (e) {
      setLoadErr(e.message);
    }
  }, [restaurant._id]);

  useEffect(() => { loadReveal(); }, [loadReveal]);

  const n = Number(amount) || 0;
  const tooMuch = n > balance;
  const valid = n > 0 && !tooMuch;

  const hasAny = reveal && (
    reveal.card.number || reveal.card.last4 || reveal.bank.accountNumber
  );
  const cardPrimary = reveal?.method === 'card';

  const saveRequisites = async () => {
    setSavingReq(true);
    try {
      await editorRef.current?.save();
      setEditing(false);
      await loadReveal();
    } catch { /* xatoni forma o'zi ko'rsatadi */ }
    setSavingReq(false);
  };

  const pay = async () => {
    if (payingRef.current || !valid) return;
    payingRef.current = true;
    setPaying(true);
    setErr('');
    try {
      await adminApi.payout({
        restaurantId: restaurant._id,
        amount: n,
        note: note.trim() || undefined,
        // Har bosishda yangi kalit: bu YANGI mantiqiy so'rov; haqiqiy
        // himoya — serverdagi atomik balans tekshiruvi va shu kalit.
        idempotencyKey: crypto.randomUUID(),
      });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  /* ═══ REKVIZITNI TAHRIRLASH ═══ */
  if (editing) {
    return (
      <Sheet title="Rekvizitni o‘zgartirish" subtitle={restaurant.name} onClose={() => setEditing(false)}>
        <RestaurantPayoutSection ref={editorRef} restaurantId={restaurant._id} />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm text-muted"
          >
            Bekor
          </button>
          <button
            type="button"
            onClick={saveRequisites}
            disabled={savingReq}
            className="flex-[1.5] rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {savingReq ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`${restaurant.name} ga to‘lov`} subtitle={`Restoranga qarzimiz: ${som(balance)} so‘m`} onClose={onClose}>
      <div className="mb-3 rounded-lg bg-canvas px-3 py-2 text-[11px] text-muted">
        Pulni quyidagi rekvizitga bank ilovasidan <b className="text-ink">o‘zingiz o‘tkazing</b>.
        Tizim pul jo‘natmaydi — pastdagi tugma faqat o‘tkazilganini qayd etadi.
      </div>

      {/* ═══ PUL QAYERGA ═══ */}
      {!reveal && !loadErr && <div className="py-6 text-center text-sm text-muted">Rekvizit yuklanmoqda...</div>}
      {loadErr && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">
          Rekvizitni yuklab bo‘lmadi: {loadErr}
          <button type="button" onClick={loadReveal} className="ml-2 underline">Qayta urinish</button>
        </div>
      )}

      {reveal && (
        <div className="mb-3 space-y-2">
          {!hasAny && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
              Bu restoran uchun <b>rekvizit kiritilmagan</b> — pulni qayerga o‘tkazishni bilib bo‘lmaydi.
            </div>
          )}
          {cardPrimary ? (
            <>
              <CardBlock card={reveal.card} primary />
              <BankBlock bank={reveal.bank} />
            </>
          ) : (
            <>
              <BankBlock bank={reveal.bank} primary={reveal.method === 'bank'} />
              <CardBlock card={reveal.card} />
            </>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-line py-2 text-xs text-muted hover:bg-canvas"
          >
            {hasAny ? 'Rekvizitni o‘zgartirish' : 'Rekvizit kiritish'}
          </button>
        </div>
      )}

      {/* ═══ SUMMA ═══ */}
      <label className="mb-3 block">
        <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-muted">
          <span>O‘tkazilgan summa (so‘m)</span>
          <button type="button" onClick={() => setAmount(String(balance))} className="text-brand-600 underline">
            Hammasi: {som(balance)}
          </button>
        </span>
        <input
          inputMode="numeric"
          value={amount ? som(Number(amount)) : ''}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 12))}
          placeholder="0"
          className={`w-full rounded-xl border bg-canvas px-3 py-3 text-lg font-semibold ${
            tooMuch ? 'border-red-500' : 'border-line'
          }`}
        />
        {tooMuch && <span className="mt-1 block text-[11px] text-red-600">Qarzdan ({som(balance)}) ko‘p bo‘lishi mumkin emas</span>}
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-muted">Izoh (ixtiyoriy — masalan, chek raqami)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
        />
      </label>

      {err && <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{err}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line py-3 text-sm text-muted">
          Bekor
        </button>
        <button
          type="button"
          onClick={pay}
          disabled={!valid || paying}
          className="flex-[2] rounded-xl bg-brand-400 py-3 text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {paying ? 'Qayd etilmoqda...' : '✓ Pulni o‘tkazdim — qayd qilish'}
        </button>
      </div>
    </Sheet>
  );
}
