import { useEffect } from 'react';

/*
 * Moliya oynalari uchun umumiy qobiq — AgreementModal bilan bir xil
 * ko'rinish (telefonda pastdan chiqadi, kompyuterda markazda).
 * Escape yopadi. Ichki bosish tashqi qatlamga o'tmaydi.
 */
export function Sheet({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-surface p-4 sm:rounded-2xl sm:p-5 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-ink">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex-none rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-canvas"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
