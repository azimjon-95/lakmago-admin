import { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { PageHeader, ErrorBox, Empty, Modal, Field, Badge, som } from '@/pages/wedding/common';
import { TransactionModal } from './OwnerFinancePage';

/* ISHCHILAR: kunlik / oylik / tadbir boshiga haq; shu oy berilgan; ish haqi berish (chiqimga yoziladi) */
const PAY_TYPE = { daily: 'Kunlik', monthly: 'Oylik', per_event: 'Tadbir boshiga' };

export function OwnerEmployeesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try { setList(await ownerApi.employees()); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = list.filter((e) => showInactive || e.active);
  const monthTotal = list.reduce((s, e) => s + (e.paid_this_month || 0), 0);

  return (
    <div className="flex-1 p-3 sm:p-6 min-w-0">
      <PageHeader title="Ishchilar" subtitle={`Shu oy berildi: ${som(monthTotal)} so'm`}>
        <button onClick={() => setForm({})} className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl"><i className="ti ti-plus" /> Ishchi</button>
      </PageHeader>
      <ErrorBox error={err} onRetry={load} />
      <label className="flex items-center gap-2 text-xs text-muted mb-3">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ishdan ketganlarni ham ko'rsatish
      </label>
      {loading ? <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
        : shown.length === 0 ? <Empty icon="ti-users">Ishchi yo'q</Empty> : (
          <div className="grid gap-2 lg:grid-cols-2">
            {shown.map((e) => (
              <div key={e._id} className={`bg-surface border border-line rounded-xl p-3 ${e.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink flex items-center gap-1.5 flex-wrap">
                      {e.name} {!e.active && <Badge cls="bg-canvas text-muted">Ketgan</Badge>}
                    </div>
                    <div className="text-xs text-muted">{[e.position, e.phone].filter(Boolean).join(' · ') || '—'}</div>
                    <div className="text-xs text-muted mt-0.5">{PAY_TYPE[e.pay_type]}: <b className="text-ink">{som(e.rate)} so'm</b></div>
                  </div>
                  <div className="text-right flex-none">
                    <div className="text-[11px] text-muted">shu oy</div>
                    <div className="font-semibold text-ink tabular-nums">{som(e.paid_this_month)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  {e.active && <button onClick={() => setPayFor(e)} className="flex-1 rounded-lg bg-green-600 text-white py-2 text-sm font-medium"><i className="ti ti-cash" /> Ish haqi berish</button>}
                  {e.phone && <a href={`tel:${e.phone}`} className="w-10 rounded-lg border border-line flex items-center justify-center" aria-label="Qo'ng'iroq"><i className="ti ti-phone" /></a>}
                  <button onClick={() => setForm({ e })} className="w-10 rounded-lg border border-line" aria-label="Tahrirlash"><i className="ti ti-pencil" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      {form && <EmployeeForm employee={form.e} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {payFor && <TransactionModal type="expense" employee={payFor} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function EmployeeForm({ employee, onClose, onSaved }) {
  const [f, setF] = useState({
    name: employee?.name || '', phone: employee?.phone || '', position: employee?.position || '',
    pay_type: employee?.pay_type || 'monthly', rate: employee?.rate ?? null, hired_at: employee?.hired_at || '',
    note: employee?.note || '', active: employee?.active ?? true,
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (f.name.trim().length < 2) { setErr('Ismini kiriting'); return; }
    setSaving(true); setErr(null);
    const body = { ...f, name: f.name.trim(), rate: Number(f.rate) || 0 };
    try {
      if (employee) await ownerApi.updateEmployee(employee._id, body); else await ownerApi.addEmployee(body);
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };
  return (
    <Modal title={employee ? 'Ishchini tahrirlash' : 'Yangi ishchi'} onClose={onClose} footer={(
      <>
        <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl">Bekor</button>
        <button onClick={save} disabled={saving} className="flex-1 bg-brand-400 text-brand-text font-semibold py-2.5 rounded-xl disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </>
    )}>
      <Field label="Ism *"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lavozim"><input className="inp" value={f.position} onChange={(e) => set('position', e.target.value)} placeholder="Ofitsiant, oshpaz..." /></Field>
        <Field label="Telefon"><input className="inp" value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" /></Field>
      </div>
      <Field label="Haq turi">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
          {Object.entries(PAY_TYPE).map(([k, l]) => (
            <button key={k} type="button" onClick={() => set('pay_type', k)} className={`rounded-lg py-2 text-xs font-semibold ${f.pay_type === k ? 'bg-white shadow-sm text-ink' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stavka (so'm)"><MoneyInput value={f.rate} onChange={(v) => set('rate', v)} /></Field>
        <Field label="Ishga kirgan"><input className="inp" type="date" value={f.hired_at} onChange={(e) => set('hired_at', e.target.value)} /></Field>
      </div>
      <Field label="Izoh"><input className="inp" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
      {employee && (
        <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Ishlayapti</label>
      )}
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
    </Modal>
  );
}
