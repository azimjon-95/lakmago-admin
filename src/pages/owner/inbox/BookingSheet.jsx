import { useCallback, useEffect, useState } from 'react';
import { ownerApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { Badge, EVENT_LABEL, ErrorBox, Field, Modal, PAY_METHOD, Section, som } from '@/pages/wedding/common';
import { useOwnerInbox } from '@/store/ownerInbox';
import { STATE_STYLE, REJECT_REASONS, addDays, ago, copyText, digits, fmtDate, fmtDateTime, spaced, telHref, timeLeft, today, weekdayOf } from './helpers';

/*
 * ═══ MIJOZ BRONI — TO'LIQ MA'LUMOT VA BOSHQARUV ═══
 * Egasi bir joyda ko'radi: mijoz (telefon bilan), tadbir, narx va to'lovlar, muddat, tarix.
 * Amallar holatga qarab (server `actions` ro'yxatini beradi — interfeys o'zi taxmin qilmaydi):
 *   Yangi so'rov : Rad etish · Kelishildi · (Avans keldi / Avanssiz tasdiqlash)
 *   Kelishildi   : Rad etish · Avans olindi · (Avanssiz tasdiqlash / Kelishuvni o'zgartirish)
 *   Tasdiqlandi  : Qo'shimcha to'lov · Bekor qilish
 */
const TL_ICON = {
  created: ['ti-bell-ringing', 'text-amber-600 bg-amber-50'], seen: ['ti-eye', 'text-gray-600 bg-gray-100'],
  agreed: ['ti-handshake', 'text-blue-600 bg-blue-50'], advance: ['ti-cash', 'text-green-600 bg-green-50'],
  payment: ['ti-cash', 'text-green-600 bg-green-50'], confirmed: ['ti-circle-check', 'text-green-600 bg-green-50'],
  rejected: ['ti-circle-x', 'text-red-600 bg-red-50'], cancelled: ['ti-ban', 'text-red-600 bg-red-50'], expired: ['ti-clock-off', 'text-gray-600 bg-gray-100'],
};

export function BookingSheet({ id, onClose }) {
  const touch = useOwnerInbox((s) => s.touch);
  const [b, setB] = useState(null);
  const [err, setErr] = useState(null);
  const [dlg, setDlg] = useState(null); // 'reject' | 'agree' | 'advance' | 'cancel'
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try { setB(await ownerApi.inboxBooking(id)); } catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Ochilishi bilan "ko'rdim" — mijozga javob kutilayotgani haqida eslatma ketmasin
  useEffect(() => {
    if (b && b.state === 'new' && !b.seen_at) ownerApi.inboxSeen(id).then((nb) => { setB(nb); touch(); }).catch(() => {});
  }, [b, id, touch]);

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { setB(await fn()); setDlg(null); touch(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const can = (a) => b?.actions?.includes(a);
  const st = STATE_STYLE[b?.state] || STATE_STYLE.new;

  const confirmNoAdvance = async () => {
    if (!await confirm({ title: 'Avanssiz tasdiqlansinmi?', content: "Seans BAND qilinadi. Avans olinsa, keyin \"To'lov\" sifatida yozasiz.", tone: 'warning' })) return;
    run(() => ownerApi.inboxConfirm(id, {}));
  };

  const footer = b && (
    <div className="w-full">
      {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      <div className="flex gap-2">
        {can('reject') && <button onClick={() => setDlg('reject')} disabled={busy} className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-50">Rad etish</button>}
        {can('cancel') && <button onClick={() => setDlg('cancel')} disabled={busy} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-50">Bekor qilish</button>}
        {b.state === 'new' && can('agree') && <button onClick={() => setDlg('agree')} disabled={busy} className="flex-[1.4] rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"><i className="ti ti-handshake" /> Kelishildi</button>}
        {can('advance') && <button onClick={() => setDlg('advance')} disabled={busy} className="flex-[1.4] rounded-xl bg-green-600 py-3 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"><i className="ti ti-cash" /> {b.state === 'confirmed' ? "Qo'shimcha to'lov" : 'Avans olindi'}</button>}
      </div>
      {(can('confirm') || (b.state === 'agreed' && can('agree'))) && (
        <div className="mt-2 flex justify-center gap-4 text-xs font-medium text-muted">
          {b.state === 'new' && can('advance') && <button onClick={() => setDlg('advance')} className="underline">Avans keldi</button>}
          {can('confirm') && <button onClick={confirmNoAdvance} className="underline">Avanssiz tasdiqlash</button>}
          {b.state === 'agreed' && can('agree') && <button onClick={() => setDlg('agree')} className="underline">Kelishuvni o'zgartirish</button>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Modal title="Bron so'rovi" onClose={onClose} wide footer={footer}>
        {!b && !err && <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>}
        {!b && err && <ErrorBox error={err} onRetry={load} />}
        {b && (
          <div className="-mx-1 space-y-3">
            {/* Mijoz */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-ink">{b.customer.name}</div>
                  <div className="text-xs text-muted">{b.number} · {ago(b.created_at)} yuborilgan</div>
                </div>
                <Badge cls={st.cls} icon={st.icon}>{st.label}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={telHref(b.customer.phone)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white active:opacity-80">
                  <i className="ti ti-phone-call" /> {b.customer.phone}
                </a>
                <button onClick={async () => { setCopied(await copyText(b.customer.phone)); setTimeout(() => setCopied(false), 1800); }} className="rounded-xl border border-line px-3.5 text-sm text-ink active:bg-canvas" aria-label="Nusxalash">
                  <i className={`ti ${copied ? 'ti-check text-green-600' : 'ti-copy'}`} />
                </button>
              </div>
            </div>

            {/* Muddat */}
            {b.state === 'new' && <Banner tone="amber" icon="ti-hourglass">Javob muddati: <b>{timeLeft(b.hold_until)}</b>. Mijoz bilan telefonda gaplashib, "Kelishildi" yoki "Rad etish"ni bosing.</Banner>}
            {b.state === 'agreed' && <Banner tone="blue" icon="ti-calendar-time">Avans muddati: <b>{fmtDateTime(b.advance_due)}</b> ({timeLeft(b.advance_due)}). Shu paytgacha seans ushlab turiladi.</Banner>}
            {b.state === 'rejected' && <Banner tone="red" icon="ti-circle-x">Rad etildi: <b>{b.reject_reason}</b></Banner>}
            {b.state === 'cancelled' && b.reject_reason && <Banner tone="red" icon="ti-ban">Bekor qilindi: <b>{b.reject_reason}</b></Banner>}
            {b.state === 'expired' && <Banner tone="gray" icon="ti-clock-off">Muddat tugadi, seans bo'shatildi.</Banner>}
            {b.agreed_note && <Banner tone="blue" icon="ti-notes">Kelishuv: {b.agreed_note}</Banner>}

            {/* Tadbir */}
            <Section title="Tadbir" icon="ti-calendar-event">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <Row k="Sana" v={`${fmtDate(b.date)} · ${weekdayOf(b.date)}`} />
                <Row k="Seans" v={b.session_label} />
                <Row k="Zal" v={b.hall_name} />
                <Row k="Tadbir turi" v={EVENT_LABEL[b.event_type] || b.event_type} />
                <Row k="Mehmonlar" v={`${b.guests} kishi`} />
                <Row k="Menyu" v={b.menu?.name ? `${b.menu.name}${b.menu.price_per_guest ? ` · ${som(b.menu.price_per_guest)}` : ''}` : '—'} />
              </dl>
              {b.extras.length > 0 && (
                <div className="mt-3 border-t border-line pt-3 text-sm">
                  <div className="mb-1 text-xs text-muted">Qo'shimcha xizmatlar</div>
                  {b.extras.map((e, i) => <div key={i} className="flex justify-between"><span>{e.name}</span><span className="tabular-nums">{som(e.price)}</span></div>)}
                </div>
              )}
            </Section>

            {/* Narx */}
            <Section title="Narx va to'lov" icon="ti-cash">
              <div className="space-y-1.5 text-sm">
                {b.price_per_guest > 0 && <Line k={`${b.guests} × ${som(b.price_per_guest)}`} v={som(b.venue_total)} muted />}
                <Line k="Dastlabki jami" v={`${som(b.total)} so'm`} strike={b.agreed_total != null && b.agreed_total !== b.total} />
                {b.agreed_total != null && b.agreed_total !== b.total && <Line k="Kelishilgan jami" v={`${som(b.agreed_total)} so'm`} bold />}
                <Line k="To'langan" v={`${som(b.paid)} so'm`} cls="text-green-700" bold />
                <Line k="Qoldiq" v={`${som(b.balance)} so'm`} cls={b.balance > 0 ? 'text-red-600' : 'text-green-700'} bold />
                {b.state !== 'confirmed' && b.state !== 'completed' && b.deposit_suggested > 0 && <Line k="Tavsiya etilgan avans" v={`${som(b.deposit_suggested)} so'm`} muted />}
              </div>
              {b.payments.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {b.payments.map((p, i) => (
                    <div key={p.id || i} className="flex items-center justify-between text-sm">
                      <span className="text-muted"><i className="ti ti-circle-check text-green-600" /> {p.kind === 'deposit' ? 'Avans' : p.kind === 'refund' ? 'Qaytarish' : "To'lov"} · {PAY_METHOD[p.method] || p.method} · {fmtDate(p.date)}</span>
                      <b className={`tabular-nums ${p.kind === 'refund' ? 'text-red-600' : 'text-green-700'}`}>{p.kind === 'refund' ? '−' : '+'}{som(p.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Tarix */}
            <Section title="Tarix" icon="ti-history">
              <ol className="space-y-3">
                {[...b.timeline].reverse().map((t, i) => {
                  const [icon, cls] = TL_ICON[t.kind] || ['ti-point', 'text-gray-600 bg-gray-100'];
                  return (
                    <li key={i} className="flex gap-3">
                      <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm ${cls}`}><i className={`ti ${icon}`} /></span>
                      <div className="min-w-0 flex-1 text-sm"><div className="text-ink">{t.text}</div><div className="text-[11px] text-muted">{fmtDateTime(t.at)}</div></div>
                    </li>
                  );
                })}
              </ol>
            </Section>
          </div>
        )}
      </Modal>

      {dlg === 'reject' && <ReasonDialog title="Rad etish sababi" cta="Rad etish" busy={busy} err={err} onClose={() => setDlg(null)} onSubmit={(d) => run(() => ownerApi.inboxReject(id, d))} />}
      {dlg === 'cancel' && <ReasonDialog title="Bekor qilish sababi" cta="Bronni bekor qilish" warn={b?.paid > 0 ? `Mijoz ${som(b.paid)} so'm to'lagan. Qaytarishni alohida rasmiylashtirasiz.` : null} busy={busy} err={err} onClose={() => setDlg(null)} onSubmit={(d) => run(() => ownerApi.inboxCancel(id, d))} />}
      {dlg === 'agree' && b && <AgreeDialog b={b} busy={busy} err={err} onClose={() => setDlg(null)} onSubmit={(d) => run(() => ownerApi.inboxAgree(id, d))} />}
      {dlg === 'advance' && b && <AdvanceDialog b={b} busy={busy} err={err} onClose={() => setDlg(null)} onSubmit={(d) => run(() => ownerApi.inboxAdvance(id, d))} />}
    </>
  );
}

const TONES = { amber: 'bg-amber-50 text-amber-900', blue: 'bg-blue-50 text-blue-900', red: 'bg-red-50 text-red-800', gray: 'bg-gray-100 text-gray-700' };
function Banner({ tone, icon, children }) {
  return <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-snug ${TONES[tone]}`}><i className={`ti ${icon} mt-0.5 text-base`} /><div>{children}</div></div>;
}
const Row = ({ k, v }) => <div className="min-w-0"><dt className="text-[11px] text-muted">{k}</dt><dd className="truncate font-medium text-ink">{v}</dd></div>;
const Line = ({ k, v, cls = '', bold, muted, strike }) => (
  <div className={`flex justify-between gap-3 ${muted ? 'text-xs text-muted' : ''}`}>
    <span className={muted ? '' : 'text-muted'}>{k}</span>
    <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${cls} ${strike ? 'text-muted line-through' : ''}`}>{v}</span>
  </div>
);

/* ── Rad etish / bekor qilish: sabab tanlash ── */
function ReasonDialog({ title, cta, warn, busy, err, onClose, onSubmit }) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const bad = !code || (code === 'other' && note.trim().length < 3);
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Orqaga</button>
        <button disabled={bad || busy} onClick={() => onSubmit({ reason_code: code, note: note.trim() })} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saqlanmoqda...' : cta}</button>
      </>
    }>
      {warn && <Banner tone="amber" icon="ti-alert-triangle">{warn}</Banner>}
      <div className={`space-y-2 ${warn ? 'mt-3' : ''}`}>
        {REJECT_REASONS.map(([k, label]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${code === k ? 'border-red-300 bg-red-50 text-red-700' : 'border-line text-ink'}`}>
            <input type="radio" name="reason" checked={code === k} onChange={() => setCode(k)} className="accent-red-600" />{label}
          </label>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="inp mt-3 resize-none" placeholder={code === 'other' ? 'Sababni yozing (majburiy)' : 'Izoh (ixtiyoriy)'} />
      <p className="mt-2 text-[11px] text-muted">Sabab mijozga ilovada ko'rsatiladi.</p>
      {err && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
    </Modal>
  );
}

/* ── Kelishildi: avans muddati, izoh, (ixtiyoriy) kelishilgan jami ── */
function AgreeDialog({ b, busy, err, onClose, onSubmit }) {
  const t0 = today();
  const [due, setDue] = useState(b.advance_due ? new Date(b.advance_due).toISOString().slice(0, 10) : addDays(t0, 3));
  const [note, setNote] = useState(b.agreed_note || '');
  const [total, setTotal] = useState(b.agreed_total ? spaced(b.agreed_total) : '');
  const days = Math.round((new Date(`${due}T00:00:00Z`) - new Date(`${t0}T00:00:00Z`)) / 86_400_000);
  return (
    <Modal title="Kelishildi" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Orqaga</button>
        <button disabled={busy || days < 0 || days > 30} onClick={() => onSubmit({ note: note.trim(), advance_due: due, ...(total ? { agreed_total: Number(digits(total)) } : {}) })} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </>
    }>
      <p className="mb-3 text-[13px] text-muted">Mijoz bilan gaplashib kelishdingiz. Seans avans muddatigacha <b>ushlab turiladi</b>; avans kelmasa — o'zi bo'shaydi.</p>
      <Field label="Avans qachongacha keltiriladi" hint={days >= 0 ? `${days === 0 ? 'Bugun' : `${days} kun`} ichida (kun oxirigacha)` : "O'tgan sana bo'lmaydi"}>
        <div className="mb-2 flex gap-1.5">
          {[1, 3, 7, 14].map((n) => <button key={n} type="button" onClick={() => setDue(addDays(t0, n))} className={`flex-1 rounded-lg border py-2 text-xs font-medium ${days === n ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-line text-muted'}`}>{n} kun</button>)}
        </div>
        <input type="date" className="inp" value={due} min={t0} max={addDays(t0, 30)} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="Kelishilgan jami summa (ixtiyoriy)" hint={`Dastlabki: ${som(b.total)} so'm. Bo'sh qoldirsangiz o'zgarmaydi.`}>
        <input className="inp" inputMode="numeric" value={total} onChange={(e) => setTotal(spaced(e.target.value))} placeholder={som(b.total)} />
      </Field>
      <Field label="Kelishuv izohi (ixtiyoriy)">
        <textarea className="inp resize-none" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: gul bezagi sovg'a, oxirgi narx" />
      </Field>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
    </Modal>
  );
}

/* ── Avans olindi (tasdiqlanadi, kirimga yoziladi) / qo'shimcha to'lov ── */
function AdvanceDialog({ b, busy, err, onClose, onSubmit }) {
  const first = b.state !== 'confirmed';
  const [amount, setAmount] = useState(first && b.deposit_suggested ? spaced(b.deposit_suggested) : '');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const n = Number(digits(amount));
  const over = b.total_effective > 0 && n > b.balance;
  const chips = [first && b.deposit_suggested ? ['Tavsiya', b.deposit_suggested] : null, ['50%', Math.round(b.total_effective / 2)], ['Qoldiq', b.balance]].filter((c) => c && c[1] > 0 && c[1] <= b.balance);
  return (
    <Modal title={first ? 'Avans qabul qilish' : "Qo'shimcha to'lov"} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Orqaga</button>
        <button disabled={busy || !n || over} onClick={() => onSubmit({ amount: n, method, date, note: note.trim() })} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saqlanmoqda...' : first ? 'Qabul qilish va tasdiqlash' : "To'lovni yozish"}</button>
      </>
    }>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat k="Jami" v={som(b.total_effective)} /><Stat k="To'langan" v={som(b.paid)} cls="text-green-700" /><Stat k="Qoldiq" v={som(b.balance)} cls="text-red-600" />
      </div>
      <Field label="Summa (so'm)" hint={over ? undefined : first ? "Qabul qilinsa bron TASDIQLANADI, seans BAND bo'ladi va summa Kirim-chiqimga yoziladi." : "Summa Kirim-chiqimga yoziladi."}>
        <input className={`inp ${over ? 'border-red-400' : ''}`} inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(spaced(e.target.value))} placeholder="0" />
        {over && <p className="mt-1 text-[11px] text-red-600">Qoldiqdan oshmasin: {som(b.balance)}</p>}
        {chips.length > 0 && <div className="mt-2 flex gap-1.5">{chips.map(([l, v]) => <button key={l} type="button" onClick={() => setAmount(spaced(v))} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink active:bg-canvas">{l}: {som(v)}</button>)}</div>}
      </Field>
      <Field label="To'lov usuli">
        <div className="flex flex-wrap gap-1.5">{Object.entries(PAY_METHOD).map(([k, l]) => <button key={k} type="button" onClick={() => setMethod(k)} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${method === k ? 'border-green-500 bg-green-50 text-green-700' : 'border-line text-muted'}`}>{l}</button>)}</div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Sana"><input type="date" className="inp" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Izoh"><input className="inp" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy" /></Field>
      </div>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
    </Modal>
  );
}
const Stat = ({ k, v, cls = '' }) => <div className="rounded-xl bg-canvas px-2 py-2"><div className="text-[10px] text-muted">{k}</div><div className={`font-semibold tabular-nums ${cls}`}>{v}</div></div>;
