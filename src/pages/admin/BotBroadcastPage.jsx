import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';

/*
 * ═══════════════════════════════════════════════════════════
 * RESTORAN BOTLARI
 * ═══════════════════════════════════════════════════════════
 *
 * Botga ulangan restoranlar, ularga xabar yuborish va natija.
 *
 * ⚠ TELEGRAM CHEKLOVI: "xabarni o'qidi" ma'lumotini bermaydi.
 * Shuning uchun uch holat ko'rsatiladi:
 *   Yetkazildi — Telegram qabul qildi
 *   Yetmadi    — bot bloklangan yoki chat yo'q
 *   Bosdi      — tugma bosilgan (kim, qaysi tugma)
 *
 * Bu sahifa alohida — mavjud bo'limlarga tegmaydi.
 */

const fmtDate = (d) => (d
  ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

const STATUS = {
  draft: { label: 'Qoralama', cls: 'bg-canvas text-muted' },
  sending: { label: 'Yuborilmoqda…', cls: 'bg-amber-50 text-amber-700' },
  sent: { label: 'Yuborildi', cls: 'bg-green-50 text-green-700' },
  failed: { label: 'Xato', cls: 'bg-red-50 text-red-600' },
};

export function BotBroadcastPage() {
  const [tab, setTab] = useState('new');
  const [restaurants, setRestaurants] = useState([]);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Yangi xabar
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('html');
  const [target, setTarget] = useState('all');
  const [picked, setPicked] = useState([]);
  const [buttons, setButtons] = useState([]);
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.botRestaurants(), adminApi.botBroadcasts()])
      .then(([r, h]) => { setRestaurants(r); setHistory(h); })
      .catch((e) => setMsg({ type: 'err', text: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  /*
   * "Yuborilmoqda" holatidagi xabar bor bo'lsa ro'yxat o'zi
   * yangilanadi — admin sahifani qayta ochishi shart emas.
   */
  useEffect(() => {
    if (!history.some((b) => b.status === 'sending')) return undefined;
    const id = setInterval(() => {
      adminApi.botBroadcasts().then(setHistory).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [history]);

  const activeStaff = useMemo(
    () => restaurants.reduce((s, r) => s + r.staffCount, 0),
    [restaurants],
  );

  const recipients = useMemo(() => {
    if (target === 'all') return activeStaff;
    return restaurants
      .filter((r) => picked.includes(String(r._id)))
      .reduce((s, r) => s + r.staffCount, 0);
  }, [target, picked, restaurants, activeStaff]);

  const addButton = () => {
    if (buttons.length >= 6) return;
    setButtons((b) => [...b, { text: '', kind: 'callback', url: '' }]);
  };
  const setButton = (i, patch) => setButtons((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeButton = (i) => setButtons((b) => b.filter((_, j) => j !== i));

  const send = async () => {
    if (!text.trim()) { setMsg({ type: 'err', text: 'Matn bo‘sh' }); return; }
    if (target === 'selected' && !picked.length) {
      setMsg({ type: 'err', text: 'Kamida bitta restoran tanlang' }); return;
    }
    const bad = buttons.find((b) => !b.text.trim() || (b.kind === 'url' && !/^https?:\/\//i.test(b.url)));
    if (bad) { setMsg({ type: 'err', text: 'Tugma matni yoki havolasi to‘g‘ri emas' }); return; }

    setSending(true);
    setMsg(null);
    try {
      await adminApi.createBotBroadcast({
        title: title.trim(), text: text.trim(), format, target,
        restaurantIds: target === 'selected' ? picked : [],
        buttons: buttons.map((b) => ({
          text: b.text.trim(), kind: b.kind, url: b.kind === 'url' ? b.url.trim() : '',
        })),
      });
      setText(''); setTitle(''); setButtons([]); setPicked([]);
      setMsg({ type: 'ok', text: 'Yuborildi — natijani "Tarix" bo‘limida ko‘ring' });
      setTab('history');
      load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setSending(false);
    }
  };

  const openDetail = async (id) => {
    try {
      setDetail(await adminApi.botBroadcastDetail(id));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Bu xabar tarixdan o‘chirilsinmi?')) return;
    try {
      await adminApi.deleteBotBroadcast(id);
      setDetail(null);
      load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-ink">Restoran botlari</h1>
      <p className="text-sm text-muted mt-1">
        Botga ulangan restoranlar va ularga xabar yuborish
      </p>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Restoranlar" value={restaurants.length} />
        <Stat label="Ulangan xodimlar" value={activeStaff} />
        <Stat label="Yuborilgan xabarlar" value={history.length} />
      </div>

      <div className="flex gap-1 mt-5 border-b border-line">
        {[['new', 'Yangi xabar'], ['restaurants', 'Restoranlar'], ['history', 'Tarix']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px ${
              tab === k ? 'border-brand-400 text-brand-600 font-medium' : 'border-transparent text-muted'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mt-4 text-sm rounded-lg px-3 py-2 ${
          msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {msg.text}
        </div>
      )}

      {loading && <div className="mt-6 text-sm text-muted">Yuklanmoqda…</div>}

      {/* ═══ YANGI XABAR ═══ */}
      {!loading && tab === 'new' && (
        <div className="mt-5 space-y-4">
          <Box label="Sarlavha" hint="Faqat sizga ko‘rinadi, xabarga kirmaydi">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Yangi yil ish vaqti" className="inp" />
          </Box>

          <Box label="Xabar matni" hint={format === 'html'
            ? 'Qalin: <b>matn</b> · Qiya: <i>matn</i> · Havola: <a href="...">matn</a>'
            : 'Oddiy matn — belgilar o‘zgartirilmaydi'}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
              placeholder="Assalomu alaykum! Ertaga..." className="inp resize-none" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2">
                {[['html', 'HTML'], ['none', 'Oddiy']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFormat(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      format === k ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-line text-muted'
                    }`}>{l}</button>
                ))}
              </div>
              <span className={`text-xs ${text.length > 3500 ? 'text-red-600' : 'text-muted'}`}>
                {text.length} / 3500
              </span>
            </div>
          </Box>

          <Box label="Tugmalar" hint="Kim bosgani sanaladi. Eng ko‘pi 6 ta">
            {buttons.map((b, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={b.text} onChange={(e) => setButton(i, { text: e.target.value })}
                  placeholder="✅ Tasdiqlayman" className="inp flex-1" />
                <select value={b.kind} onChange={(e) => setButton(i, { kind: e.target.value })}
                  className="inp w-32">
                  <option value="callback">Javob</option>
                  <option value="url">Havola</option>
                </select>
                {b.kind === 'url' && (
                  <input value={b.url} onChange={(e) => setButton(i, { url: e.target.value })}
                    placeholder="https://..." className="inp flex-1" />
                )}
                <button type="button" onClick={() => removeButton(i)}
                  className="px-3 text-muted hover:text-red-600">✕</button>
              </div>
            ))}
            {buttons.length < 6 && (
              <button type="button" onClick={addButton}
                className="text-sm text-brand-600 mt-1">+ Tugma qo‘shish</button>
            )}
            {buttons.some((b) => b.kind === 'url') && (
              <p className="text-xs text-muted mt-2">
                Havola tugmasining bosilishini Telegram sanamaydi — statistikada
                faqat «Javob» turidagi tugmalar ko‘rinadi.
              </p>
            )}
          </Box>

          <Box label="Kimga">
            <div className="grid grid-cols-2 gap-2">
              {[['all', 'Hammasiga'], ['selected', 'Tanlanganlarga']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTarget(k)}
                  className={`py-2.5 rounded-xl text-sm border ${
                    target === k ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-line text-muted'
                  }`}>{l}</button>
              ))}
            </div>

            {target === 'selected' && (
              <div className="mt-3 max-h-64 overflow-auto border border-line rounded-xl divide-y divide-line">
                {restaurants.map((r) => {
                  const on = picked.includes(String(r._id));
                  return (
                    <button key={r._id} type="button"
                      onClick={() => setPicked((p) => (on
                        ? p.filter((x) => x !== String(r._id))
                        : [...p, String(r._id)]))}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${
                        on ? 'bg-brand-50' : ''
                      }`}>
                      <span className="text-sm text-ink">{r.name}</span>
                      <span className="text-xs text-muted">
                        {r.staffCount} xodim {on && '✓'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-sm text-muted mt-3">
              Oluvchilar: <b className="text-ink">{recipients}</b> xodim
            </p>
          </Box>

          <button type="button" onClick={send} disabled={sending || !recipients}
            className="w-full py-3.5 rounded-xl bg-brand text-white font-semibold disabled:opacity-50">
            {sending ? 'Yuborilmoqda…' : `Yuborish (${recipients})`}
          </button>
        </div>
      )}

      {/* ═══ RESTORANLAR ═══ */}
      {!loading && tab === 'restaurants' && (
        <div className="mt-5 space-y-2">
          {!restaurants.length && (
            <p className="text-sm text-muted">Botga ulangan restoran yo‘q.</p>
          )}
          {restaurants.map((r) => (
            <div key={r._id} className="border border-line rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{r.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  r.isActive ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
                }`}>
                  {r.isActive ? 'Faol' : 'Nofaol'}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {r.staff.map((s, i) => (
                  <div key={i} className="flex justify-between text-xs text-muted">
                    <span>{s.name || 'Nomsiz'}</span>
                    <span>
                      ulandi {fmtDate(s.connectedAt)}
                      {s.lastActionAt && ` · oxirgi amal ${fmtDate(s.lastActionAt)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ TARIX ═══ */}
      {!loading && tab === 'history' && (
        <div className="mt-5 space-y-2">
          {!history.length && <p className="text-sm text-muted">Hali xabar yuborilmagan.</p>}
          {history.map((b) => {
            const st = STATUS[b.status] || STATUS.draft;
            return (
              <button key={b._id} type="button" onClick={() => openDetail(b._id)}
                className="w-full text-left border border-line rounded-xl p-3 hover:bg-canvas">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink truncate">
                    {b.title || b.text.slice(0, 40)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <div className="text-xs text-muted mt-1.5">
                  {fmtDate(b.sentAt || b.createdAt)} ·{' '}
                  Yetkazildi {b.stats?.sent || 0}
                  {b.stats?.failed ? ` · Yetmadi ${b.stats.failed}` : ''}
                  {b.buttons?.length ? ` · Bosdi ${b.stats?.clicked || 0}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ TAFSILOT ═══ */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50"
          onClick={() => setDetail(null)}>
          <div className="bg-surface w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl p-4 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">
                  {detail.broadcast.title || 'Xabar'}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {fmtDate(detail.broadcast.sentAt || detail.broadcast.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-muted px-2">✕</button>
            </div>

            <div className="mt-3 text-sm bg-canvas rounded-xl p-3 whitespace-pre-wrap text-ink">
              {detail.broadcast.text}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="Yetkazildi" value={detail.summary.sent} />
              <Stat label="Yetmadi" value={detail.summary.failed} />
              <Stat label="Bosdi" value={detail.summary.clicked} />
            </div>

            {detail.byButton.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-ink mb-2">Tugmalar bo‘yicha</div>
                {detail.byButton.map((b) => (
                  <div key={b.key} className="flex justify-between text-sm py-1.5 border-b border-line">
                    <span className="text-ink">{b.text}</span>
                    <b className="text-brand-600">{b.count}</b>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <div className="text-sm font-medium text-ink mb-2">Oluvchilar</div>
              <div className="space-y-1">
                {detail.deliveries.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-line">
                    <span className="text-ink truncate">
                      {d.restaurantName} · {d.staffName || '—'}
                    </span>
                    <span className={d.status === 'sent' ? 'text-muted' : 'text-red-600'}>
                      {d.clickedAt
                        ? `✅ bosdi ${fmtDate(d.clickedAt)}`
                        : d.status === 'sent' ? 'yetkazildi' : `yetmadi: ${d.error.slice(0, 30)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => remove(detail.broadcast._id)}
              className="mt-4 text-sm text-red-600">Tarixdan o‘chirish</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-line rounded-xl p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold text-ink mt-0.5">{value}</div>
    </div>
  );
}

function Box({ label, hint, children }) {
  return (
    <div>
      <div className="text-sm font-medium text-ink mb-1.5">{label}</div>
      {children}
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}
