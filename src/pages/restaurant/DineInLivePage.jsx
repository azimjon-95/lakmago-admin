import { useState, useEffect, useCallback, useRef } from 'react';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';
import { useLockScroll } from '@/hooks/useLockScroll';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtTime = (d) => new Date(d).toLocaleTimeString('ru-RU', {
  hour: '2-digit', minute: '2-digit',
});

const ORDER_STATUS = {
  pending: { label: 'Yangi', next: 'accepted', nextLabel: 'Qabul qilish', cls: 'bg-amber-50 text-amber-700' },
  accepted: { label: 'Qabul qilindi', next: 'preparing', nextLabel: 'Tayyorlash', cls: 'bg-blue-50 text-blue-700' },
  preparing: { label: 'Tayyorlanmoqda', next: 'ready', nextLabel: 'Tayyor', cls: 'bg-violet-50 text-violet-700' },
  ready: { label: 'Tayyor', next: 'served', nextLabel: 'Berildi', cls: 'bg-green-50 text-green-700' },
  served: { label: 'Berildi', next: 'completed', nextLabel: 'Yakunlash', cls: 'bg-green-50 text-green-700' },
  completed: { label: 'Yakunlandi', next: null, cls: 'bg-canvas text-muted' },
  cancelled: { label: 'Bekor', next: null, cls: 'bg-red-50 text-red-600' },
};

export function DineInLivePage() {
  const [dash, setDash] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('dinein_sound') !== '0'; }
    catch { return true; }
  });
  const [receipt, setReceipt] = useState(null);
  const seenOrders = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([
        panelApi.getDineInDashboard(),
        panelApi.getDineInOrders(true),
      ]);
      setDash(d);
      setOrders(o);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();

    const onNew = (data) => {
      // Yangi buyurtma — ovoz va bildirishnoma
      if (!seenOrders.current.has(data.orderId)) {
        seenOrders.current.add(data.orderId);
        if (soundOn) playBeep();
        notify(`Yangi buyurtma #${data.dineInNumber}`, `${som(data.total)} so'm`);
      }
      load();
    };

    socket.on('dinein:new', onNew);
    socket.on('dinein:order', load);
    socket.on('dinein:request', (r) => {
      if (soundOn) playBeep();
      notify(
        r.type === 'bill' ? 'Hisob so\u2018ralmoqda' : 'Ofitsiant chaqirilmoqda',
        `Stol ${r.tableNumber}`,
      );
      load();
    });
    socket.on('dinein:request-update', load);
    socket.on('table:update', load);

    // Zaxira: socket uzilsa ham yangilanadi
    const timer = setInterval(load, 45000);

    return () => {
      socket.off('dinein:new', onNew);
      socket.off('dinein:order', load);
      socket.off('dinein:request');
      socket.off('dinein:request-update', load);
      socket.off('table:update', load);
      clearInterval(timer);
    };
  }, [load, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem('dinein_sound', next ? '1' : '0'); } catch { /* ignore */ }
    if (next) {
      playBeep();
      requestNotifyPermission();
    }
  };

  const setStatus = async (order, status) => {
    try {
      await panelApi.setDineInOrderStatus(order._id, status);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleRequest = async (r, status) => {
    try {
      await panelApi.updateTableRequest(r._id, status);
      load();
    } catch (e) { alert(e.message); }
  };

  const closeTable = async (tableId, tableName) => {
    if (!window.confirm(`${tableName} yopilsinmi?\n\nBarcha buyurtmalar yakunlanadi.`)) return;
    try {
      await panelApi.closeTable(tableId, false);
      load();
    } catch (e) {
      if (e.message?.includes('yakunlanmagan')) {
        if (window.confirm(`${e.message}\n\nBaribir yopilsinmi?`)) {
          await panelApi.closeTable(tableId, true);
          load();
        }
      } else {
        alert(e.message);
      }
    }
  };

  if (loading) return <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>;

  const requests = [
    ...(dash?.hisobSoragan || []),
    ...(dash?.ofitsiantChaqirgan || []),
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Jonli buyurtmalar</h1>
          <p className="text-sm text-muted mt-0.5">Zal buyurtmalari va chaqiruvlar</p>
        </div>
        <button onClick={toggleSound}
          title={soundOn ? "Ovozni o'chirish" : 'Ovozni yoqish'}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-none ${
            soundOn ? 'border-brand-400 text-brand-600' : 'border-line text-muted'
          }`}>
          <i className={`ti ${soundOn ? 'ti-bell' : 'ti-bell-off'}`} />
        </button>
      </div>

      {/* Ko'rsatkichlar */}
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat label="Bugungi buyurtmalar" value={dash.bugungiBuyurtmalar} raw />
          <Stat label="Bugungi tushum" value={dash.bugungiTushum} />
          <Stat label="Faol stollar" value={dash.faolStollar} raw />
          <Stat label="Tayyorlanmoqda" value={dash.tayyorlanmoqda} raw accent />
        </div>
      )}

      {/* Chaqiruvlar */}
      {requests.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-ink mb-2">
            Chaqiruvlar ({requests.length})
          </h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r._id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  r.type === 'bill'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-amber-200 bg-amber-50'
                }`}>
                <i className={`ti ${r.type === 'bill' ? 'ti-receipt' : 'ti-bell-ringing'} text-lg`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {r.type === 'bill' ? 'Hisob so\u2018ralmoqda' : 'Ofitsiant chaqirilmoqda'}
                  </div>
                  <div className="text-xs text-muted">
                    Stol {r.tableId?.tableNumber} · {fmtTime(r.createdAt)}
                    {r.acceptedByName && ` · ${r.acceptedByName}`}
                  </div>
                </div>
                {r.status === 'pending' ? (
                  <button onClick={() => handleRequest(r, 'accepted')}
                    className="bg-ink text-white text-sm px-3 py-1.5 rounded-lg flex-none">
                    Qabul qilindi
                  </button>
                ) : (
                  <button onClick={() => handleRequest(r, 'done')}
                    className="border border-line text-muted text-sm px-3 py-1.5 rounded-lg flex-none">
                    Bajarildi
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buyurtmalar */}
      <h2 className="text-sm font-semibold text-ink mb-2">
        Faol buyurtmalar ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <i className="ti ti-clipboard-check text-4xl text-muted mb-3 block" />
          <div className="text-ink font-medium">Faol buyurtma yo&apos;q</div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            const tableName = o.tableId?.tableName
              ? `${o.tableId.tableName} · ${o.tableId.tableNumber}`
              : `Stol ${o.tableId?.tableNumber || '—'}`;

            return (
              <div key={o._id} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-bold text-ink text-lg">#{o.dineInNumber}</div>
                    <div className="text-xs text-muted">
                      {tableName} · {fmtTime(o.createdAt)}
                      {o.orderSource === 'waiter' && o.waiterName && (
                        <span className="text-brand-600"> · {o.waiterName}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-none ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="text-sm text-muted mb-2 space-y-0.5">
                  {o.items?.map((it, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span>{it.name} ×{it.quantity}</span>
                      <span className="flex-none">{som(it.unitPrice * it.quantity)}</span>
                    </div>
                  ))}
                </div>

                {o.serviceFee > 0 && (
                  <div className="flex justify-between text-xs text-muted pt-1.5 border-t border-line">
                    <span>Xizmat haqi</span>
                    <span>{som(o.serviceFee)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-line mb-3">
                  <span className="text-sm text-muted">Jami</span>
                  <b className="text-ink">{som(o.total)}</b>
                </div>

                {o.note && (
                  <div className="text-xs text-muted bg-canvas rounded-lg px-3 py-2 mb-3">
                    {o.note}
                  </div>
                )}

                <div className="flex gap-2">
                  {st.next && (
                    <button onClick={() => setStatus(o, st.next)}
                      className="flex-1 bg-brand-400 text-brand-text font-medium py-2 rounded-lg text-sm">
                      {st.nextLabel}
                    </button>
                  )}
                  {o.dineInSessionId && (
                    <button onClick={() => setReceipt(o.dineInSessionId)}
                      title="Chek"
                      className="px-3 border border-line text-muted py-2 rounded-lg">
                      <i className="ti ti-receipt text-sm" />
                    </button>
                  )}
                  {o.tableId && (
                    <button onClick={() => closeTable(o.tableId._id, tableName)}
                      title="Stolni yopish"
                      className="px-3 border border-line text-red-500 py-2 rounded-lg">
                      <i className="ti ti-door-exit text-sm" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receipt && <ReceiptModal sessionId={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/* ═══ Chek ═══ */
function ReceiptModal({ sessionId, onClose }) {
  useLockScroll();
  const [data, setData] = useState(null);

  useEffect(() => {
    panelApi.getReceipt(sessionId).then(setData).catch(() => {});
  }, [sessionId]);

  const print = () => window.print();

  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[88dvh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-none no-print">
          <h3 className="font-semibold text-ink">Chek</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {!data ? (
          <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 receipt-area">
              <div className="text-center mb-4">
                <div className="font-bold text-ink">{data.restaurant?.name}</div>
                {data.restaurant?.address && (
                  <div className="text-xs text-muted">{data.restaurant.address}</div>
                )}
                <div className="text-sm text-ink mt-2">
                  {data.table?.tableName
                    ? `${data.table.tableName} · ${data.table.tableNumber}`
                    : `Stol ${data.table?.tableNumber}`}
                </div>
              </div>

              <div className="border-t border-dashed border-line py-3 space-y-1">
                {data.lines?.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink">{l.name} ×{l.quantity}</span>
                    <span className="text-muted flex-none">{som(l.total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-line pt-3 space-y-1 text-sm">
                <Row label="Taomlar" value={som(data.subtotal)} />
                {data.serviceFee > 0 && (
                  <Row label={data.serviceFeeLabel} value={som(data.serviceFee)} />
                )}
                {data.discount > 0 && (
                  <Row label="Chegirma" value={`−${som(data.discount)}`} />
                )}
              </div>

              <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-line">
                <span className="font-semibold text-ink">Jami</span>
                <b className="text-lg text-ink">{som(data.total)}</b>
              </div>

              <div className="text-center text-[11px] text-muted mt-5">
                Rahmat! · lokma.uz
              </div>
            </div>

            <div className="p-4 border-t border-line flex-none no-print">
              <button onClick={print}
                className="w-full bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl">
                <i className="ti ti-printer" /> Chop etish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function Stat({ label, value, raw, accent }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-brand-600' : 'text-ink'}`}>
        {raw ? value : som(value)}
      </div>
      {!raw && <div className="text-[10px] text-muted">so&apos;m</div>}
    </div>
  );
}

/* ═══ Bildirishnoma ═══ */
let audioCtx = null;

function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch { /* ovoz muhim emas */ }
}

function requestNotifyPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

function notify(title, body) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/logo-192.png' });
  } catch { /* ignore */ }
}
