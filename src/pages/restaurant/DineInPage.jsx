import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { NumberInput } from '@/components/form/NumberInput';
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

      {/* Stollar */}
      {cfg?.status === 'active' && (
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
