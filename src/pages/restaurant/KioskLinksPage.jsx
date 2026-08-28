import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { confirm } from '@/components/ui/confirm';
import { useTempFlag, useTempValue } from '@/hooks/useTempFlag';

/* ═══════════════════════════════════════════════════
   Kiosk linklar — zaldagi planshet uchun.

   Ofitsiant akkauntidan farqi:
     Ofitsiant — SHAXS (login/parol, o'z stollari, o'z daromadi).
     Kiosk     — QURILMA (link + PIN, restoran nomidan ishlaydi).

   Shuning uchun alohida sahifa: ikkisini bir joyga qo'shsak
   "kimning daromadi?" degan savol chalkashadi.
   ═══════════════════════════════════════════════════ */

const SECTIONS = [
  ['tables', 'Stollar', 'ti-armchair'],
  ['menu', 'Menyu / buyurtma', 'ti-book'],
  ['stoplist', 'Stop List', 'ti-ban'],
];

const STATUS = {
  active: { label: 'Faol', cls: 'bg-green-50 text-green-700' },
  expired: { label: 'Muddat tugagan', cls: 'bg-amber-50 text-amber-700' },
  disabled: { label: "O'chirilgan", cls: 'bg-slate-100 text-slate-600' },
};

const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

const fmtWhen = (d) => {
  if (!d) return 'Hali ishlatilmagan';
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
};

export function KioskLinksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);    // 'new' | obyekt
  const [created, setCreated] = useState(null);    // yangi link + PIN
  const [qrFor, setQrFor] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(await panelApi.getKioskLinks());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item) => {
    // Darhol ko'rsatamiz — javob kutib turmaymiz
    setItems((prev) => prev.map((x) => (
      x._id === item._id ? { ...x, isActive: !x.isActive } : x
    )));
    try {
      await panelApi.updateKioskLink(item._id, { isActive: !item.isActive });
      load();
    } catch (e) {
      load();
      alert(e.message);
    }
  };

  const rotate = async (item) => {
    const ok = await confirm({
      title: 'Token yangilansinmi?',
      content: 'Eski havola DARHOL ishlamay qoladi. '
        + 'Barcha planshetlarga yangi link kiritish kerak bo‘ladi.',
      tone: 'warning',
      okText: 'Yangilash',
    });
    if (!ok) return;

    try {
      const fresh = await panelApi.rotateKioskLink(item._id);
      setCreated({ ...fresh, rotated: true });
      load();
    } catch (e) { alert(e.message); }
  };

  const resetDevices = async (item) => {
    const ok = await confirm({
      title: 'Qurilmalar uzilsinmi?',
      content: 'Bog‘langan planshetlar sahifani yangilagach qayta ulanadi.',
      tone: 'warning',
      okText: 'Uzish',
    });
    if (!ok) return;
    try { await panelApi.resetKioskDevices(item._id); load(); }
    catch (e) { alert(e.message); }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: 'Link o‘chirilsinmi?',
      content: 'Bu amalni qaytarib bo‘lmaydi.',
      tone: 'danger',
      okText: "O'chirish",
    });
    if (!ok) return;
    try { await panelApi.deleteKioskLink(item._id); load(); }
    catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-4 sm:p-6">

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Kiosk linklar</h1>
          <p className="mt-0.5 text-sm text-muted">
            Zaldagi planshet uchun — login yo‘q, faqat havola va PIN
          </p>
        </div>

        <button
          onClick={() => setEditing('new')}
          className="shrink-0 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-medium
                     text-brand-text transition hover:bg-brand-600 hover:text-white"
        >
          <i className="ti ti-plus mr-1.5" />
          Link yaratish
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Empty onCreate={() => setEditing('new')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <LinkCard
              key={item._id}
              item={item}
              onToggle={() => toggle(item)}
              onEdit={() => setEditing(item)}
              onRotate={() => rotate(item)}
              onResetDevices={() => resetDevices(item)}
              onRemove={() => remove(item)}
              onQr={() => setQrFor(item)}
              onCopy={async () => {
                try {
                  const full = await panelApi.revealKioskLink(item._id);
                  await navigator.clipboard.writeText(full.url);
                  return true;
                } catch (e) { alert(e.message); return false; }
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(res) => {
            setEditing(null);
            if (res?.token) setCreated(res);
            load();
          }}
        />
      )}

      {created && <CreatedModal data={created} onClose={() => setCreated(null)} />}
      {qrFor && <QrModal item={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

/* ═══ Bo'sh holat ═══ */
function Empty({ onCreate }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <i className="ti ti-device-tablet text-3xl text-brand-600" />
      </div>
      <div className="font-medium text-ink">Kiosk link yo‘q</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        Link yarating va planshetda oching — ofitsiant login qilmasdan
        stollar, menyu va Stop List bilan ishlaydi.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-medium text-brand-text
                   transition hover:bg-brand-600 hover:text-white"
      >
        Birinchi linkni yaratish
      </button>
    </div>
  );
}

/* ═══ Karta ═══ */
function LinkCard({
  item, onToggle, onEdit, onRotate, onResetDevices, onRemove, onQr, onCopy,
}) {
  const [copied, flashCopied] = useTempFlag(1800);
  const st = STATUS[item.status] || STATUS.disabled;

  const copy = async () => {
    if (await onCopy()) {
      flashCopied();
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4">

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">
            {item.label || 'Nomsiz planshet'}
          </div>
          <code className="mt-0.5 block text-xs text-muted">{item.tokenShort}</code>
        </div>

        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${st.cls}`}>
          {st.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SECTIONS.filter(([k]) => item.sections?.includes(k)).map(([k, label, icon]) => (
          <span key={k} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
            <i className={`ti ${icon} mr-1`} />{label}
          </span>
        ))}
      </div>

      <dl className="mt-3 space-y-1 text-[13px]">
        <Row label="Muddat" value={fmtDate(item.expiresAt)} />
        <Row label="Oxirgi foydalanish" value={fmtWhen(item.lastUsedAt)} />
        <Row
          label="Qurilmalar"
          value={item.deviceLimit > 0
            ? `${item.deviceCount} / ${item.deviceLimit}`
            : `${item.deviceCount} (cheksiz)`}
        />
        <Row label="Qulf" value={`${item.inactivitySec} soniya`} />
      </dl>

      <div className="mt-4 flex gap-1.5">
        <Action icon={copied ? 'ti-check' : 'ti-copy'} title="Nusxalash" onClick={copy} active={copied} />
        <Action icon="ti-qrcode" title="QR kod" onClick={onQr} />
        <Action icon="ti-pencil" title="Tahrirlash" onClick={onEdit} />
        <Action icon="ti-refresh" title="Tokenni yangilash" onClick={onRotate} />
        <Action icon="ti-devices-off" title="Qurilmalarni uzish" onClick={onResetDevices} />
        <Action icon="ti-trash" title="O'chirish" onClick={onRemove} danger />

        <button
          onClick={onToggle}
          title={item.isActive ? "O'chirish" : 'Yoqish'}
          className={`ml-auto h-8 w-[46px] shrink-0 rounded-full transition
                      ${item.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform
                        ${item.isActive ? 'translate-x-[21px]' : 'translate-x-[3px]'}`}
          />
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}

function Action({ icon, title, onClick, danger, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition
        ${active ? 'bg-green-50 text-green-600'
          : danger ? 'text-red-500 hover:bg-red-50'
            : 'text-slate-500 hover:bg-slate-100'}`}
    >
      <i className={`ti ${icon} text-[17px]`} />
    </button>
  );
}

/* ═══ Yaratish / tahrirlash ═══ */
function EditModal({ item, onClose, onSaved }) {
  const isNew = !item;

  const [label, setLabel] = useState(item?.label || '');
  const [days, setDays] = useState(30);
  const [pin, setPin] = useState('');
  const [deviceLimit, setDeviceLimit] = useState(item?.deviceLimit ?? 0);
  const [sections, setSections] = useState(item?.sections || ['tables', 'stoplist', 'menu']);
  // TEST: default 15 soniya. Ishlab chiqarishda 120 ga qaytariladi
  // (serverdagi KioskToken.inactivitySec bilan birga).
  const [inactivitySec, setInactivitySec] = useState(item?.inactivitySec ?? 15);
  const [autoFullscreen, setAutoFullscreen] = useState(item?.autoFullscreen ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const toggleSection = (key) => {
    setSections((prev) => (prev.includes(key)
      ? prev.filter((s) => s !== key)
      : [...prev, key]));
  };

  const save = async () => {
    if (sections.length === 0) {
      setErr('Kamida bitta bo‘lim tanlang');
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setErr('PIN 4 ta raqamdan iborat bo‘lishi kerak');
      return;
    }

    setBusy(true);
    setErr(null);

    const body = {
      label, deviceLimit, sections, inactivitySec, autoFullscreen,
      ...(pin && { pin }),
      // Tahrirlashda muddat faqat ataylab uzaytirilganda o'zgaradi —
      // har saqlashda 30 kun qo'shilib ketmasin
      ...(isNew && { expiresInDays: days }),
    };

    try {
      const res = isNew
        ? await panelApi.createKioskLink(body)
        : await panelApi.updateKioskLink(item._id, body);
      onSaved(res);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Kiosk link yaratish' : 'Linkni tahrirlash'} onClose={onClose}>

      <Field label="Nomi" hint="Planshetlarni ajratish uchun — masalan “Zal 1”">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Zal 1"
          maxLength={60}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
        />
      </Field>

      {isNew && (
        <Field label="Amal qilish muddati">
          <div className="flex gap-2">
            {[7, 30, 90, 365].map((d) => (
              <Chip key={d} on={days === d} onClick={() => setDays(d)}>
                {d === 365 ? '1 yil' : `${d} kun`}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field
        label={isNew ? 'PIN kodi' : 'Yangi PIN'}
        hint={isNew
          ? "Bo'sh qoldirsangiz tasodifiy PIN yaratiladi"
          : "Bo'sh qoldirsangiz eski PIN saqlanadi. Eskisini ko'rish mumkin emas."}
      >
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          inputMode="numeric"
          className="w-32 rounded-xl border border-line px-3 py-2.5 text-center text-lg
                     tracking-[0.3em] outline-none focus:border-brand-400"
        />
      </Field>

      <Field label="Ruxsat etilgan bo‘limlar" hint="Daromad va sozlamalar kioskda hech qachon ochilmaydi">
        <div className="space-y-2">
          {SECTIONS.map(([key, name, icon]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={sections.includes(key)}
                onChange={() => toggleSection(key)}
                className="h-4 w-4 accent-brand-400"
              />
              <i className={`ti ${icon} text-lg text-slate-500`} />
              <span className="text-sm text-ink">{name}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Qurilma cheklovi">
        <div className="flex gap-2">
          <Chip on={deviceLimit === 0} onClick={() => setDeviceLimit(0)}>Cheksiz</Chip>
          <Chip on={deviceLimit === 1} onClick={() => setDeviceLimit(1)}>1 ta</Chip>
          <Chip on={deviceLimit === 3} onClick={() => setDeviceLimit(3)}>3 ta</Chip>
          <Chip on={deviceLimit === 5} onClick={() => setDeviceLimit(5)}>5 ta</Chip>
        </div>
      </Field>

      <Field
        label="Qulf vaqti"
        hint="Shu vaqt tegilmasa animatsiya chiqadi va PIN so‘raladi"
      >
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 120, 300, 600].map((s) => (
            <Chip key={s} on={inactivitySec === s} onClick={() => setInactivitySec(s)}>
              {s < 60 ? `${s}s` : `${s / 60} daq`}
            </Chip>
          ))}
        </div>
        {inactivitySec < 60 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Qisqa vaqt — sinov uchun. Kunlik ishda 2 daqiqa qulayroq,
            aks holda ofitsiant buyurtma yozayotganda qulf tushib qoladi.
          </p>
        )}
      </Field>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5">
        <input
          type="checkbox"
          checked={autoFullscreen}
          onChange={(e) => setAutoFullscreen(e.target.checked)}
          className="h-4 w-4 accent-brand-400"
        />
        <span className="text-sm text-ink">Avtomatik to‘liq ekran</span>
      </label>

      {err && (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>
      )}

      <div className="mt-5 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink"
        >
          Bekor qilish
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-xl bg-brand-400 py-2.5 text-sm font-medium text-brand-text
                     transition hover:bg-brand-600 hover:text-white disabled:opacity-50"
        >
          {busy ? 'Saqlanmoqda...' : isNew ? 'Yaratish' : 'Saqlash'}
        </button>
      </div>
    </Modal>
  );
}

/* ═══ Yaratilgandan keyin — link va PIN ═══ */
function CreatedModal({ data, onClose }) {
  const [copied, flashCopied] = useTempValue(1800);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(what);
    } catch { /* clipboard yopiq */ }
  };

  return (
    <Modal
      title={data.rotated ? 'Token yangilandi' : 'Link tayyor'}
      onClose={onClose}
    >
      {data.pin && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3">
          <div className="text-[13px] font-medium text-amber-900">
            PIN kodi faqat HOZIR ko‘rinadi
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
            Yopilgandan keyin uni qayta ko‘rib bo‘lmaydi — bazada
            faqat shifrlangan holda saqlanadi. Yozib oling.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="rounded-lg bg-white px-4 py-2 text-2xl tracking-[0.4em] text-ink">
              {data.pin}
            </code>
            <button
              onClick={() => copy(data.pin, 'pin')}
              className="rounded-lg bg-white px-3 py-2 text-sm text-amber-900"
            >
              {copied === 'pin' ? 'Nusxalandi' : 'Nusxalash'}
            </button>
          </div>
        </div>
      )}

      <Field label="Havola">
        <div className="flex gap-2">
          <input
            readOnly
            value={data.url || ''}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-ink"
          />
          <button
            onClick={() => copy(data.url, 'url')}
            className="shrink-0 rounded-xl bg-brand-400 px-4 text-sm font-medium text-brand-text"
          >
            {copied === 'url' ? '✓' : 'Nusxalash'}
          </button>
        </div>
      </Field>

      <button
        onClick={onClose}
        className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-ink"
      >
        Yopish
      </button>
    </Modal>
  );
}

/* ═══ QR ═══ */
function QrModal({ item, onClose }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let url;
    let alive = true;

    // window.open bilan ochib bo'lmaydi — u Authorization
    // sarlavhasini yubormaydi va 401 qaytadi
    panelApi.downloadFile(panelApi.kioskQrPath(item._id))
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch((e) => alive && setErr(e.message));

    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item._id]);

  return (
    <Modal title={item.label || 'Kiosk QR'} onClose={onClose}>
      <div className="flex min-h-[240px] items-center justify-center">
        {err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : src ? (
          <img src={src} alt="Kiosk QR" className="h-56 w-56" />
        ) : (
          <div className="text-sm text-muted">Yuklanmoqda...</div>
        )}
      </div>

      <p className="text-center text-[13px] leading-relaxed text-muted">
        Planshet kamerasi bilan skanerlang — havolani qo‘lda
        terish shart emas.
      </p>

      <button
        onClick={onClose}
        className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-ink"
      >
        Yopish
      </button>
    </Modal>
  );
}

/* ═══ Umumiy ═══ */
function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white
                   p-5 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[13px] font-medium text-ink">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm transition
        ${on ? 'bg-brand-400 text-brand-text' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}
