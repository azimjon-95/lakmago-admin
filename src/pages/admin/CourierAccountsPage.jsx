import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

const VEHICLES = { '': '—', scooter: 'Skuter', bike: 'Velosiped', car: 'Mashina', foot: 'Piyoda' };
const fmt = (d) => (d ? new Date(d).toLocaleString('uz-UZ', { hour12: false }) : '—');

/**
 * Kuryer akkauntlari — mobil ilovadagi «Kuryer» bo'limiga login/parol bilan kiradigan ishchi kuryerlar (BOSQICH 2).
 * (Telegram/havola orqali ishlovchi kuryerlar ro'yxati — «Kuryerlar» sahifasida, o'zgarmagan.)
 * Parol hech qachon ko'rsatilmaydi va saqlanmaydi; yo'qotilsa «Parolni tiklash» yangisini o'rnatadi.
 */
export function CourierAccountsPage() {
  const [data, setData] = useState({ onlineNow: 0, couriers: [] });
  const [form, setForm] = useState({ login: '', password: '', name: '', phone: '', vehicle: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { adminApi.getCourierAccounts().then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await adminApi.createCourierAccount({ ...form, phone: form.phone || undefined });
      setForm({ login: '', password: '', name: '', phone: '', vehicle: '' });
      setMsg({ ok: true, text: 'Kuryer akkaunti yaratildi. Login va parolni kuryerga o‘zingiz bering.' });
      load();
    } catch (err) { setMsg({ ok: false, text: err?.message || 'Yaratib bo‘lmadi' }); }
    setSaving(false);
  };
  const toggle = async (c) => { await adminApi.updateCourierAccount(c.id, { isActive: !c.isActive }).catch(() => {}); load(); };
  const reset = async (c) => {
    const pw = window.prompt(`${c.name}: yangi parol (kamida 8 belgi)`);
    if (!pw) return;
    try { await adminApi.updateCourierAccount(c.id, { password: pw }); setMsg({ ok: true, text: 'Parol yangilandi.' }); }
    catch (err) { setMsg({ ok: false, text: err?.message || 'Parol yangilanmadi' }); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Kuryer akkauntlari</h1>
          <p className="text-sm text-gray-500 mt-1">Mobil ilovadagi «Kuryer» bo‘limiga login/parol bilan kiradigan kuryerlar.</p>
        </div>
        <div className="text-sm text-gray-600">Hozir smenada: <b className="text-emerald-700">{data.onlineNow}</b></div>
      </div>

      <form onSubmit={create} className="bg-white rounded-2xl border border-gray-200 p-5 grid sm:grid-cols-2 gap-3">
        <h2 className="sm:col-span-2 font-semibold text-gray-900">Yangi kuryer</h2>
        <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Login (kamida 3 belgi)" value={form.login} onChange={set('login')} required minLength={3} autoComplete="off" />
        <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Parol (kamida 8 belgi)" value={form.password} onChange={set('password')} required minLength={8} type="text" autoComplete="off" />
        <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Ism familiya" value={form.name} onChange={set('name')} required minLength={2} />
        <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Telefon (+998…)" value={form.phone} onChange={set('phone')} />
        <select className="rounded-lg border border-gray-300 px-3 py-2" value={form.vehicle} onChange={set('vehicle')}>
          {Object.entries(VEHICLES).map(([k, v]) => <option key={k} value={k}>{k ? v : 'Transport turi'}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <button disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-60">{saving ? 'Yaratilmoqda…' : 'Yaratish'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="p-3">Kuryer</th><th>Login</th><th>Transport</th><th>Holat</th><th>Oxirgi kirish</th><th /></tr></thead>
          <tbody>
            {data.couriers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Hali kuryer akkaunti yo‘q.</td></tr>}
            {data.couriers.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="p-3"><div className="font-medium text-gray-900">{c.name}</div><div className="text-xs text-gray-500">{c.phone || '—'}</div></td>
                <td>{c.login}</td><td>{VEHICLES[c.vehicle] || '—'}</td>
                <td>{!c.isActive ? <span className="text-red-600">Bloklangan</span> : c.onShift ? <span className="text-emerald-700">Smenada</span> : <span className="text-gray-500">Smenada emas</span>}</td>
                <td className="whitespace-nowrap">{fmt(c.lastLoginAt)}</td>
                <td className="text-right whitespace-nowrap p-3">
                  <button onClick={() => reset(c)} className="text-gray-600 hover:text-gray-900 mr-3">Parolni tiklash</button>
                  <button onClick={() => toggle(c)} className={c.isActive ? 'text-red-600' : 'text-emerald-700'}>{c.isActive ? 'Bloklash' : 'Faollashtirish'}</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
