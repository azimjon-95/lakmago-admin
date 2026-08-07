import { useState, useEffect, useCallback, useRef } from 'react';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';
import { useLockScroll } from '@/hooks/useLockScroll';
import { confirm, confirmWithReason } from '@/components/ui/confirm';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-700' },
  processing: { label: "Ko'chirilmoqda", cls: 'bg-blue-50 text-blue-700' },
  approved: { label: 'Tasdiqlangan', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Rad etilgan', cls: 'bg-red-50 text-red-600' },
  failed: { label: 'Xato', cls: 'bg-red-50 text-red-600' },
};

export function MenuTransferPage() {
  const [box, setBox] = useState('in');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getTransfers(box)
      .then((l) => setItems(Array.isArray(l) ? l : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [box]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('transfer:new', load);
    socket.on('transfer:update', load);
    return () => {
      socket.off('transfer:new', load);
      socket.off('transfer:update', load);
    };
  }, [load]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-semibold text-ink">Menyu ko'chirish</h1>
          <p className="text-sm text-muted mt-0.5">
            Taomlarni boshqa filialga yuborish
          </p>
        </div>
        <button
          onClick={() => setSendOpen(true)}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white flex-none"
        >
          <i className="ti ti-send" /> Yuborish
        </button>
      </div>

      {/* Kelgan / Yuborilgan */}
      <div className="flex gap-2 mt-4 mb-4 border-b border-line">
        {[['in', 'Kelgan'], ['out', 'Yuborilgan']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setBox(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              box === k
                ? 'border-brand-400 text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted text-sm">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-14">
          <i className="ti ti-inbox text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">
            {box === 'in' ? "So'rov kelmagan" : "So'rov yuborilmagan"}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((t) => {
            const st = STATUS[t.status] || STATUS.pending;
            return (
              <button
                key={t._id}
                onClick={() => setDetail(t._id)}
                className="w-full bg-surface border border-line rounded-xl p-3.5 text-left hover:border-brand-400/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">
                      {box === 'in' ? t.fromRestaurantName : t.toRestaurantName}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(t.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                {t.status === 'approved' && t.result && (
                  <div className="text-xs text-muted">
                    {t.result.created} ta qo'shildi
                    {t.result.skipped > 0 && ` · ${t.result.skipped} ta bor edi`}
                  </div>
                )}
                {t.status === 'rejected' && t.rejectReason && (
                  <div className="text-xs text-muted">Sabab: {t.rejectReason}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {sendOpen && (
        <SendModal onClose={() => setSendOpen(false)} onSent={() => { setSendOpen(false); setBox('out'); load(); }} />
      )}
      {detail && (
        <DetailModal id={detail} box={box} onClose={() => setDetail(null)} onDone={() => { setDetail(null); load(); }} />
      )}
    </div>
  );
}

/* ===== Yuborish ===== */
function SendModal({ onClose, onSent }) {
  useLockScroll();

  const [step, setStep] = useState(1);          // 1: taomlar, 2: filial, 3: tasdiq
  const [mode, setMode] = useState('all');
  const [dishes, setDishes] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState('');
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    panelApi.getDishes().then((l) => setDishes(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);

  // Qidiruv — debounce bilan, ortiqcha so'rov yubormaymiz
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setBranches([]); return undefined; }

    timer.current = setTimeout(() => {
      panelApi.searchBranches(q.trim()).then(setBranches).catch(() => {});
    }, 400);

    return () => clearTimeout(timer.current);
  }, [q]);

  const toggle = (id) => {
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const count = mode === 'all' ? dishes.length : picked.size;

  const send = async () => {
    setSaving(true); setErr(null);
    try {
      await panelApi.createTransfer({
        toRestaurantId: branch._id,
        mode,
        dishIds: mode === 'selected' ? [...picked] : [],
      });
      onSent();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Menyuni ko'chirish">
      {step === 1 && (
        <>
          <div className="flex gap-2 mb-4">
            {[['all', 'Butun menyu'], ['selected', 'Tanlangan']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  mode === k
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-line text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'selected' && (
            <div className="max-h-72 overflow-y-auto border border-line rounded-xl mb-4">
              {dishes.map((d) => (
                <label
                  key={d._id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 cursor-pointer hover:bg-canvas"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(d._id)}
                    onChange={() => toggle(d._id)}
                    className="w-4 h-4 accent-brand-400 flex-none"
                  />
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{d.name}</span>
                  <span className="text-xs text-muted flex-none">{som(d.price)}</span>
                </label>
              ))}
              {dishes.length === 0 && (
                <div className="text-sm text-muted p-4 text-center">Menyu bo'sh</div>
              )}
            </div>
          )}

          <div className="text-sm text-muted mb-4">
            {count} ta taom ko'chiriladi
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
              Bekor
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={count === 0}
              className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
            >
              Davom etish
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Qabul qiluvchi filial
          </label>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setBranch(null); }}
            placeholder="Restoran nomini yozing..."
            className="inp mb-2"
            autoFocus
          />

          {branch ? (
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-400 rounded-xl p-3 mb-4">
              <i className="ti ti-building-store text-brand-600" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{branch.name}</div>
                {branch.address && (
                  <div className="text-xs text-muted truncate">{branch.address}</div>
                )}
              </div>
              <button onClick={() => setBranch(null)} className="text-muted flex-none">
                <i className="ti ti-x" />
              </button>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto mb-4">
              {branches.map((b) => (
                <button
                  key={b._id}
                  onClick={() => { setBranch(b); setQ(b.name); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-canvas text-left"
                >
                  <i className="ti ti-building-store text-muted flex-none" />
                  <div className="min-w-0">
                    <div className="text-sm text-ink truncate">{b.name}</div>
                    {b.address && <div className="text-xs text-muted truncate">{b.address}</div>}
                  </div>
                </button>
              ))}
              {q.trim().length >= 2 && branches.length === 0 && (
                <div className="text-sm text-muted p-3 text-center">Topilmadi</div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
              Orqaga
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!branch}
              className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
            >
              Davom etish
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="bg-canvas rounded-xl p-4 mb-4 text-sm">
            <Row label="Filial" value={branch.name} />
            <Row label="Taomlar" value={`${count} ta`} />
            <Row label="Turi" value={mode === 'all' ? 'Butun menyu' : 'Tanlangan'} />
          </div>

          <p className="text-xs text-muted mb-4 leading-relaxed">
            So'rov filial adminiga yuboriladi. U tasdiqlagach taomlar
            menyusiga qo'shiladi. Bir xil nomdagi taomlar takrorlanmaydi.
          </p>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
              Orqaga
            </button>
            <button
              onClick={send}
              disabled={saving}
              className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50"
            >
              {saving ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ===== Tafsilot va javob ===== */
function DetailModal({ id, box, onClose, onDone }) {
  useLockScroll();

  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    panelApi.getTransfer(id).then(setData).catch(() => {});
  }, [id]);

  const respond = async (action) => {
    if (busy) return;
    let reason = '';
    if (action === 'reject') {
      reason = await confirmWithReason('Rad etish sababi (ixtiyoriy):');
    } else if (!await confirm(`${data.dishes.length} ta taom menyuga qo'shiladimi?`)) {
      return;
    }

    setBusy(true);
    try {
      await panelApi.respondTransfer(id, action, reason);
      onDone();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  if (!data) {
    return <Modal onClose={onClose} title="So'rov"><div className="text-muted text-sm">Yuklanmoqda...</div></Modal>;
  }

  const st = STATUS[data.status] || STATUS.pending;

  return (
    <Modal onClose={onClose} title="So'rov tafsiloti">
      <div className="bg-canvas rounded-xl p-3.5 mb-4 text-sm">
        <Row label="Kimdan" value={data.fromRestaurantName} />
        <Row label="Kimga" value={data.toRestaurantName} />
        <Row label="Taomlar" value={`${data.dishes?.length || 0} ta`} />
        <div className="flex justify-between items-center py-1">
          <span className="text-muted">Holat</span>
          <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${st.cls}`}>
            {st.label}
          </span>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto border border-line rounded-xl mb-4">
        {data.dishes?.map((d) => (
          <div key={d._id} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-0">
            {d.imageUrl ? (
              <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-none" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-canvas flex-none" />
            )}
            <span className="flex-1 min-w-0 text-sm text-ink truncate">{d.name}</span>
            <span className="text-xs text-muted flex-none">{som(d.price)}</span>
          </div>
        ))}
      </div>

      {/* Javob — faqat kelgan va kutilayotgan so'rovga */}
      {box === 'in' && data.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={() => respond('reject')}
            disabled={busy}
            className="flex-1 border border-red-200 text-red-600 py-2.5 rounded-xl disabled:opacity-50"
          >
            Rad etish
          </button>
          <button
            onClick={() => respond('approve')}
            disabled={busy}
            className="flex-[1.5] bg-green-500 text-white font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {busy ? '...' : 'Tasdiqlash'}
          </button>
        </div>
      ) : (
        <button onClick={onClose} className="w-full border border-line text-muted py-2.5 rounded-xl">
          Yopish
        </button>
      )}
    </Modal>
  );
}

/* ===== Umumiy ===== */
function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto max-h-[88dvh] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
      >
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-muted flex-none">{label}</span>
      <span className="text-ink text-right truncate">{value}</span>
    </div>
  );
}
