import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { getSocket } from '@/lib/socket';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';

const fmtDT = (d) => d ? new Date(d).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—';

const STATUS = {
  pending: { label: "Ko'rib chiqilmoqda", cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Tasdiqlangan', cls: 'bg-blue-50 text-blue-700' },
  payment_required: { label: "To'lov kutilmoqda", cls: 'bg-amber-50 text-amber-700' },
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  suspended: { label: "To'xtatilgan", cls: 'bg-red-50 text-red-600' },
};

// Keyingi bosqichlar
const NEXT = {
  pending: [['approved', 'Tasdiqlash'], ['suspended', 'Rad etish']],
  approved: [['payment_required', "To'lov so'rash"], ['active', 'Darhol yoqish']],
  payment_required: [['active', 'Yoqish']],
  active: [['suspended', "To'xtatish"]],
  suspended: [['active', 'Qayta yoqish']],
};

export function DineInAdminPage() {
  const [tab, setTab] = useState('requests');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [billing, setBilling] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getDineInRequests()
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('dinein:request', load);
    return () => socket.off('dinein:request', load);
  }, [load]);

  const setStatus = async (item, status, label) => {
    const name = item.restaurant?.name || 'Restoran';
    let reason = '';

    if (status === 'suspended') {
      reason = prompt(`${name} — sabab (ixtiyoriy):`) ?? '';
    } else if (!window.confirm(`${name}: ${label}?`)) {
      return;
    }

    setBusy(item._id);
    try {
      await adminApi.setDineInStatus(item.restaurantId, status, reason);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Dine-in</h1>
      <p className="text-sm text-muted mb-5">
        Restoranlarning joyida buyurtma xizmati
      </p>

      <div className="flex gap-2 mb-4 border-b border-line">
        {[['requests', "So'rovlar"], ['tariff', 'Tarif']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k ? 'border-brand-400 text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'tariff' && <Tariff />}

      {tab === 'requests' && (items.length === 0 ? (
        <div className="text-center py-14">
          <i className="ti ti-armchair text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">So'rov yo'q</div>
          <p className="text-sm text-muted mt-1">
            Restoranlar panelidan Dine-in so'rovi yuboradi
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((c) => {
            const st = STATUS[c.status] || STATUS.pending;
            const actions = NEXT[c.status] || [];

            return (
              <div key={c._id} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">
                      {c.restaurant?.name || 'Restoran'}
                    </div>
                    {c.restaurant?.phone && (
                      <div className="text-xs text-muted">{c.restaurant.phone}</div>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-none ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center my-3">
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">Stollar</div>
                    <div className="text-sm font-semibold text-ink">{c.tables}</div>
                  </div>
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">So'rov</div>
                    <div className="text-[11px] text-ink">{fmtDT(c.requestedAt)}</div>
                  </div>
                  <div className="bg-canvas rounded-lg py-2">
                    <div className="text-[10px] text-muted">Yoqilgan</div>
                    <div className="text-[11px] text-ink">{fmtDT(c.activatedAt)}</div>
                  </div>
                </div>

                {c.suspendReason && (
                  <div className="text-xs text-red-600 mb-3">
                    Sabab: {c.suspendReason}
                  </div>
                )}

                <div className="flex gap-2 mb-2">
                  <button onClick={() => setBilling(c)}
                    className="flex-1 border border-line text-muted py-2 rounded-lg text-sm">
                    Qarzdorlik
                  </button>
                </div>

                {actions.length > 0 && (
                  <div className="flex gap-2">
                    {actions.map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => setStatus(c, status, label)}
                        disabled={busy === c._id}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                          status === 'active'
                            ? 'bg-green-500 text-white'
                            : status === 'suspended'
                              ? 'border border-red-200 text-red-600'
                              : 'border border-line text-muted'
                        }`}
                      >
                        {busy === c._id ? '...' : label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {billing && (
        <BillingModal
          restaurantId={billing.restaurantId}
          name={billing.restaurant?.name}
          onClose={() => setBilling(null)}
          onPaid={() => { setBilling(null); load(); }}
        />
      )}
    </div>
  );
}

/* ═══ TARIF ═══ */
function Tariff() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    adminApi.getDineInTariff().then(setForm).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await adminApi.updateDineInTariff({
        price: Number(form.price) || 0,
        billingPeriod: form.billingPeriod,
        trialDays: Number(form.trialDays) || 0,
        activationFee: Number(form.activationFee) || 0,
        commissionPercent: Number(form.commissionPercent) || 0,
        deductFromSettlement: Boolean(form.deductFromSettlement),
      });
      setMsg({ ok: true, text: 'Saqlandi' });
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="max-w-lg space-y-4">
      <section className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-semibold text-ink mb-1">Obuna narxi</h2>
        <p className="text-xs text-muted mb-3">
          Restoranlar Dine-in xizmati uchun to&apos;laydi
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Narx</label>
            <MoneyInput value={form.price} onChange={(v) => set('price', v)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Davr</label>
            <select value={form.billingPeriod}
              onChange={(e) => set('billingPeriod', e.target.value)}
              className="inp">
              <option value="monthly">Oylik (30 kun)</option>
              <option value="daily">Kunlik (24 soat)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">Qo&apos;shimcha</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Sinov muddati
            </label>
            <NumberInput value={form.trialDays} onChange={(v) => set('trialDays', v)}
              suffix="kun" placeholder="14" />
            <p className="text-[11px] text-muted mt-1">
              Shu muddatda hisob yozilmaydi. 0 = sinovsiz
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Ulanish to&apos;lovi
            </label>
            <MoneyInput value={form.activationFee}
              onChange={(v) => set('activationFee', v)} />
            <p className="text-[11px] text-muted mt-1">
              Bir marta olinadi. 0 = bepul
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Buyurtmadan komissiya
            </label>
            <NumberInput value={form.commissionPercent}
              onChange={(v) => set('commissionPercent', v)} suffix="%" />
            <p className="text-[11px] text-muted mt-1">
              Har yakunlangan buyurtmadan. 0 = yo&apos;q
            </p>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm text-ink">Delivery tushumidan ushlab qolish</div>
            <div className="text-xs text-muted mt-0.5">
              Restoranga to&apos;lov qilinganda Dine-in qarzi yechiladi
            </div>
          </div>
          <input type="checkbox" checked={Boolean(form.deductFromSettlement)}
            onChange={(e) => set('deductFromSettlement', e.target.checked)}
            className="w-5 h-5 accent-brand-400 flex-none mt-0.5" />
        </label>
      </section>

      {msg && (
        <div className={`text-sm rounded-lg px-3 py-2 ${
          msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {msg.text}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full bg-brand-400 text-brand-text font-medium py-3 rounded-xl disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}

/* ═══ QARZDORLIK ═══ */
function BillingModal({ restaurantId, name, onClose, onPaid }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  useEffect(() => {
    adminApi.getDineInBilling(restaurantId).then(setData).catch(() => {});
  }, [restaurantId]);

  const pay = async () => {
    if (!window.confirm(`${som(data.debt)} so'm to'langan deb belgilansinmi?`)) return;
    setBusy(true);
    try {
      const r = await adminApi.markDineInPaid(restaurantId);
      alert(r.message);
      onPaid();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto max-h-[88dvh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{name}</h3>
            <p className="text-xs text-muted">Dine-in qarzdorligi</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {!data ? (
          <div className="text-muted text-sm">Yuklanmoqda...</div>
        ) : (
          <>
            <div className="bg-canvas rounded-xl p-4 mb-4 text-center">
              <div className="text-xs text-muted">Joriy qarz</div>
              <div className={`text-2xl font-bold ${data.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {som(data.debt)} so&apos;m
              </div>
              {data.periods > 0 && (
                <div className="text-xs text-muted mt-0.5">{data.periods} ta davr</div>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border border-line rounded-xl mb-4">
              {data.items?.map((b) => (
                <div key={b._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-line last:border-0">
                  <div className="text-xs text-ink">
                    {new Date(b.periodStart).toLocaleDateString('ru-RU')}
                    {b.note && <span className="text-muted"> · {b.note}</span>}
                  </div>
                  <div className="text-right flex-none">
                    <div className="text-sm font-medium text-ink">{som(b.amount)}</div>
                    <div className={`text-[10px] font-medium ${
                      b.status === 'paid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {b.status === 'paid' ? "TO'LANGAN" : "TO'LANMAGAN"}
                    </div>
                  </div>
                </div>
              ))}
              {(!data.items || data.items.length === 0) && (
                <div className="text-sm text-muted p-4 text-center">Yozuv yo&apos;q</div>
              )}
            </div>

            {data.debt > 0 && (
              <button onClick={pay} disabled={busy}
                className="w-full bg-green-500 text-white font-medium py-3 rounded-xl disabled:opacity-50">
                {busy ? '...' : "To'landi deb belgilash"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
