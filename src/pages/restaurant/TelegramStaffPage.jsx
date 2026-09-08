import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { panelApi } from '@/api';

/*
 * ═══════════════════════════════════════════════════════════
 * SOZLAMALAR → TELEGRAM
 * ═══════════════════════════════════════════════════════════
 *
 * Restoran o'z xodimlarining Telegram akkauntlarini shu yerdan
 * boshqaradi: qo'shadi, ulash havolasini oladi, uzadi.
 *
 * ─── NIMA UCHUN TELEGRAM ID SO'RALMAYDI ───
 * Telegram User ID ni oddiy foydalanuvchi bilmaydi va uni
 * topish uchun alohida bot kerak. Shuning uchun admin faqat
 * username kiritadi (u ko'rinib turadi), ID ni esa bot
 * ulanish paytida O'ZI oladi.
 */
export function TelegramStaffPage() {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [linkFor, setLinkFor] = useState(null);
  const [err, setErr] = useState('');
  // Nusxa olingani KO'RINSIN — aks holda mijoz bosdimi yoki
  // yo'qmi bilmaydi va qayta-qayta bosaveradi
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['telegram-staff'],
    queryFn: () => panelApi.telegramStaffList(),
  });

  const staff = data?.staff || [];
  const botEnabled = data?.botEnabled;

  const addMut = useMutation({
    mutationFn: (u) => panelApi.telegramStaffAdd(u),
    onSuccess: () => {
      setUsername('');
      setErr('');
      qc.invalidateQueries({ queryKey: ['telegram-staff'] });
    },
    onError: (e) => setErr(e.message || 'Qo‘shib bo‘lmadi'),
  });

  const linkMut = useMutation({
    mutationFn: (id) => panelApi.telegramStaffLink(id),
    onSuccess: (r, id) => setLinkFor({ id, url: r.url }),
    onError: (e) => setErr(e.message || 'Havola olinmadi'),
  });

  const removeMut = useMutation({
    mutationFn: (id) => panelApi.telegramStaffRemove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram-staff'] }),
  });

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0 max-w-3xl">
      <h1 className="text-xl font-bold text-ink mb-1">Telegram</h1>
      <p className="text-sm text-muted mb-5">
        Xodimlar buyurtmalarni Telegram bot orqali qabul qilishi uchun.
        Panelga kirish shart emas.
      </p>

      {/*
        Bot sozlanmagan bo'lsa buni AYTAMIZ. Aks holda admin
        username qo'shib, havola chiqmaganda "nega ishlamayapti?"
        deb o'ylab qolardi.
      */}
      {botEnabled === false && (
        <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Telegram bot hali sozlanmagan. LokmaGo administratoriga murojaat qiling.
        </div>
      )}

      {/* ═══ QO'SHISH ═══ */}
      <div className="mb-6 p-4 rounded-2xl border border-line bg-surface">
        <label className="block text-xs font-semibold text-muted mb-1.5">
          Telegram username
        </label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-xl border border-line bg-canvas px-3">
            <span className="text-muted text-sm">@</span>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && username.trim() && addMut.mutate(username)}
              placeholder="MrEldorbek464"
              className="flex-1 bg-transparent py-2.5 px-1 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => addMut.mutate(username)}
            disabled={!username.trim() || addMut.isPending}
            className="px-5 rounded-xl bg-brand-400 text-brand-text text-sm font-semibold hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {addMut.isPending ? '...' : 'Qo‘shish'}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted">
          Xodimning Telegram username’i. U Telegram sozlamalarida ko‘rinadi.
        </p>

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </div>

      {/* ═══ RO'YXAT ═══ */}
      {isLoading && <p className="text-sm text-muted">Yuklanmoqda…</p>}

      {!isLoading && staff.length === 0 && (
        <div className="p-6 rounded-2xl border border-dashed border-line text-center">
          <p className="text-sm text-muted">
            Hali hech kim qo‘shilmagan. Yuqorida username kiriting.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {staff.map((s) => (
          <div
            key={s._id}
            className={`p-3.5 rounded-2xl border bg-surface transition-colors ${
              s.telegramUserId && s.isActive
                ? 'border-green-300 bg-green-50/40'
                : 'border-line'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink text-sm truncate">
                  @{s.username}
                </div>
                <div className="text-xs mt-1">
                  {s.telegramUserId && s.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Ulangan{s.firstName ? ` · ${s.firstName}` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-line" />
                      Ulanmagan
                    </span>
                  )}
                </div>
              </div>

              {s.telegramUserId && s.isActive ? (
                <button
                  onClick={() => {
                    if (confirm(`@${s.username} uzilsinmi? Unga yangi buyurtmalar kelmaydi.`)) {
                      removeMut.mutate(s._id);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg border border-line text-xs text-muted hover:bg-canvas hover:text-ink transition-colors whitespace-nowrap"
                >
                  Uzish
                </button>
              ) : (
                <button
                  onClick={() => linkMut.mutate(s._id)}
                  disabled={linkMut.isPending || botEnabled === false}
                  className="px-3.5 py-2 rounded-lg bg-brand-400 text-brand-text text-xs font-semibold hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {linkMut.isPending ? '...' : 'Ulash havolasi'}
                </button>
              )}
            </div>

            {/*
              Havola KO'RSATILADI, avtomatik ochilmaydi.
              Sabab: admin uni xodimga yuborishi kerak, o'zi
              bosishi emas — bosса, ADMIN akkaunti ulanib
              qolardi va bu chalkashlik bo'lardi.
            */}
            {linkFor?.id === s._id && (
              <div className="mt-3 p-3 rounded-xl bg-canvas border border-line">
                <p className="text-xs text-muted mb-2">
                  Shu havolani <b>@{s.username}</b> ga yuboring. U bosgach
                  Telegram bot ochiladi va ulanish tasdiqlanadi.
                  Havola 24 soat amal qiladi.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={linkFor.url}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-line bg-surface text-xs"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(linkFor.url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="px-3.5 rounded-lg bg-ink text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {copied ? '✓ Olindi' : 'Nusxa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {staff.length > 0 && (
        <p className="mt-5 text-xs text-muted leading-relaxed">
          Yangi buyurtma <b>barcha ulangan xodimlarga</b> yuboriladi.
          Kimdir qabul qilsa, qolganlarida ham holat yangilanadi.
        </p>
      )}
    </div>
  );
}
