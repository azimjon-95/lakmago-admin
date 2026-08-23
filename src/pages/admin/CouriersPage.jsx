import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';
import { confirm } from '@/components/ui/confirm';

/**
 * Kuryerlar ro'yxati — LokmaGo admin tomonidan boshqariladi.
 *
 * Har bir kuryer uchun ENG MUHIM maydon — telegramChatId. Shu
 * ID orqali buyurtma havolasi yuboriladi. Kuryer botga /start
 * bosib o'z chat ID sini olishi, so'ng buni administratorga
 * (yoki bu yerga qo'lda) berishi kerak.
 */
export function CouriersPage() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCouriers(await adminApi.getCouriers()); } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (c) => {
    await adminApi.updateCourier(c._id, { isActive: !c.isActive });
    load();
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Kuryer o\u2018chirilsinmi?',
      content: `${c.name} ro\u2018yxatdan butunlay olib tashlanadi.`,
      tone: 'danger', okText: 'O\u2018chirish',
    });
    if (!ok) return;
    await adminApi.deleteCourier(c._id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Kuryerlar</h1>
          <p className="text-sm text-muted">Buyurtmalarni yetkazish uchun kuryerlar ro'yxati</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-text"
        >
          + Kuryer qo'shish
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : couriers.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">Hozircha kuryer yo'q</div>
      ) : (
        <div className="space-y-2">
          {couriers.map((c) => (
            <div key={c._id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-600">
                {c.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                <div className="truncate text-xs text-muted">
                  {c.phone || 'Telefon yo\u2018q'} {'\u00b7'} chat ID: {c.telegramChatId}
                  {c.totalDeliveries > 0 && ` \u00b7 ${c.totalDeliveries} ta yetkazgan`}
                </div>
              </div>
              <button
                onClick={() => toggleActive(c)}
                className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  c.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}
              >
                {c.isActive ? 'Faol' : 'Nofaol'}
              </button>
              <button onClick={() => { setEditing(c); setShowForm(true); }}
                className="flex-none rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">
                <i className="ti ti-pencil text-base" />
              </button>
              <button onClick={() => remove(c)}
                className="flex-none rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CourierForm
          courier={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function CourierForm({ courier, onClose, onSaved }) {
  const [name, setName] = useState(courier?.name || '');
  const [phone, setPhone] = useState(courier?.phone || '');
  const [telegramChatId, setTelegramChatId] = useState(courier?.telegramChatId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!name.trim()) { setError('Ism kiritilishi shart'); return; }
    if (!telegramChatId.trim()) { setError('Telegram chat ID kiritilishi shart'); return; }

    setSaving(true);
    try {
      const data = { name: name.trim(), phone: phone.trim(), telegramChatId: telegramChatId.trim() };
      if (courier) await adminApi.updateCourier(courier._id, data);
      else await adminApi.createCourier(data);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {courier ? 'Kuryerni tahrirlash' : 'Yangi kuryer'}
        </h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-ink">Ism</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Aliyev Vali"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-ink">Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+998..."
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" />
        </div>

        <div className="mb-1">
          <label className="mb-1 block text-xs font-medium text-ink">Telegram chat ID</label>
          <input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="123456789"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" />
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-muted">
          Kuryer @userinfobot ga /start bosib o'z ID sini bilib olishi mumkin.
          Buyurtma havolasi shu ID ga yuboriladi.
        </p>

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm">
            Bekor
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 rounded-lg bg-brand-400 py-2 text-sm font-semibold text-brand-text disabled:opacity-50">
            {saving ? '...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
