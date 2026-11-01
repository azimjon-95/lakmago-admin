import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';

const STATUS = {
  SENT: { label: 'Yuborildi', cls: 'bg-blue-50 text-blue-700' },
  RECEIVED: { label: 'Telefonga yetdi', cls: 'bg-emerald-50 text-emerald-700' },
  OPENED: { label: 'Ochildi', cls: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Xato', cls: 'bg-red-50 text-red-700' },
};
const TYPE = { NEW_ORDER: 'Yangi buyurtma', ORDER_UPDATED: 'Signal to‘xtatildi', ORDER_CANCELLED: 'Bekor qilindi' };
const fmt = (d) => (d ? new Date(d).toLocaleString('uz-UZ', { hour12: false }) : '—');

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
      <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/**
 * Restoran xodimlari telefoniga yangi buyurtma bildirishnomasi: ovoz, tebranish, takror (interval / limit), ovoz turi,
 * test push, qurilmalar va oxirgi yuborishlar jurnali. Server: /api/panel/notification-settings, /devices, /devices/test, /notifications/recent.
 */
export function NotificationSettingsPage() {
  const [cfg, setCfg] = useState(null);
  const [devices, setDevices] = useState({ providers: {}, check: {}, devices: [] });
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    panelApi.getNotifySettings().then(setCfg).catch(() => {});
    panelApi.getDevices().then((d) => setDevices(d || { providers: {}, check: {}, devices: [] })).catch(() => {});
    panelApi.getNotificationLog().then((l) => setLogs(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const { sound, vibration, repeatEnabled, repeatIntervalSec, repeatLimit, soundType } = cfg;
      setCfg(await panelApi.saveNotifySettings({ sound, vibration, repeatEnabled, repeatIntervalSec: Number(repeatIntervalSec), repeatLimit: Number(repeatLimit), soundType }));
      setMsg({ ok: true, text: 'Saqlandi. Yangi kelgan buyurtmalarga amal qiladi.' });
    } catch (e) { setMsg({ ok: false, text: e?.message || 'Saqlab bo‘lmadi' }); }
    setSaving(false);
  };

  const sendTest = async () => {
    setTesting(true); setTest(null);
    try { setTest(await panelApi.testPush()); } catch (e) { setTest({ error: e?.message || 'Yuborib bo‘lmadi' }); }
    setTesting(false);
  };

  if (!cfg) return <div className="p-6 text-gray-500">Yuklanmoqda…</div>;
  const none = devices.devices.length === 0;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bildirishnomalar</h1>
        <p className="text-sm text-gray-500 mt-1">Yangi buyurtma xodimlar telefoniga ilova yopiq yoki telefon bloklangan bo‘lsa ham ovozli xabar bilan keladi.</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Yangi buyurtma signali</h2>
        <div className="divide-y divide-gray-100">
          <Switch checked={cfg.sound} onChange={set('sound')} label="Ovoz" hint="O‘chiq bo‘lsa xabar ovozsiz keladi" />
          <Switch checked={cfg.vibration} onChange={set('vibration')} label="Tebranish" />
          <Switch checked={cfg.repeatEnabled} onChange={set('repeatEnabled')} label="Qayta eslatish" hint="Buyurtma qabul qilinmaguncha xabar qayta yuboriladi" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Eslatish oralig‘i</span>
            <select disabled={!cfg.repeatEnabled} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" value={cfg.repeatIntervalSec} onChange={(e) => set('repeatIntervalSec')(Number(e.target.value))}>
              {[30, 60, 90].map((s) => <option key={s} value={s}>{s} soniya</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Jami yuborishlar (1–20)</span>
            <input type="number" min={1} max={20} disabled={!cfg.repeatEnabled} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" value={cfg.repeatLimit} onChange={(e) => set('repeatLimit')(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Ovoz turi (iPhone)</span>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={cfg.soundType} onChange={(e) => set('soundType')(e.target.value)}>
              <option value="custom">LokmaGo melodiyasi</option>
              <option value="default">Tizim ovozi</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-3">Birinchi xabar buyurtma kelishi bilan ketadi, so‘ng har {cfg.repeatIntervalSec} soniyada, jami {cfg.repeatLimit} martagacha — buyurtma qabul qilinsa yoki bekor bo‘lsa to‘xtaydi. Android’da ovoz turi kanal sozlamasi bilan belgilanadi.</p>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-60">{saving ? 'Saqlanmoqda…' : 'Saqlash'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Qurilmalar</h2>
            <p className="text-xs text-gray-500">Server: Android {devices.check?.android ?? '—'} · iPhone {devices.check?.ios ?? '—'}</p>
          </div>
          <button onClick={sendTest} disabled={testing || none} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50">{testing ? 'Yuborilmoqda…' : 'Test xabar yuborish'}</button>
        </div>
        {none ? <p className="text-sm text-gray-500">Hali birorta telefon ro‘yxatdan o‘tmagan. Ilovaga kiring (Profil → Push tekshiruvi).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">Telefon</th><th className="pr-3">Versiya</th><th className="pr-3">Ruxsat</th><th className="pr-3">Oxirgi faollik</th><th className="pr-3">Oxirgi yuborish</th><th>Xato</th></tr></thead>
            <tbody>{devices.devices.map((d, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-3">{d.platform === 'ios' ? 'iPhone' : 'Android'} <span className="text-gray-400">{d.token}</span>{d.environment ? <span className="ml-1 text-xs text-gray-400">({d.environment})</span> : null}</td>
                <td className="pr-3">{d.appVersion || '—'}</td>
                <td className="pr-3">{d.notificationsEnabled === false ? <span className="text-red-600">O‘chiq</span> : d.notificationsEnabled ? <span className="text-emerald-700">Yoqilgan</span> : '—'}</td>
                <td className="pr-3">{fmt(d.lastSeen)}</td><td className="pr-3">{fmt(d.lastSentAt)}</td>
                <td className="text-red-600 text-xs">{d.lastError || ''}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {test && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm space-y-1">
            {test.error ? <div className="text-red-600">{test.error}</div> : (test.results || []).map((r, i) => (
              <div key={i} className={r.ok ? 'text-emerald-700' : 'text-red-600'}>{r.platform === 'ios' ? 'iPhone' : 'Android'} {r.token}: {r.ok ? 'yuborildi — telefonga xabar kelishi kerak' : r.error}</div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Oxirgi yuborishlar</h2>
          <button onClick={load} className="text-sm text-gray-500 hover:text-gray-800">Yangilash</button>
        </div>
        {logs.length === 0 ? <p className="text-sm text-gray-500">Hali yuborish bo‘lmagan.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">Vaqt</th><th className="pr-3">Tur</th><th className="pr-3">Urinish</th><th className="pr-3">Qurilma</th><th className="pr-3">Holat</th><th>Sabab</th></tr></thead>
            <tbody>{logs.map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-3 whitespace-nowrap">{fmt(l.sentAt)}</td><td className="pr-3">{TYPE[l.type] || l.type}</td><td className="pr-3">{l.type === 'NEW_ORDER' ? l.attempt : '—'}</td>
                <td className="pr-3">{l.platform === 'ios' ? 'iPhone' : 'Android'}</td>
                <td className="pr-3"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS[l.status]?.cls || ''}`}>{STATUS[l.status]?.label || l.status}</span></td>
                <td className="text-red-600 text-xs">{l.error}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        <p className="text-xs text-gray-500 mt-3">«Yuborildi» — Apple/Google qabul qildi. «Telefonga yetdi» (Android) va «Ochildi» ilovadan tasdiq keladi. iPhone’da ilova ochilmaguncha tasdiq yo‘q — bu normal.</p>
      </section>
    </div>
  );
}
