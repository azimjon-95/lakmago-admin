import { Fragment, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRefreshKey } from '@/store/refresh';
import { whenIdle } from '@/lib/netActivity';
import './PullToRefresh.css';

/*
 * ═══ TORTIB YANGILASH (mobil ilovalardagidek) ═══
 *
 * Sahifa eng tepada turganda ekranni pastga tortsangiz, sarlavha ostida yumshoq animatsiya chiqadi.
 * Yetarlicha tortib qo'yib yuborsangiz — HAMMA ma'lumot serverdan qayta olinadi.
 *
 * Qasddan tortish kerak: dastlabki 10 px e'tiborsiz, siljish qarshilik bilan (rezina kabi) kuchayadi va
 * "tayyor" bo'lishi uchun ~150 px tortish kerak — tasodifiy engil tortish yangilamaydi.
 *
 * Aralashmaydi: sahifa tepada bo'lmasa, gorizontal surishda, matn maydonida, modal/ichki ro'yxatda,
 * fixed elementlarda va yuqoriga surishda ishlamaydi. Faqat teginish (touch) qurilmalarda;
 * kompyuterda (main skroll konteyneri emas) o'chiq.
 *
 * "100% yangilash": (1) react-query keshi yangilanadi, (2) RefreshBoundary ichidagi sahifa QAYTA MOUNT bo'ladi
 * (har sahifaning o'z so'rovlari qayta ketadi), (3) animatsiya faol so'rovlar tugaguncha turadi.
 */
const MAX = 120;        // ko'rinadigan eng katta siljish (px)
const THRESHOLD = 64;   // shuncha siljishda "tayyor"
const HOLD = 72;        // yangilanayotganda turadigan balandlik
const DEAD = 10;        // dastlabki harakat — tasodifiy teginish
const RESIST = MAX * 1.6;
const MIN_SPIN_MS = 900;  // juda tez tugasa ham animatsiya ko'rinsin (miltillamasin)
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Rezina qarshiligi: qanchalik ko'p tortsangiz, shunchalik "og'irlashadi" va MAX ga asimptotik yaqinlashadi
const resist = (d) => MAX * (1 - Math.exp(-d / RESIST));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABEL = {
  pull: 'Yangilash uchun pastga torting',
  armed: 'Qo‘yib yuboring',
  loading: 'Yangilanmoqda…',
  done: 'Yangilandi',
};

/** Tortish boshlanishi mumkin bo'lmagan joylar (matn maydoni, modal, fixed element, skroll qilingan ichki ro'yxat) */
function blocked(target, main) {
  if (!(target instanceof Element)) return true;
  if (target.closest('input,textarea,select,[contenteditable="true"],[data-no-ptr],[role="dialog"],[role="listbox"],[role="menu"]')) return true;
  for (let el = target; el && el !== main; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return true; // modal, suzuvchi tugma, toast
    const scrollable = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    if (scrollable && el.scrollTop > 0) return true; // ichki ro'yxat hozir skroll qilinmoqda
  }
  return false;
}

const haptic = () => {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    if (navigator.vibrate) navigator.vibrate(8);
  } catch { /* ba'zi brauzerlarda taqiqlangan */ }
};

export function PullToRefresh() {
  const qc = useQueryClient();
  const bump = useRefreshKey((s) => s.bump);
  const [phase, setPhase] = useState('idle');
  const wrapRef = useRef(null);
  const ctl = useRef({ mode: 'idle', y0: 0, x0: 0, offset: 0, armed: false, busy: false, raf: 0, pending: 0 });

  useEffect(() => {
    const main = document.querySelector('main');
    const wrap = wrapRef.current;
    if (!main || !wrap) return undefined;
    const g = ctl.current;

    // Mobil layoutda `main` skroll konteyneri; kompyuterda (overflow: visible) bu funksiya kerak emas
    const isScroller = () => ['auto', 'scroll'].includes(getComputedStyle(main).overflowY);

    const apply = (offset) => {
      wrap.style.height = `${offset}px`;
      wrap.style.setProperty('--p', String(Math.min(1, offset / THRESHOLD)));
      main.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
    };
    const schedule = (offset) => {
      g.pending = offset;
      if (g.raf) return;
      g.raf = requestAnimationFrame(() => { g.raf = 0; apply(g.pending); });
    };
    // Yumshoq o'tish (qo'yib yuborganda): qaytish yoki HOLD ga o'tirish
    const animateTo = (offset) => {
      cancelAnimationFrame(g.raf); g.raf = 0;
      wrap.style.transition = `height 380ms ${EASE}`;
      main.style.transition = `transform 380ms ${EASE}`;
      apply(offset);
      return sleep(400).then(() => { wrap.style.transition = ''; main.style.transition = ''; });
    };
    const setP = (p) => setPhase(p);

    const refresh = async () => {
      g.busy = true;
      setP('loading');
      animateTo(HOLD);
      const t0 = Date.now();
      bump();                                   // sahifa qayta mount bo'ladi → o'z so'rovlarini yuboradi
      await sleep(150);                         // yangi mount bo'lgan sahifa so'rovlarni boshlab olsin
      await Promise.allSettled([qc.invalidateQueries(), whenIdle({ grace: 300, timeout: 9000 })]);
      await sleep(Math.max(0, MIN_SPIN_MS - (Date.now() - t0)));
      main.scrollTop = 0;
      setP('done');
      await sleep(600);                         // "Yangilandi ✓" ko'rinib tursin
      await animateTo(0);
      setP('idle');
      g.busy = false;
    };

    const springBack = () => { setP('idle'); animateTo(0); };

    const onStart = (e) => {
      if (g.busy || !isScroller()) { g.mode = 'ignore'; return; }
      if (e.touches.length > 1) {
        // Ikkinchi barmoq (masalan kattalashtirish) — tortishni bekor qilamiz
        if (g.mode === 'pull') springBack();
        g.mode = 'ignore';
        return;
      }
      if (main.scrollTop > 0 || blocked(e.target, main) || document.querySelector('[role="dialog"][aria-modal="true"]')) {
        g.mode = 'ignore';
        return;
      }
      const t = e.touches[0];
      g.mode = 'idle'; g.y0 = t.clientY; g.x0 = t.clientX; g.offset = 0; g.armed = false;
      wrap.style.top = `${main.getBoundingClientRect().top}px`;
    };

    const onMove = (e) => {
      if (g.busy || g.mode === 'ignore' || g.mode === 'none' || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dy = t.clientY - g.y0;
      const dx = t.clientX - g.x0;

      if (g.mode === 'idle') {
        if (dy < -8) { g.mode = 'ignore'; return; }              // yuqoriga surish — oddiy skroll
        if (dy < DEAD) return;                                    // hali tasodifiy teginish bo'lishi mumkin
        if (Math.abs(dx) > dy * 0.8) { g.mode = 'ignore'; return; } // gorizontal surish
        if (main.scrollTop > 0) { g.mode = 'ignore'; return; }    // sahifa skroll bo'lib ketdi
        g.mode = 'pull';
        setP('pull');
      }

      if (g.mode === 'pull') {
        if (e.cancelable) e.preventDefault();                     // brauzerning o'z bounce/yangilashi aralashmasin
        const offset = dy <= DEAD ? 0 : resist(dy - DEAD);
        g.offset = offset;
        schedule(offset);
        if (offset >= THRESHOLD && !g.armed) { g.armed = true; setP('armed'); haptic(); }
        else if (offset < THRESHOLD - 4 && g.armed) { g.armed = false; setP('pull'); }
      }
    };

    const onEnd = () => {
      if (g.mode !== 'pull') { g.mode = 'idle'; return; }
      g.mode = 'idle';
      if (g.offset >= THRESHOLD) refresh(); else springBack();
    };

    // touchmove QO'LDA va passiv EMAS — aks holda preventDefault ishlamaydi (iOS'da sahifa o'zi sakrab ketadi)
    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: false });
    main.addEventListener('touchend', onEnd, { passive: true });
    main.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      main.removeEventListener('touchstart', onStart);
      main.removeEventListener('touchmove', onMove);
      main.removeEventListener('touchend', onEnd);
      main.removeEventListener('touchcancel', onEnd);
      cancelAnimationFrame(g.raf);
      main.style.transform = ''; main.style.transition = '';
    };
  }, [qc, bump]);

  const loading = phase === 'loading';
  return (
    <div ref={wrapRef} className="ptr" role="status" aria-live="polite" aria-label={phase === 'idle' ? undefined : LABEL[phase]}>
      <div className="ptr__inner">
        <div className={`ptr__badge ptr__badge--${phase}`}>
          <svg className="ptr__ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle className="ptr__track" cx="20" cy="20" r="17" />
            <circle className="ptr__arc" cx="20" cy="20" r="17" />
          </svg>
          <svg className="ptr__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" /></svg>
          <svg className="ptr__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.4 3.4L17.5 8.5" /></svg>
        </div>
        <div className={`ptr__label ${phase === 'pull' ? '' : 'ptr__label--on'}`}>{LABEL[phase] || (loading ? LABEL.loading : '')}</div>
      </div>
    </div>
  );
}

/** Ichidagi sahifani yangilash buyrug'ida QAYTA MOUNT qiladi (DOM qatlam qo'shmaydi — layout buzilmaydi) */
export function RefreshBoundary({ children }) {
  const key = useRefreshKey((s) => s.key);
  return <Fragment key={key}>{children}</Fragment>;
}
