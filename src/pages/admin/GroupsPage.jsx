import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/api';

export function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.getGroups();
      setGroups(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await adminApi.runGroupCheck();
      alert(`Tekshirildi: ${r.checked} guruh, ${r.fixed} tuzatildi`);
      load();
    } catch (e) { alert(e.message); }
    finally { setChecking(false); }
  };

  const resend = async (chatId) => {
    setBusyId(chatId);
    try {
      await adminApi.resendGroupPromo(chatId);
      load();
    } catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Telegram guruhlar</h1>
          <p className="text-sm text-muted mt-0.5">Bot admin qilingan guruhlar — reklama va pin holati</p>
        </div>
        <button onClick={runCheck} disabled={checking} className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
          <i className="ti ti-refresh" /> {checking ? 'Tekshirilmoqda...' : 'Hozir tekshirish'}
        </button>
      </div>

      {/* Yo'riqnoma */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-5 text-sm text-ink">
        <div className="font-medium mb-1 flex items-center gap-1.5"><i className="ti ti-info-circle text-brand-600" /> Qanday ishlaydi?</div>
        <p className="text-muted leading-relaxed">
          Botni Telegram guruhга <b>admin</b> qiling. Bot avtomatik ravishda reklama xabarini yuboradi va tepaga <b>pin</b> qiladi.
          Har kuni tekshiriladi — agar xabar yoki pin yo'qolган bo'lsa, qayta yuboradi. Foydalanuvchilar tugmani bosib ilovaga o'tadi.
        </p>
      </div>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Hali birorta guruhга qo'shilmagansiz. Botni guruhга admin qiling — shu yerda ko'rinadi.
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div key={g.chatId} className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-none">
                <i className="ti ti-users text-brand-text text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{g.title || 'Guruh'}</div>
                <div className="flex items-center gap-3 mt-1 text-[11px]">
                  {g.isBotAdmin
                    ? <span className="text-green-600"><i className="ti ti-shield-check" /> Bot admin</span>
                    : <span className="text-red-500"><i className="ti ti-shield-x" /> Admin emas</span>}
                  {g.promoSentAt
                    ? <span className="text-green-600"><i className="ti ti-send" /> Yuborilgan</span>
                    : <span className="text-muted"><i className="ti ti-send-off" /> Yuborilmagan</span>}
                  {g.isPinned
                    ? <span className="text-green-600"><i className="ti ti-pin" /> Pin qilingan</span>
                    : <span className="text-amber-600"><i className="ti ti-pin" /> Pin yo'q</span>}
                </div>
                {g.lastCheckedAt && (
                  <div className="text-[10px] text-muted mt-0.5">
                    Oxirgi tekshiruv: {new Date(g.lastCheckedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <button
                onClick={() => resend(g.chatId)}
                disabled={busyId === g.chatId || !g.isBotAdmin}
                className="px-3 py-2 border border-line rounded-lg text-sm text-muted hover:bg-canvas disabled:opacity-40 flex-none"
                title={g.isBotAdmin ? 'Reklamani qayta yuborish + pin' : 'Bot admin emas'}
              >
                {busyId === g.chatId ? '...' : 'Qayta yuborish'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
