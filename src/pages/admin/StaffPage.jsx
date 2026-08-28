import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';

/**
 * Xodimlar (LokmaGo jamoasi) — yollash va boshqarish.
 *
 * FAQAT admin ko'radi va kira oladi (sidebar + route + server —
 * uch qatlamli himoya). Xodimning o'zi bu sahifani ko'rmaydi.
 */
export function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    login: '', password: '', fullName: '', department: '', phone: '', note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        adminApi.getStaff(),
        adminApi.getStaffDepartments(),
      ]);
      setStaff(s);
      setDepartments(d);
      if (!form.department && d.length) setForm((f) => ({ ...f, department: d[0].value }));
    } catch { /* ignore */ }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError('');
    if (!form.login.trim() || !form.password || !form.fullName.trim() || !form.department) {
      setError('Login, parol, ism va bo‘lim to‘ldirilishi shart');
      return;
    }
    if (form.password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo‘lishi kerak');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createStaff({
        login: form.login.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        department: form.department,
        phone: form.phone.trim(),
        note: form.note.trim(),
      });
      setForm({ login: '', password: '', fullName: '', department: departments[0]?.value || '', phone: '', note: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const toggleActive = async (member) => {
    await adminApi.updateStaff(member._id, { isActive: !member.isActive });
    load();
  };

  const resetPassword = async (member) => {
    const password = await confirm({
      title: `${member.fullName} — yangi parol`,
      content: 'Kamida 6 ta belgi. Xodimga shu parolni siz aytasiz.',
      input: true,
      inputPlaceholder: 'Yangi parol',
      okText: 'O‘rnatish',
      tone: 'warning',
    });
    if (!password) return;
    if (password.length < 6) { alert('Parol kamida 6 ta belgi bo‘lishi kerak'); return; }
    await adminApi.updateStaff(member._id, { password });
    alert('Parol yangilandi');
  };

  const remove = async (member) => {
    const ok = await confirm({
      title: 'Ishdan bo‘shatilsinmi?',
      content: `${member.fullName} (${member.login}) tizimga kira olmay qoladi. Bu amalni qaytarib bo‘lmaydi.`,
      tone: 'danger',
      okText: 'Bo‘shatish',
    });
    if (!ok) return;
    await adminApi.deleteStaff(member._id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Xodimlar</h1>
          <p className="text-sm text-muted">LokmaGo jamoasi — yollash, bo'lim tayinlash, huquqlar</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text"
        >
          + Xodim yollash
        </button>
      </div>

      {showForm && (
        <div className="my-4 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="To'liq ism" value={form.fullName}
              onChange={(v) => setForm((f) => ({ ...f, fullName: v }))} placeholder="Aliyev Vali" />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Bo'lim</label>
              <select
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
              >
                {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <TextField label="Login" value={form.login}
              onChange={(v) => setForm((f) => ({ ...f, login: v }))} placeholder="buxgalter1" />
            <TextField label="Parol" value={form.password} type="password"
              onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="kamida 6 ta belgi" />
            <TextField label="Telefon" value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+998..." />
            <TextField label="Izoh" value={form.note}
              onChange={(v) => setForm((f) => ({ ...f, note: v }))} placeholder="ixtiyoriy" />
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-line py-2 text-sm sm:flex-none sm:px-6">
              Bekor
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand-400 py-2 text-sm font-semibold text-brand-text disabled:opacity-50 sm:flex-none sm:px-6"
            >
              {saving ? '...' : 'Yollash'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : staff.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">Hozircha xodim yo'q</div>
      ) : (
        <>
          {/* ── Desktop: jadval ── */}
          <div className="hidden overflow-x-auto rounded-xl border border-line sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2.5">Ism</th>
                  <th className="px-3 py-2.5">Login</th>
                  <th className="px-3 py-2.5">Bo'lim</th>
                  <th className="px-3 py-2.5">Telefon</th>
                  <th className="px-3 py-2.5">Holat</th>
                  <th className="px-3 py-2.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((m) => (
                  <tr key={m._id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-ink">{m.fullName}</td>
                    <td className="px-3 py-2.5 text-muted">{m.login}</td>
                    <td className="px-3 py-2.5">{m.departmentLabel}</td>
                    <td className="px-3 py-2.5 text-muted">{m.phone || '—'}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleActive(m)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {m.isActive ? 'Faol' : 'Bloklangan'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => resetPassword(m)} title="Parolni tiklash"
                          className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">
                          <i className="ti ti-key text-base" />
                        </button>
                        <button onClick={() => remove(m)} title="Bo'shatish"
                          className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                          <i className="ti ti-trash text-base" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobil: kartalar ── */}
          <div className="space-y-2.5 sm:hidden">
            {staff.map((m) => (
              <div key={m._id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="mb-1.5 flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-ink">{m.fullName}</div>
                    <div className="text-xs text-muted">{m.login}</div>
                  </div>
                  <button
                    onClick={() => toggleActive(m)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {m.isActive ? 'Faol' : 'Bloklangan'}
                  </button>
                </div>
                <div className="text-sm text-ink">{m.departmentLabel}</div>
                {m.phone && <div className="text-xs text-muted">{m.phone}</div>}
                <div className="mt-2.5 flex gap-2 border-t border-line pt-2.5">
                  <button onClick={() => resetPassword(m)}
                    className="flex-1 rounded-lg border border-line py-1.5 text-xs font-medium text-ink">
                    Parol tiklash
                  </button>
                  <button onClick={() => remove(m)}
                    className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600">
                    Bo'shatish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
      />
    </div>
  );
}
