import { Img } from '@/components/Img';
import { groupCover } from '@/lib/catalogCovers';

// overflow-wrap: anywhere — "mahsulotlari" kabi uzun so'z tor kartada o'ng tomondan KESILMAY, bo'linib tushadi
const clamp = (n) => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' });

/** Guruh kartochkasi: rasm (yoki gradient+emoji), tepa-o'ngda soni, pastda nom va tavsif, o'qli tugma. */
export function GroupCard({ g, onOpen }) {
  const cover = groupCover(g.id);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl text-left shadow-sm transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:aspect-[4/3]"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      {cover ? (
        <img src={cover} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      ) : (
        <span className="absolute inset-0 flex select-none items-center justify-center pb-8 text-7xl opacity-30" aria-hidden="true">{g.emoji}</span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{g.total} ta</span>
      <span className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 p-3 sm:gap-2 sm:p-3.5">
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-bold leading-tight text-white sm:text-base" style={clamp(2)}>{g.label}</b>
          <span className="mt-0.5 block text-[11px] leading-snug text-white/75 sm:text-xs" style={clamp(2)}>{g.hint}</span>
        </span>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/90 text-ink transition group-hover:bg-white sm:h-9 sm:w-9" aria-hidden="true">
          <i className="ti ti-chevron-right text-base sm:text-lg" />
        </span>
      </span>
    </button>
  );
}

/**
 * Mahsulot kartochkasi (maketdagidek): rasm, tepa-o'ngda o'chirish, pastki-o'ngda to'q sariq tahrirlash tugmasi,
 * ostida nom, tavsif, kategoriya "tegi" va (narx o'rniga — katalogda narx yo'q) nechta restoranda ishlatilgani.
 * Rasmsiz mahsulotda "Rasm qo'shish" — bosilsa tahrirlash oynasi (rasm yuklash birinchi maydon) ochiladi.
 */
export function ProductCard({ p, tag, onEdit, onDelete }) {
  const inactive = p.isActive === false;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <article
      onClick={onEdit}
      className={`group cursor-pointer overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md ${inactive ? 'opacity-60' : ''}`}
    >
      <div className="relative aspect-[4/3] bg-canvas">
        {p.imageUrl ? (
          <Img src={p.imageUrl} w={480} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
            <i className="ti ti-photo-plus text-3xl" aria-hidden="true" />
            <span className="text-xs font-medium">Rasm qo'shish</span>
          </span>
        )}
        {inactive && <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Nofaol</span>}
        <button
          type="button"
          onClick={stop(onDelete)}
          aria-label="O'chirish"
          className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          <i className="ti ti-trash text-base" />
        </button>
        <button
          type="button"
          onClick={stop(onEdit)}
          aria-label="Tahrirlash"
          className="absolute -bottom-0 right-2.5 flex h-10 w-10 translate-y-1/2 items-center justify-center rounded-full bg-brand-400 text-brand-text shadow-md transition hover:bg-brand-600 hover:text-white"
        >
          <i className="ti ti-pencil text-lg" />
        </button>
      </div>
      <div className="p-3 pt-4">
        <h3 className="truncate text-sm font-bold text-ink" title={p.name}>{p.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{p.description || '—'}</p>
        {/* Kartochka tor bo'lishi mumkin (telefonda 2, planshetda 3 ustun) — shuning uchun teg ALOHIDA qatorda, kesilmaydi */}
        <span className="mt-2.5 inline-block max-w-full truncate rounded-lg bg-canvas px-2 py-1 align-top text-[11px] font-medium text-ink" title={tag}>{tag}</span>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className={`text-xs font-bold ${p.usageCount > 0 ? 'text-ink' : 'text-muted'}`}>
            {p.usageCount > 0 ? `${p.usageCount} restoranda` : 'Ishlatilmagan'}
          </span>
          {p.volume && <span className="truncate text-[11px] text-muted">{p.volume}</span>}
        </div>
      </div>
    </article>
  );
}
