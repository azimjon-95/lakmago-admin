import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { ImageUpload } from '@/components/ImageUpload';
import { useLockScroll } from '@/hooks/useLockScroll';
import { getSocket } from '@/lib/socket';

const STATUS = {
  none: { label: 'Yoqilmagan', cls: 'bg-canvas text-muted' },
  pending: { label: "Ko'rib chiqilmoqda", cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-blue-50 text-blue-700' },
  payment_required: { label: "To'lov kutilmoqda", cls: 'bg-amber-50 text-amber-700' },
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  suspended: { label: "To'xtatilgan", cls: 'bg-red-50 text-red-600' },
};

const TABLE_STATUS = {
  available: { label: "Bo'sh", cls: 'bg-green-50 text-green-700' },
  occupied: { label: 'Band', cls: 'bg-amber-50 text-amber-700' },
  ordering: { label: 'Tanlamoqda', cls: 'bg-blue-50 text-blue-700' },
  waiting: { label: 'Kutmoqda', cls: 'bg-violet-50 text-violet-700' },
  closed: { label: 'Yopiq', cls: 'bg-canvas text-muted' },
};

export function DineInPage() {
  const [tab, setTab] = useState('tables');
  const [cfg, setCfg] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await panelApi.getDineInConfig();
      setCfg(c);
      if (c.status === 'active') {
        setTables(await panelApi.getTables());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('table:update', load);
    socket.on('dinein:status', load);
    return () => {
      socket.off('table:update', load);
      socket.off('dinein:status', load);
    };
  }, [load]);

  const request = async () => {
    if (!window.confirm('Dine-in xizmatini yoqish uchun so\'rov yuborilsinmi?')) return;
    try { await panelApi.requestDineIn(); load(); }
    catch (e) { alert(e.message); }
  };

  const removeTable = async (t) => {
    if (!window.confirm(`Stol ${t.tableNumber} o'chirilsinmi?`)) return;
    try { await panelApi.deleteTable(t._id); load(); }
    catch (e) { alert(e.message); }
  };

  const regenerate = async (t) => {
    if (!window.confirm(
      `Stol ${t.tableNumber} QR kodi yangilanadi.\n\n` +
      'Eski QR ISHLAMAY QOLADI — yangisini chop etish kerak.\n\nDavom etilsinmi?',
    )) return;
    try { await panelApi.regenerateQr(t._id); load(); }
    catch (e) { alert(e.message); }
  };

  // Yuklab olish — window.open ishlatib bo'lmaydi, chunki
  // Authorization sarlavhasi yuborilmaydi. Shuning uchun
  // fetch bilan olib blob sifatida saqlaymiz.
  const download = async (url, filename) => {
    try {
      const blob = await panelApi.downloadFile(url);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      alert(e.message || 'Yuklab bo\u2018lmadi');
    }
  };

  const downloadQr = (t, format) =>
    download(`/panel/tables/${t._id}/qr?format=${format}`,
      `stol-${t.tableNumber}.${format}`);

  const downloadPdf = () =>
    download('/panel/tables/qr/pdf', 'qr-kodlar.pdf');

  if (loading) return <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>;

  const st = STATUS[cfg?.status || 'none'];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Dine-in</h1>
      <p className="text-sm text-muted mb-5">
        Stollar, QR kodlar va joyida buyurtma
      </p>

      {/* Holat */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-medium text-ink">Xizmat holati</div>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${st.cls}`}>
            {st.label}
          </span>
        </div>

        {cfg?.status === 'none' && (
          <>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Dine-in yoqilsa mijozlar stoldagi QR kodni skanerlab
              menyuni ochadi va joyidan buyurtma beradi.
            </p>
            <button onClick={request}
              className="w-full bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl">
              So'rov yuborish
            </button>
          </>
        )}

        {cfg?.status === 'pending' && (
          <p className="text-xs text-muted">
            So'rovingiz ko'rib chiqilmoqda. Tasdiqlangach xabar beramiz.
          </p>
        )}

        {['approved', 'payment_required'].includes(cfg?.status) && (
          <p className="text-xs text-amber-700">
            Tasdiqlandi. Xizmatni yoqish uchun administrator bilan
            bog'laning.
          </p>
        )}

        {cfg?.status === 'suspended' && (
          <p className="text-xs text-red-600">
            {cfg.suspendReason || 'Xizmat vaqtincha to\'xtatilgan'}
          </p>
        )}

        {cfg?.status === 'active' && (
          <div className="flex items-center gap-4 text-xs text-muted mt-1">
            <span>{cfg.tables} ta stol</span>
            {cfg.activeSessions > 0 && (
              <span className="text-green-600 font-medium">
                {cfg.activeSessions} ta faol sessiya
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bo'limlar */}
      {cfg?.status === 'active' && (
        <div className="flex gap-2 mb-4 border-b border-line overflow-x-auto">
          {[
            ['tables', 'Stollar'],
            ['waiters', 'Ofitsiantlar'],
            ['earnings', 'Daromad'],
            ['settings', 'Xizmat haqi'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === k ? 'border-brand-400 text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {cfg?.status === 'active' && tab === 'waiters' && <Waiters tables={tables} />}
      {cfg?.status === 'active' && tab === 'earnings' && <Earnings />}
      {cfg?.status === 'active' && tab === 'settings' && (
        <ServiceFee cfg={cfg} onSaved={load} />
      )}

      {/* Stollar */}
      {cfg?.status === 'active' && tab === 'tables' && (
        <>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-semibold text-ink">Stollar</h2>
            <div className="flex gap-2">
              <button onClick={() => setThemeOpen(true)}
                className="border border-line text-muted text-sm px-3 py-2 rounded-lg">
                <i className="ti ti-palette" /> QR dizayni
              </button>
              {tables.length > 0 && (
                <button onClick={downloadPdf}
                  className="border border-line text-muted text-sm px-3 py-2 rounded-lg">
                  <i className="ti ti-file-download" /> PDF
                </button>
              )}
              <button onClick={() => setBulkOpen(true)}
                className="border border-line text-muted text-sm px-3 py-2 rounded-lg">
                <i className="ti ti-stack-2" /> Ko'p
              </button>
              <button onClick={() => setEditing('new')}
                className="bg-brand-400 text-brand-text text-sm font-medium px-3 py-2 rounded-lg">
                <i className="ti ti-plus" /> Stol
              </button>
            </div>
          </div>

          {tables.length === 0 ? (
            <div className="text-center py-12">
              <i className="ti ti-armchair text-4xl text-muted mb-3 block" />
              <div className="text-ink font-medium">Stol qo'shilmagan</div>
              <p className="text-sm text-muted mt-1">
                Stol qo'shing — har biriga QR kod yaratiladi
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((t) => {
                const ts = TABLE_STATUS[t.status] || TABLE_STATUS.available;
                return (
                  <div key={t._id} className="bg-surface border border-line rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">
                          {t.tableName || `Stol ${t.tableNumber}`}
                        </div>
                        <div className="text-xs text-muted">
                          №{t.tableNumber} · {t.capacity} kishi
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-none ${ts.cls}`}>
                        {ts.label}
                      </span>
                    </div>

                    {t.activeSession && (
                      <div className="text-[11px] text-green-600 mb-2">
                        Sessiya faol
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-1.5">
                      <button onClick={() => downloadQr(t, 'svg')}
                        title="QR yuklash"
                        className="border border-line text-muted py-1.5 rounded-lg text-xs">
                        <i className="ti ti-qrcode" />
                      </button>
                      <button onClick={() => setEditing(t)}
                        title="Tahrirlash"
                        className="border border-line text-muted py-1.5 rounded-lg text-xs">
                        <i className="ti ti-pencil" />
                      </button>
                      <button onClick={() => regenerate(t)}
                        title="QR yangilash"
                        className="border border-line text-muted py-1.5 rounded-lg text-xs">
                        <i className="ti ti-refresh" />
                      </button>
                      <button onClick={() => removeTable(t)}
                        title="O'chirish"
                        className="border border-line text-red-500 py-1.5 rounded-lg text-xs">
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <TableForm
          table={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {bulkOpen && (
        <BulkForm onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); load(); }} />
      )}
      {themeOpen && (
        <ThemeForm theme={cfg?.qrTheme}
          onClose={() => setThemeOpen(false)}
          onSaved={() => { setThemeOpen(false); load(); }} />
      )}
    </div>
  );
}

function TableForm({ table, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(table);

  const [form, setForm] = useState({
    tableNumber: table?.tableNumber || '',
    tableName: table?.tableName || '',
    capacity: table?.capacity ?? 4,
    status: table?.status || 'available',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!String(form.tableNumber).trim()) { setErr('Stol raqamini kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        tableNumber: String(form.tableNumber).trim(),
        capacity: Number(form.capacity) || 4,
      };
      if (isEdit) await panelApi.updateTable(table._id, payload);
      else await panelApi.createTable(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Stolni tahrirlash' : 'Yangi stol'} onClose={onClose}>
      <Field label="Stol raqami *">
        <input value={form.tableNumber}
          onChange={(e) => set('tableNumber', e.target.value)}
          placeholder="12" className="inp" />
      </Field>

      <Field label="Nomi" hint="Ixtiyoriy — masalan 'Deraza yonida'">
        <input value={form.tableName}
          onChange={(e) => set('tableName', e.target.value)}
          placeholder="Deraza yonida" className="inp" />
      </Field>

      <Field label="Sig'imi">
        <NumberInput value={form.capacity}
          onChange={(v) => set('capacity', v)} suffix="kishi" placeholder="4" />
      </Field>

      {isEdit && (
        <Field label="Holati">
          <select value={form.status} onChange={(e) => set('status', e.target.value)}
            className="inp">
            {Object.entries(TABLE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      )}

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

function BulkForm({ onClose, onSaved }) {
  useLockScroll();
  const [form, setForm] = useState({ count: 10, startFrom: 1, capacity: 4 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await panelApi.createTablesBulk({
        count: Number(form.count) || 0,
        startFrom: Number(form.startFrom) || 1,
        capacity: Number(form.capacity) || 4,
      });
      alert(`${r.created} ta stol qo'shildi`);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Bir nechta stol" onClose={onClose}>
      <p className="text-xs text-muted mb-3 leading-relaxed">
        Ketma-ket raqamlangan stollar yaratiladi. Mavjud raqamlar
        o'tkazib yuboriladi.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nechta">
          <NumberInput value={form.count} onChange={(v) => set('count', v)} placeholder="10" />
        </Field>
        <Field label="Boshlanish raqami">
          <NumberInput value={form.startFrom} onChange={(v) => set('startFrom', v)} placeholder="1" />
        </Field>
      </div>

      <Field label="Sig'imi">
        <NumberInput value={form.capacity} onChange={(v) => set('capacity', v)}
          suffix="kishi" placeholder="4" />
      </Field>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

function ThemeForm({ theme, onClose, onSaved }) {
  useLockScroll();

  const [form, setForm] = useState({
    backgroundColor: theme?.backgroundColor || '#1C1815',
    backgroundImage: theme?.backgroundImage || '',
    textColor: theme?.textColor || '#F7F2EA',
    accentColor: theme?.accentColor || '#F5A524',
    logoUrl: theme?.logoUrl || '',
    headline: theme?.headline || 'Menyuni oching',
    footnote: theme?.footnote || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await panelApi.updateQrTheme(form);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="QR dizayni" onClose={onClose}>
      <div className="bg-canvas rounded-lg p-3 mb-4 text-xs text-muted leading-relaxed">
        QR kod doim <b className="text-ink">oq maydonda</b> chiqadi —
        fon rasmi uni to'sib qo'ymaydi va skaner har doim o'qiy oladi.
      </div>

      <ImageUpload label="Logo" value={form.logoUrl}
        onChange={(url) => set('logoUrl', url)} />

      <ImageUpload label="Fon rasmi" value={form.backgroundImage}
        onChange={(url) => set('backgroundImage', url)} />

      <div className="grid grid-cols-3 gap-3 mt-3">
        <ColorField label="Fon" value={form.backgroundColor}
          onChange={(v) => set('backgroundColor', v)} />
        <ColorField label="Matn" value={form.textColor}
          onChange={(v) => set('textColor', v)} />
        <ColorField label="Urg'u" value={form.accentColor}
          onChange={(v) => set('accentColor', v)} />
      </div>

      <Field label="Yuqori matn">
        <input value={form.headline} onChange={(e) => set('headline', e.target.value)}
          placeholder="Menyuni oching" className="inp" />
      </Field>

      <Field label="Pastki matn">
        <input value={form.footnote} onChange={(e) => set('footnote', e.target.value)}
          placeholder="Kamerani QR ga to'g'rilang" className="inp" />
      </Field>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ Umumiy ═══ */
function ColorField({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-ink mb-1.5">{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-lg border border-line cursor-pointer" />
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto max-h-[88dvh] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ErrBox({ text }) {
  return <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{text}</div>;
}

function Actions({ onClose, onSubmit, saving }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
        Bekor
      </button>
      <button onClick={onSubmit} disabled={saving}
        className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}

/* ═══ OFITSIANTLAR ═══ */
function Waiters({ tables }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getWaiters()
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetDevice = async (w) => {
    if (!window.confirm(
      `${w.fullName} qurilmasi bekor qilinsinmi?\n\n` +
      'Keyingi kirishda yangi qurilma bog\'lanadi.',
    )) return;
    try {
      const r = await panelApi.resetWaiterDevice(w._id);
      alert(r.message);
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (w) => {
    if (!window.confirm(`${w.fullName} o'chirilsinmi?`)) return;
    try { await panelApi.deleteWaiter(w._id); load(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <>
      <button onClick={() => setEditing('new')}
        className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl mb-4">
        <i className="ti ti-user-plus" /> Ofitsiant qo'shish
      </button>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <i className="ti ti-users text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">Ofitsiant yo'q</div>
          <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
            Ofitsiantlar waiter.lokma.uz orqali kirib buyurtma qabul qiladi
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((w) => (
            <div key={w._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{w.fullName}</div>
                  <div className="text-xs text-muted">
                    @{w.login}{w.phone && ` · ${w.phone}`}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${
                  w.isActive ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
                }`}>
                  {w.isActive ? 'Faol' : "O'chiq"}
                </span>
              </div>

              {/* Qurilma */}
              <div className="flex items-center gap-2 text-xs mb-2">
                <i className={`ti ${w.deviceBound ? 'ti-device-mobile-check' : 'ti-device-mobile-off'}`} />
                <span className={w.deviceBound ? 'text-green-600' : 'text-muted'}>
                  {w.deviceBound
                    ? `Qurilma bog'langan${w.deviceLabel ? ` · ${w.deviceLabel}` : ''}`
                    : "Qurilma bog'lanmagan"}
                </span>
              </div>

              {/* Stollar */}
              {w.tableIds?.length > 0 && (
                <div className="text-xs text-muted mb-2">
                  Stollar: {w.tableIds.map((t) => t.tableNumber).join(', ')}
                </div>
              )}

              {/* Daromad */}
              {w.earnings?.total > 0 && (
                <div className="text-xs text-muted mb-3">
                  Daromad: <b className="text-ink">
                    {w.earnings.total.toLocaleString('ru-RU')} so'm
                  </b> · {w.earnings.orders} buyurtma
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setEditing(w)}
                  className="flex-1 border border-line text-muted py-2 rounded-lg text-sm">
                  Tahrirlash
                </button>
                {w.deviceBound && (
                  <button onClick={() => resetDevice(w)}
                    title="Qurilmani almashtirish"
                    className="px-3 border border-amber-200 text-amber-700 py-2 rounded-lg text-sm">
                    <i className="ti ti-device-mobile-x" />
                  </button>
                )}
                <button onClick={() => remove(w)}
                  className="px-3 border border-line text-red-500 py-2 rounded-lg">
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <WaiterForm
          waiter={editing === 'new' ? null : editing}
          tables={tables}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function WaiterForm({ waiter, tables, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(waiter);

  const [form, setForm] = useState({
    firstName: waiter?.firstName || '',
    lastName: waiter?.lastName || '',
    phone: waiter?.phone || '',
    login: waiter?.login || '',
    password: '',
    isActive: waiter?.isActive ?? true,
    tableIds: waiter?.tableIds?.map((t) => t._id || t) || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleTable = (id) => {
    setForm((f) => ({
      ...f,
      tableIds: f.tableIds.includes(id)
        ? f.tableIds.filter((x) => x !== id)
        : [...f.tableIds, id],
    }));
  };

  const submit = async () => {
    if (form.firstName.trim().length < 2) { setErr('Ismni kiriting'); return; }
    if (!isEdit && form.login.trim().length < 3) { setErr('Login kiriting'); return; }
    if (!isEdit && form.password.length < 4) { setErr('Parol kamida 4 belgi'); return; }

    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      if (isEdit) {
        delete payload.login;
        if (!payload.password) delete payload.password;
      }
      if (isEdit) await panelApi.updateWaiter(waiter._id, payload);
      else await panelApi.createWaiter(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Ofitsiantni tahrirlash' : 'Yangi ofitsiant'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ism *">
          <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)}
            className="inp" />
        </Field>
        <Field label="Familiya">
          <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)}
            className="inp" />
        </Field>
      </div>

      <Field label="Telefon">
        <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
          placeholder="+998 90 123 45 67" className="inp" />
      </Field>

      {!isEdit && (
        <Field label="Login *" hint="Faqat harf, raqam va _">
          <input value={form.login}
            onChange={(e) => set('login', e.target.value.toLowerCase())}
            placeholder="aziz" className="inp" />
        </Field>
      )}

      <Field label={isEdit ? 'Yangi parol' : 'Parol *'}
        hint={isEdit ? "Bo'sh qoldirsangiz o'zgarmaydi" : 'Kamida 4 belgi'}>
        <input type="text" value={form.password}
          onChange={(e) => set('password', e.target.value)}
          className="inp" />
      </Field>

      {tables?.length > 0 && (
        <Field label="Biriktirilgan stollar"
          hint="Tanlanmasa barcha stollarga kirish beriladi. Bitta stolga eng ko'pi 3 ofitsiant.">
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {tables.map((t) => (
              <button key={t._id} onClick={() => toggleTable(t._id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                  form.tableIds.includes(t._id)
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-line text-muted'
                }`}>
                {t.tableNumber}
              </button>
            ))}
          </div>
        </Field>
      )}

      <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
        <span className="text-sm text-ink">Faol</span>
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="w-5 h-5 accent-brand-400" />
      </label>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ XIZMAT HAQI ═══ */
function ServiceFee({ cfg, onSaved }) {
  const [form, setForm] = useState({
    serviceFeeEnabled: cfg?.serviceFeeEnabled ?? false,
    serviceFeeType: cfg?.serviceFeeType || 'percentage',
    serviceFeeValue: cfg?.serviceFeeValue ?? 10,
    useGlobalStopList: cfg?.useGlobalStopList !== false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await panelApi.updateDineInSettings(form);
      setMsg({ ok: true, text: 'Saqlandi' });
      onSaved?.();
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <section className="bg-surface border border-line rounded-xl p-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer mb-3">
          <div>
            <div className="text-sm text-ink">Xizmat haqi</div>
            <div className="text-xs text-muted mt-0.5">
              Faqat ofitsiant qabul qilgan buyurtmalarga qo'llanadi
            </div>
          </div>
          <input type="checkbox" checked={form.serviceFeeEnabled}
            onChange={(e) => set('serviceFeeEnabled', e.target.checked)}
            className="w-5 h-5 accent-brand-400 flex-none mt-0.5" />
        </label>

        {form.serviceFeeEnabled && (
          <>
            <div className="flex gap-2 mb-3">
              {[['percentage', 'Foiz (%)'], ['fixed', "Qat'iy summa"]].map(([k, label]) => (
                <button key={k} onClick={() => set('serviceFeeType', k)}
                  className={`flex-1 py-2.5 rounded-xl text-sm border ${
                    form.serviceFeeType === k
                      ? 'border-brand-400 bg-brand-50 text-brand-600'
                      : 'border-line text-muted'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <Field label="Miqdori">
              <NumberInput value={form.serviceFeeValue}
                onChange={(v) => set('serviceFeeValue', v)}
                suffix={form.serviceFeeType === 'percentage' ? '%' : "so'm"} />
            </Field>

            <div className="text-xs text-muted bg-canvas rounded-lg p-3 leading-relaxed">
              <b className="text-ink">Misol:</b> taomlar 150 000 so'm bo'lsa,
              {form.serviceFeeType === 'percentage'
                ? ` xizmat haqi ${Math.round(150000 * (Number(form.serviceFeeValue) || 0) / 100).toLocaleString('ru-RU')} so'm`
                : ` xizmat haqi ${(Number(form.serviceFeeValue) || 0).toLocaleString('ru-RU')} so'm`}.
              <br />
              QR orqali berilgan buyurtmada xizmat haqi olinmaydi.
            </div>
          </>
        )}
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm text-ink">Stop List ishlatilsin</div>
            <div className="text-xs text-muted mt-0.5">
              To'xtatilgan taomlar zal menyusida ham ko'rinmaydi
            </div>
          </div>
          <input type="checkbox" checked={form.useGlobalStopList}
            onChange={(e) => set('useGlobalStopList', e.target.checked)}
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

/* ═══ OFITSIANT DAROMADI ═══ */
function Earnings() {
  const [period, setPeriod] = useState('month');
  const [range, setRange] = useState({
    from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const req = period === 'custom'
      ? panelApi.getWaiterEarningsRange(range.from, range.to)
      : panelApi.getWaiterEarnings(period);

    req.then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [period, range]);

  useEffect(() => { load(); }, [load]);

  const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  if (loading) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  const waiters = data?.waiters || [];
  const totalRemaining = waiters.reduce((s, w) => s + w.qoldiq, 0);

  return (
    <>
      {/* Davr */}
      <div className="flex gap-2 mb-4">
        {[['today', 'Bugun'], ['week', 'Hafta'], ['month', 'Oy'], ['custom', 'Davr']].map(([k, label]) => (
          <button key={k} onClick={() => setPeriod(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
              period === k
                ? 'border-brand-400 bg-brand-50 text-brand-600'
                : 'border-line text-muted'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <input type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="inp" />
          <input type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="inp" />
        </div>
      )}

      {totalRemaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="text-xs text-amber-700">To&apos;lanmagan xizmat haqi</div>
          <div className="text-xl font-bold text-amber-800">{som(totalRemaining)} so&apos;m</div>
        </div>
      )}

      {waiters.length === 0 ? (
        <div className="text-center py-12">
          <i className="ti ti-users text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">Ofitsiant yo&apos;q</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {waiters.map((w) => (
            <div key={w._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="font-medium text-ink">{w.fullName}</div>
                {!w.isActive && (
                  <span className="text-[11px] px-2 py-1 rounded-full bg-canvas text-muted flex-none">
                    O&apos;chiq
                  </span>
                )}
              </div>

              {/* Davr bo'yicha */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-canvas rounded-lg py-2">
                  <div className="text-[10px] text-muted">Savdo</div>
                  <div className="text-sm font-semibold text-ink">{som(w.savdo)}</div>
                </div>
                <div className="bg-canvas rounded-lg py-2">
                  <div className="text-[10px] text-muted">Xizmat haqi</div>
                  <div className="text-sm font-semibold text-brand-600">{som(w.xizmatHaqi)}</div>
                </div>
                <div className="bg-canvas rounded-lg py-2">
                  <div className="text-[10px] text-muted">Buyurtma</div>
                  <div className="text-sm font-semibold text-ink">{w.buyurtmalar}</div>
                </div>
              </div>

              {/* Umumiy hisob */}
              <div className="text-xs text-muted space-y-1 mb-3 pt-2 border-t border-line">
                <div className="flex justify-between">
                  <span>Jami daromad</span>
                  <span className="text-ink">{som(w.jamiDaromad)} so&apos;m</span>
                </div>
                <div className="flex justify-between">
                  <span>To&apos;langan</span>
                  <span className="text-green-600">{som(w.tolangan)} so&apos;m</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-ink">Qoldiq</span>
                  <span className={w.qoldiq > 0 ? 'text-amber-700' : 'text-muted'}>
                    {som(w.qoldiq)} so&apos;m
                  </span>
                </div>
              </div>

              {w.qoldiq > 0 && (
                <button onClick={() => setPaying(w)}
                  className="w-full bg-green-500 text-white font-medium py-2 rounded-lg text-sm">
                  To&apos;lash
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {paying && (
        <PayoutModal
          waiter={paying}
          period={period}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); load(); }}
        />
      )}
    </>
  );
}

function PayoutModal({ waiter, period, onClose, onPaid }) {
  useLockScroll();
  const [amount, setAmount] = useState(waiter.qoldiq);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { setErr('Summani kiriting'); return; }

    setSaving(true); setErr(null);
    try {
      const r = await panelApi.payWaiter(waiter._id, value, note);
      alert(`${som(r.paid)} so'm to'landi. Qoldiq: ${som(r.remaining)} so'm`);
      onPaid();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Xizmat haqini to'lash" onClose={onClose}>
      <div className="bg-canvas rounded-xl p-3.5 mb-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted">Ofitsiant</span>
          <span className="text-ink">{waiter.fullName}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted">Qoldiq</span>
          <b className="text-ink">{som(waiter.qoldiq)} so&apos;m</b>
        </div>
      </div>

      <Field label="To'lov summasi" hint="Qoldiqdan ko'p bo'lmasligi kerak">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>

      <Field label="Izoh">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={`${period === 'today' ? 'Bugungi' : period === 'week' ? 'Haftalik' : 'Oylik'} to'lov`}
          className="inp" />
      </Field>

      <div className="text-xs text-muted bg-canvas rounded-lg p-3 mb-3 leading-relaxed">
        To&apos;lov moliyaviy jurnalga yoziladi. Bir summa ikki marta
        to&apos;lanmaydi — qoldiq avtomatik hisoblanadi.
      </div>

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}
