import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api';

/*
 * ═══════════════════════════════════════════════════════════
 * MIJOZ ILOVASI — versiyalar, do'kon havolalari, buyurtmalar qayerdan
 * ═══════════════════════════════════════════════════════════
 *
 * Server: GET/PATCH /api/admin/app-config, GET /api/admin/stats/channels (faqat admin).
 * Ilova (lakmago-client lib/appUpdate.js):
 *   minimal versiyadan eski → "Yangilang" (yopib bo'lmaydi)
 *   do'konda yangisi bor → Android fonda yuklaydi, iPhone'da taklif (N kunda bir)
 * Do'kon havolalari — "Yangilash" va reklama oynasidagi "Ilovani yuklab olish" tugmalari uchun.
 */
const FIELD = 'inp !w-full min-w-0 max-w-full !text-base sm:!text-sm';
const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const CHANNEL_LABEL = {
  ios: ['iPhone ilova', 'ti-brand-apple'],
  android: ['Android ilova', 'ti-brand-android'],
  telegram: ['Telegram', 'ti-brand-telegram'],
  web: ['Sayt', 'ti-world'],
  unknown: ['Noma‘lum (eski ilova / belgisiz)', 'ti-help-circle'],
};
const RANGES = [[7, '7 kun'], [30, '30 kun'], [90, '90 kun']];

const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export function AppSettingsPage() {
  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-semibold text-ink">Mijoz ilovasi</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">Yangilanish, do‘kon havolalari va buyurtmalar qayerdan kelayotgani</p>
      </div>
      <ChannelStats />
      <AppConfigForm />
    </div>
  );
}

function ChannelStats() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    setData(null); setErr(null);
    adminApi.getChannelStats(ymd(from), ymd(to))
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [days]);

  const rows = data?.channels || [];
  const total = rows.reduce((s, r) => s + r.orders, 0);
  const app = rows.filter((r) => r.channel === 'ios' || r.channel === 'android').reduce((s, r) => s + r.orders, 0);
  const appShare = total ? Math.round((app / total) * 100) : 0;

  return (
    <section className="mb-6" data-testid="channel-stats">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Buyurtmalar qayerdan</h2>
        <div className="flex gap-1">
          {RANGES.map(([d, l]) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === d ? 'bg-brand-400 text-brand-text' : 'bg-canvas text-muted'}`}>{l}</button>
          ))}
        </div>
      </div>

      {err ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Yuklab bo‘lmadi: {err}</div>
      ) : !data ? (
        <div className="py-6 text-center text-sm text-muted">Yuklanmoqda...</div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">Bu davrda buyurtma yo‘q</div>
      ) : (
        <>
          <div className="mb-3 rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs text-muted">Ilova orqali (iPhone + Android)</div>
            <div className="mt-1 text-2xl font-bold text-ink">{appShare}% <span className="text-sm font-medium text-muted">· {app} / {total} ta buyurtma</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-400" style={{ width: `${appShare}%` }} /></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Kanal</th>
                  <th className="px-3 py-2.5 text-right font-medium">Buyurtma</th>
                  <th className="px-3 py-2.5 text-right font-medium">Yetkazildi</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tushum</th>
                  <th className="px-3 py-2.5 text-right font-medium">Mijozlar</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sovg‘a bilan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const [label, icon] = CHANNEL_LABEL[r.channel] || [r.channel, 'ti-point'];
                  return (
                    <tr key={r.channel} className="border-t border-line">
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink"><i className={`ti ${icon} mr-1.5 text-muted`} />{label}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-ink">{r.orders}</td>
                      <td className="px-3 py-2.5 text-right text-ink">{r.delivered}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink">{som(r.revenue)} so‘m</td>
                      <td className="px-3 py-2.5 text-right text-ink">{r.customers}</td>
                      <td className="px-4 py-2.5 text-right text-ink">{r.withGift}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Kanal belgisi bu funksiya ishga tushgandan keyingi buyurtmalarda bor. “Noma‘lum” — undan oldingi buyurtmalar va yangilanmagan ilova.
          </p>
        </>
      )}
    </section>
  );
}

function AppConfigForm() {
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    adminApi.getAppConfig().then((d) => { setF(d); setSaved(d); }).catch((e) => setMsg({ err: true, text: e.message }));
  }, []);

  const problems = useMemo(() => {
    if (!f) return null;
    for (const [k, l] of [['iosMinVersion', 'iOS'], ['androidMinVersion', 'Android']]) {
      if (f[k] && !VERSION_RE.test(f[k].trim())) return `${l} minimal versiyasi noto‘g‘ri (masalan 1.2.0)`;
    }
    if (f.iosStoreUrl && !/^https:\/\/apps\.apple\.com\//i.test(f.iosStoreUrl.trim())) return 'App Store havolasi https://apps.apple.com/… bo‘lishi kerak';
    if (f.androidStoreUrl && !/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/i.test(f.androidStoreUrl.trim())) return 'Google Play havolasi https://play.google.com/store/apps/details?id=… bo‘lishi kerak';
    return null;
  }, [f]);

  if (!f) return msg ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg.text}</div> : null;

  const forceChanged = saved && (f.iosMinVersion !== saved.iosMinVersion || f.androidMinVersion !== saved.androidMinVersion) && (f.iosMinVersion || f.androidMinVersion);

  const save = async () => {
    if (problems) { setMsg({ err: true, text: problems }); return; }
    if (forceChanged && !window.confirm('Minimal versiyadan eski ilovalar bloklanadi: mijoz yangilamaguncha buyurtma bera olmaydi. Davom etasizmi?')) return;
    setBusy(true); setMsg(null);
    try {
      const d = await adminApi.updateAppConfig({
        iosMinVersion: f.iosMinVersion.trim(), androidMinVersion: f.androidMinVersion.trim(),
        iosStoreUrl: f.iosStoreUrl.trim(), androidStoreUrl: f.androidStoreUrl.trim(),
        updatePromptDays: Number(f.updatePromptDays) || 3,
      });
      setF(d); setSaved(d);
      setMsg({ text: 'Saqlandi. Ilovalarga 1 daqiqa ichida yetib boradi.' });
    } catch (e) { setMsg({ err: true, text: e.message }); }
    setBusy(false);
  };

  return (
    <section className="space-y-5" data-testid="app-config">
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Do‘kon havolalari</h2>
        <p className="mt-0.5 text-xs text-muted">“Yangilash” va reklama oynasidagi “Ilovani yuklab olish” tugmasi shu yerga olib boradi.</p>
        <div className="mt-3 grid gap-3">
          <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">App Store (iPhone)</span>
            <input className={FIELD} value={f.iosStoreUrl} onChange={set('iosStoreUrl')} placeholder="https://apps.apple.com/uz/app/lokma-go/id1234567890" inputMode="url" autoCapitalize="none" />
          </label>
          <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Google Play (Android)</span>
            <input className={FIELD} value={f.androidStoreUrl} onChange={set('androidStoreUrl')} placeholder="https://play.google.com/store/apps/details?id=lokma.uz" inputMode="url" autoCapitalize="none" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Majburiy yangilash</h2>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          Shu versiyadan <b>eski</b> ilova ochilganda yopib bo‘lmaydigan “Ilovani yangilang” oynasi chiqadi. Faqat eski versiya serverda
          ishlamay qolganda qo‘ying. Bo‘sh — majburiy emas (yangi versiya chiqsa faqat taklif qilinadi).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">iPhone — minimal versiya</span>
            <input className={FIELD} value={f.iosMinVersion} onChange={set('iosMinVersion')} placeholder="masalan 1.2.0" inputMode="decimal" />
          </label>
          <label className="block min-w-0"><span className="mb-1 block text-xs text-muted">Android — minimal versiya</span>
            <input className={FIELD} value={f.androidMinVersion} onChange={set('androidMinVersion')} placeholder="masalan 1.2.0" inputMode="decimal" />
          </label>
        </div>
        <label className="mt-3 block max-w-xs"><span className="mb-1 block text-xs text-muted">Yangi versiya taklifini necha kunda bir eslatish (iPhone)</span>
          <input className={FIELD} value={f.updatePromptDays} onChange={set('updatePromptDays')} inputMode="numeric" />
        </label>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          Android’da yangi versiya Google Play orqali fonda o‘zi yuklanadi, tayyor bo‘lgach mijozga “Qayta ishga tushirish” chiqadi. iPhone’da Apple
          ilovaga o‘zini yangilashga ruxsat bermaydi — App Store’ni ochadigan taklif chiqadi (telefonda avtomatik yangilash yoqilgan bo‘lsa, tizimning o‘zi yangilaydi).
        </p>
      </div>

      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.err ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>}
      <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-50">
        {busy ? 'Saqlanmoqda…' : 'Saqlash'}
      </button>
    </section>
  );
}
