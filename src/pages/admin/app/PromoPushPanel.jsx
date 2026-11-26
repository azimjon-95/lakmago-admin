import { useEffect, useState } from 'react';
import { adminApi } from '@/api';

/*
 * TAOM TAKLIFLARI PUSH'I — mijoz ilovasi (lakmago-server services/promoPush.js)
 * Kuniga ko'pi bilan 2 ta: tushlik va kechki oyna. Standart o'chiq.
 * Avval «Sinov push» bilan o'z telefoningizga yuborib ko'ring, keyin yoqing.
 */
const FIELD = 'inp !w-full min-w-0 max-w-full !text-base sm:!text-sm';
const LANGS = [['uz', 'O‘zbekcha'], ['uzc', 'Ўзбекча'], ['ru', 'Русский']];

function Stat({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-canvas px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-ink">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function PromoPushPanel() {
  const [data, setData] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState('uz');
  const [preview, setPreview] = useState(null);
  const [phone, setPhone] = useState('');
  const [test, setTest] = useState(null);

  const load = () => adminApi.getPromoPush()
    .then((d) => { setData(d); setF(d.settings); })
    .catch((e) => setMsg({ err: true, text: e.message }));
  useEffect(() => { load(); }, []);

  if (!data || !f) {
    return msg ? <div className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg.text}</div> : null;
  }
  const { stats } = data;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async (patch) => {
    setBusy(true); setMsg(null);
    try {
      const d = await adminApi.updatePromoPush({ ...f, ...patch });
      setF(d.settings);
      setData((s) => ({ ...s, settings: d.settings }));
      setMsg({ text: patch?.enabled === true ? 'Yoqildi. Keyingi oynada yuborila boshlaydi.' : patch?.enabled === false ? 'O‘chirildi.' : 'Saqlandi.' });
    } catch (e) { setMsg({ err: true, text: e.message }); }
    setBusy(false);
  };

  const toggle = () => {
    if (!f.enabled && !window.confirm(`Ilovada rozilik bergan ${stats.reachable} ta qurilmaga kuniga 2 tadan taom taklifi yuboriladi. Yoqasizmi?`)) return;
    save({ enabled: !f.enabled });
  };

  const loadPreview = async (l = lang) => {
    setPreview({ loading: true });
    try { setPreview(await adminApi.previewPromoPush({ lang: l, count: 6 })); }
    catch (e) { setPreview({ error: e.message }); }
  };

  const sendTest = async () => {
    setTest({ loading: true });
    try { setTest(await adminApi.testPromoPush({ phone })); }
    catch (e) { setTest({ error: e.message }); }
  };

  const noProvider = !stats.providers?.android && !stats.providers?.ios;
  const today = stats.today;
  const sentToday = today.lunch.sent + today.dinner.sent;
  const openedToday = today.lunch.opened + today.dinner.opened;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4 sm:p-5" data-testid="promo-push">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Taom takliflari (push)</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            Ilovaga rozilik bergan mijozlarga kuniga ko‘pi bilan 2 ta xabar: tushlik va kechki ovqat paytida, ochiq restorandagi taom bilan.
            Bir matn 14 kun, bir taom 7 kun ichida takrorlanmaydi. Bosilganda ilovada o‘sha taom ochiladi.
          </p>
        </div>
        <button
          type="button" onClick={toggle} disabled={busy || noProvider}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${f.enabled ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-brand-400 text-brand-text'}`}
        >
          {f.enabled ? 'Yoqilgan · o‘chirish' : 'Yoqish'}
        </button>
      </div>

      {noProvider && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Serverda FCM (Android) va APNs (iOS) kalitlari sozlanmagan — yuborib bo‘lmaydi. Yo‘riqnoma: lakmago-client/docs/PUSH-TAKLIFLAR.md
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Rozi qurilmalar" value={stats.reachable} hint={`Android ${stats.platforms.android.on} · iPhone ${stats.platforms.ios.on}`} />
        <Stat label="Bugun yuborildi" value={sentToday} hint={`tushlik ${today.lunch.sent} · kechki ${today.dinner.sent}`} />
        <Stat label="Bugun ochildi" value={openedToday} hint={sentToday ? `${Math.round((openedToday / sentToday) * 100)}%` : '—'} />
        <Stat label="7 kunda ochilish" value={`${stats.week.ctr}%`} hint={`${stats.week.opened} / ${stats.week.sent}`} />
      </div>
      {(today.lunch.failed + today.dinner.failed > 0 || today.lunch.skipped + today.dinner.skipped > 0) && (
        <p className="mt-2 text-[11px] text-muted">
          Bugun xato: {today.lunch.failed + today.dinner.failed} · mos taom topilmadi: {today.lunch.skipped + today.dinner.skipped}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="min-w-0 rounded-xl border border-line p-3">
          <legend className="px-1 text-xs text-muted">Tushlik oynasi</legend>
          <div className="flex items-center gap-2">
            <input className={FIELD} type="time" value={f.lunchFrom} onChange={set('lunchFrom')} aria-label="Tushlik boshlanishi" />
            <span className="text-muted">–</span>
            <input className={FIELD} type="time" value={f.lunchTo} onChange={set('lunchTo')} aria-label="Tushlik tugashi" />
          </div>
        </fieldset>
        <fieldset className="min-w-0 rounded-xl border border-line p-3">
          <legend className="px-1 text-xs text-muted">Kechki oyna</legend>
          <div className="flex items-center gap-2">
            <input className={FIELD} type="time" value={f.dinnerFrom} onChange={set('dinnerFrom')} aria-label="Kechki boshlanishi" />
            <span className="text-muted">–</span>
            <input className={FIELD} type="time" value={f.dinnerTo} onChange={set('dinnerTo')} aria-label="Kechki tugashi" />
          </div>
        </fieldset>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Toshkent vaqti. Har qurilmaga oyna ichida o‘z daqiqasi tanlanadi — hammaga bir paytda ketmaydi.</p>
      <button type="button" onClick={() => save({})} disabled={busy} className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-50">
        Vaqtni saqlash
      </button>

      {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.err ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-ink">Namuna xabarlar</h3>
          <div className="flex gap-1">
            {LANGS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setLang(k); loadPreview(k); }}
                className={`rounded-lg px-2.5 py-1 text-xs ${lang === k && preview ? 'bg-ink text-white' : 'bg-canvas text-ink'}`}>{l}</button>
            ))}
          </div>
        </div>
        {!preview && (
          <button type="button" onClick={() => loadPreview()} className="mt-2 text-xs font-medium text-brand-600">Ko‘rsatish</button>
        )}
        {preview?.loading && <p className="mt-2 text-xs text-muted">Yuklanmoqda…</p>}
        {preview?.error && <p className="mt-2 text-xs text-red-600">{preview.error}</p>}
        {preview?.items && (
          preview.items.length === 0
            ? <p className="mt-2 text-xs text-muted">Taklif qiladigan taom topilmadi.</p>
            : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {preview.items.map((it) => (
                  <li key={it.templateId + it.url} className="min-w-0 rounded-xl bg-canvas px-3 py-2.5">
                    <div className="text-[13px] font-semibold text-ink">{it.title}</div>
                    <div className="mt-0.5 text-xs leading-snug text-ink/80">{it.body}</div>
                    <div className="mt-1 truncate text-[11px] text-muted">{it.restaurant} · {it.dish} · #{it.templateId}</div>
                  </li>
                ))}
              </ul>
            )
        )}
        {preview?.items && <p className="mt-1.5 text-[11px] text-muted">{preview.candidates} ta taomdan tanlanmoqda. Har bosishda boshqacha.</p>}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-xs font-semibold text-ink">Sinov push</h3>
        <p className="mt-0.5 text-[11px] text-muted">Mijozning telefon raqami — uning ilovasi (rozilik bergan) qurilmalariga hozir bitta taklif ketadi. Kunlik hisobga kirmaydi.</p>
        <div className="mt-2 flex max-w-md gap-2">
          <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" />
          <button type="button" onClick={sendTest} disabled={!phone.trim() || test?.loading}
            className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {test?.loading ? 'Yuborilmoqda…' : 'Yuborish'}
          </button>
        </div>
        {test?.error && <p className="mt-2 text-xs text-red-600">{test.error}</p>}
        {test?.results && (
          <ul className="mt-2 space-y-1">
            {test.results.map((r, i) => (
              <li key={i} className={`text-xs ${r.ok ? 'text-green-700' : 'text-red-600'}`}>
                {r.platform === 'ios' ? 'iPhone' : 'Android'}: {r.ok ? `yuborildi — “${r.title}”` : `xato — ${r.error}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
