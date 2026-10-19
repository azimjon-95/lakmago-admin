import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/api';

/*
 * ═══ BAZA ZAXIRASI — HOLAT KARTASI (Sozlamalar) ═══
 * Server har kuni 23:59 (Toshkent) da butun bazani Telegram guruhiga JSON qilib yuboradi. Guruhga fayl kelmay qolsa,
 * sababi shu yerda ko'rinadi (serverga kirmasdan, telefondan). "Hozir zaxira olish" — darhol yuboradi.
 */
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const mb = (b) => `${((Number(b) || 0) / 1024 / 1024).toFixed(1)} MB`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const STATUS = {
  sent: ['Yuborildi', 'bg-green-50 text-green-700'],
  failed: ['Xato', 'bg-red-50 text-red-600'],
  running: ['Bajarilmoqda', 'bg-amber-50 text-amber-700'],
};
const TRIGGER = { schedule: '23:59', catchup: 'kechikkan', late: 'kechikkan', manual: 'qo‘lda' };

export function BackupCard() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const load = useCallback(async () => {
    setErr('');
    try { setSt(await adminApi.getBackupStatus()); } catch (e) { setErr(e.message || 'Holatni olib bo‘lmadi'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await adminApi.runBackup();
      setMsg({ ok: true, text: `Zaxira guruhga yuborildi (${num(r.documents)} hujjat). Telegram guruhini tekshiring.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Zaxira olinmadi' });
    } finally {
      setBusy(false);
      load();
    }
  };

  const problem = st?.problem;
  return (
    <section className="mb-4 min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <i className="ti ti-database-export text-brand-600" /> Baza zaxirasi
          </h2>
          <p className="text-xs text-muted">
            {st?.schedule || 'Har kuni 23:59 (Toshkent vaqti)'} · Telegram guruhi{st?.chat ? ` (${st.chat})` : ''}
          </p>
        </div>
        {st && (
          <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.enabled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {st.enabled ? 'Yoqilgan' : 'O‘chiq'}
          </span>
        )}
      </div>

      {err && <div role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}
      {!st && !err && <div className="mt-3 h-16 animate-pulse rounded-xl bg-canvas" />}

      {st && (
        <>
          <div className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[13px] leading-snug text-ink">
            {st.last
              ? <>So‘nggi muvaffaqiyatli zaxira: <b>{fmtDate(st.last.sentAt)}</b><br /><span className="text-muted">{num(st.last.documents)} hujjat · {num(st.last.collections)} collection · {mb(st.last.bytes)}{st.last.gzip ? ' (gzip)' : ''}</span></>
              : <>Hali birorta muvaffaqiyatli zaxira yo‘q.</>}
          </div>

          {problem && (
            <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-snug text-amber-900">
              <div className="font-semibold">Diqqat</div>
              <div>{problem}</div>
              {st.lastError && <div className="mt-1.5 break-words text-xs text-amber-800/90">So‘nggi xato: <b>{st.lastError}</b></div>}
            </div>
          )}
          {st.chatMigrated && (
            <div className="mt-3 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs leading-snug text-blue-900">
              Telegram guruhi supergruppaga aylangan — zaxira yangi guruh ID siga yuborilmoqda. Serverdagi <code>.env</code> da <code>BACKUP_GROUP_CHAT_ID</code> ni yangilang.
            </div>
          )}

          <button onClick={run} disabled={busy || !st.enabled}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 text-sm font-semibold text-brand-text active:opacity-80 disabled:opacity-40">
            <i className={`ti ${busy ? 'ti-loader-2 animate-spin' : 'ti-cloud-upload'}`} />
            {busy ? 'Zaxira olinmoqda… (bir necha soniya)' : 'Hozir zaxira olish'}
          </button>
          {msg && (
            <div role="status" className={`mt-2 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
          )}

          {st.recent?.length > 0 && (
            <div className="mt-4 min-w-0">
              <div className="mb-1.5 text-xs font-semibold text-muted">So‘nggi urinishlar</div>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {st.recent.map((r) => {
                  const [label, cls] = STATUS[r.status] || ['—', 'bg-gray-100 text-gray-600'];
                  return (
                    <li key={r.ymd + r.at} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-ink">{r.ymd.slice(0, 10)} <span className="font-normal text-muted">· {TRIGGER[r.trigger] || r.trigger}{r.attempts > 1 ? ` · ${r.attempts}-urinish` : ''}</span></span>
                        <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                      </div>
                      {r.status === 'failed' && r.error && <div className="mt-1 break-words text-xs text-red-600">{r.error}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
