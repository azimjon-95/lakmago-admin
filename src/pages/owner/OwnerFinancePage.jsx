import { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '@/api';
import { MoneyInput } from '@/components/form/NumberInput';
import { confirm } from '@/components/ui/confirm';
import { PageHeader, ErrorBox, Empty, Modal, Field, som, thisMonth, todayIso } from '@/pages/wedding/common';

/*
 * KIRIM-CHIQIM: oy bo'yicha jami (bron to'lovlari + boshqa kirim − xarajatlar),
 * xarajatlar kategoriya bo'yicha, yozuvlar ro'yxati, tez qo'shish.
 */
export const INCOME_CAT = { bron: 'Bron (qo‘shimcha)', xizmat: 'Xizmat', ijara: 'Ijara', boshqa_kirim: 'Boshqa kirim' };
export const EXPENSE_CAT = {
  ish_haqi: 'Ish haqi', oziq_ovqat: 'Oziq-ovqat', kommunal: 'Kommunal', soliq: 'Soliq', kredit: 'Kredit',
  ijara_tolov: 'Ijara to‘lovi', tamir: 'Ta’mir', jihoz: 'Jihoz', reklama: 'Reklama', transport: 'Transport', boshqa: 'Boshqa',
};
const METHOD = { cash: 'Naqd', card: 'Karta', transfer: 'Hisob raqamiga', click: 'Click', payme: 'Payme', other: 'Boshqa' };

export function OwnerFinancePage() {
  const [month, setMonth] = useState(thisMonth());
  const [sum, setSum] = useState(null);
  const [list, setList] = useState([]);
  const [type, setType] = useState('');
  const [err, setErr] = useState(null);
  const [add, setAdd] = useState(null); // 'income' | 'expense'

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, l] = await Promise.all([ownerApi.financeSummary(month), ownerApi.transactions({ month, type: type || undefined })]);
      setSum(s); setList(l);
    } catch (e) { setErr(e.message); }
  }, [month, type]);
  useEffect(() => { load(); }, [load]);

  const remove = async (t) => {
    if (!await confirm({ title: `${som(t.amount)} so'mlik yozuv o'chirilsinmi?`, tone: 'danger' })) return;
    try { await ownerApi.deleteTransaction(t._id); load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="flex-1 p-3 sm:p-6 min-w-0">
      <PageHeader title="Kirim-chiqim">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} className="inp !w-auto" />
      </PageHeader>
      <ErrorBox error={err} onRetry={load} />

      {sum && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <Stat label="Kirim" value={sum.income.total} tone="text-green-700" sub={`bronlardan ${som(sum.income.reservations)}`} />
          <Stat label="Chiqim" value={sum.expense.total} tone="text-red-600" />
          <Stat label="Sof foyda" value={sum.net} tone={sum.net >= 0 ? 'text-ink' : 'text-red-600'} />
          <Stat label="Tadbirlar" value={sum.events.count} plain sub={`kelishilgan ${som(sum.events.contracted)}`} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setAdd('income')} className="rounded-xl bg-green-600 text-white py-3 font-semibold"><i className="ti ti-plus" /> Kirim</button>
        <button onClick={() => setAdd('expense')} className="rounded-xl bg-red-500 text-white py-3 font-semibold"><i className="ti ti-minus" /> Chiqim</button>
      </div>

      {sum && Object.keys(sum.expense.by_category).length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-3 mb-4">
          <div className="text-sm font-semibold text-ink mb-2">Xarajatlar</div>
          {Object.entries(sum.expense.by_category).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="mb-1.5">
              <div className="flex justify-between text-sm"><span className="text-muted">{EXPENSE_CAT[k] || k}</span><span className="font-medium">{som(v)}</span></div>
              <div className="h-1.5 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-red-400" style={{ width: `${Math.max(3, (v / sum.expense.total) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1 mb-2">
        {[['', 'Hammasi'], ['income', 'Kirim'], ['expense', 'Chiqim']].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className={`rounded-lg py-1.5 text-xs font-medium ${type === k ? 'bg-brand-400 text-brand-text' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? <Empty icon="ti-receipt-off">Yozuv yo'q</Empty> : (
        <div className="divide-y divide-line border border-line rounded-xl bg-surface">
          {list.map((t) => (
            <div key={t._id} className="flex items-center gap-3 px-3 py-2.5">
              <i className={`ti ${t.type === 'income' ? 'ti-arrow-down-left text-green-600' : 'ti-arrow-up-right text-red-500'} text-lg`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">
                  {(t.type === 'income' ? INCOME_CAT : EXPENSE_CAT)[t.category] || t.category}{t.employee_name && ` · ${t.employee_name}`}
                </div>
                <div className="text-xs text-muted truncate">{t.date.split('-').reverse().join('.')} · {METHOD[t.method]}{t.note && ` · ${t.note}`}</div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '−'}{som(t.amount)}</div>
              <button onClick={() => remove(t)} className="w-8 h-8 text-muted" aria-label="O'chirish"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}

      {add && <TransactionModal type={add} onClose={() => setAdd(null)} onSaved={() => { setAdd(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink', sub, plain }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{plain ? value : som(value)}</div>
      {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
    </div>
  );
}

export function TransactionModal({ type, employee, onClose, onSaved }) {
  const cats = type === 'income' ? INCOME_CAT : EXPENSE_CAT;
  const [f, setF] = useState({
    category: employee ? 'ish_haqi' : Object.keys(cats)[0], amount: employee?.rate || null,
    date: todayIso(), method: 'cash', note: '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!(f.amount > 0)) { setErr('Summani kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      await ownerApi.addTransaction({ type, ...f, amount: Number(f.amount), note: f.note.trim(), ...(employee ? { employee_id: employee._id } : {}) });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };
  return (
    <Modal title={employee ? `${employee.name}: ish haqi` : type === 'income' ? 'Kirim qo‘shish' : 'Chiqim qo‘shish'} onClose={onClose} footer={(
      <>
        <button onClick={onClose} className="px-4 py-2.5 border border-line text-muted rounded-xl">Bekor</button>
        <button onClick={save} disabled={saving} className={`flex-1 font-semibold py-2.5 rounded-xl text-white disabled:opacity-50 ${type === 'income' ? 'bg-green-600' : 'bg-red-500'}`}>
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </>
    )}>
      {!employee && (
        <Field label="Kategoriya">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(cats).map(([k, l]) => (
              <button key={k} type="button" onClick={() => set('category', k)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${f.category === k ? 'border-brand-400 bg-brand-100 text-brand-text' : 'border-line text-muted'}`}>{l}</button>
            ))}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Summa (so'm)"><MoneyInput value={f.amount} onChange={(v) => set('amount', v)} /></Field>
        <Field label="Sana"><input className="inp" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
      </div>
      <Field label="Usul">
        <select className="inp" value={f.method} onChange={(e) => set('method', e.target.value)}>
          {Object.entries(METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Izoh"><input className="inp" value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={300} placeholder={employee ? 'Qaysi davr uchun' : ''} /></Field>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
    </Modal>
  );
}
