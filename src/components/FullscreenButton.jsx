import { useFullscreen } from '@/hooks/useFullscreen';

/**
 * To'liq ekran tugmasi — sahifaning yuqori o'ng burchagida.
 *
 * Yoqilganda sidebar yashiriladi va sahifa butun ekranni oladi.
 * Tugma o'sha joyda qoladi — chiqish uchun (ESC ham ishlaydi).
 */
export function FullscreenButton() {
  const { active, toggle } = useFullscreen();

  return (
    <button
      onClick={toggle}
      title={active ? "To'liq ekrandan chiqish (ESC)" : "To'liq ekran"}
      aria-label={active ? "To'liq ekrandan chiqish" : "To'liq ekran"}
      aria-pressed={active}
      className={`fixed right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-[12px] border shadow-sm backdrop-blur transition-colors ${
        active
          ? 'border-brand-400 bg-brand-400 text-brand-text'
          : 'border-line bg-white/80 text-muted hover:text-ink'
      }`}
    >
      <i className={`ti ${active ? 'ti-arrows-minimize' : 'ti-arrows-maximize'} text-[18px]`} />
    </button>
  );
}
