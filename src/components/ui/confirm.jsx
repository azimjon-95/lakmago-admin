import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Yagona tasdiqlash oynasi.
 *
 * Ant Design qo'shilmadi: u ~500 KB bundle qo'shadi va o'z
 * dizayn tizimini olib keladi — mavjud Tailwind uslublar bilan
 * to'qnashadi. Bu komponent Modal.confirm() bilan bir xil
 * ishlatiladi, lekin loyiha dizayniga mos.
 *
 * Ishlatish:
 *   if (await confirm({ title: "O'chirilsinmi?" })) { ... }
 */

const TONES = {
  default: {
    icon: 'ti-help-circle',
    iconCls: 'bg-blue-50 text-blue-600',
    btnCls: 'bg-brand-400 text-brand-text hover:bg-brand-600 hover:text-white',
  },
  danger: {
    icon: 'ti-alert-triangle',
    iconCls: 'bg-red-50 text-red-600',
    btnCls: 'bg-red-500 text-white hover:bg-red-600',
  },
  warning: {
    icon: 'ti-alert-circle',
    iconCls: 'bg-amber-50 text-amber-600',
    btnCls: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  success: {
    icon: 'ti-circle-check',
    iconCls: 'bg-green-50 text-green-600',
    btnCls: 'bg-green-500 text-white hover:bg-green-600',
  },
};

function ConfirmDialog({ options, onClose }) {
  const {
    title,
    content,
    okText = 'Tasdiqlash',
    cancelText = 'Bekor',
    tone = 'default',
    input,
    inputPlaceholder = '',
    defaultValue = '',
    options: selectOptions,
  } = options;

  const [value, setValue] = useState(defaultValue);
  const [visible, setVisible] = useState(false);
  const t = TONES[tone] || TONES.default;

  // Ochilish animatsiyasi
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback((result) => {
    setVisible(false);
    // Animatsiya tugagach o'chiramiz
    setTimeout(() => onClose(result), 160);
  }, [onClose]);

  // Klaviatura
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && !input) close(true);
    };
    window.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [close, input]);

  return (
    <div
      onClick={() => close(false)}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl transition-all duration-150 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex gap-3.5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${t.iconCls}`}>
            <i className={`ti ${t.icon} text-xl`} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink leading-snug">
              {title}
            </h3>
            {content && (
              <p className="text-sm text-muted mt-1.5 leading-relaxed whitespace-pre-line">
                {content}
              </p>
            )}

            {input && !selectOptions && (
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && close(value)}
                placeholder={inputPlaceholder}
                className="inp mt-3"
              />
            )}

            {selectOptions && (
              <div className="mt-3 space-y-2">
                {selectOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setValue(opt.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                      value === opt.value
                        ? 'border-brand-400 bg-brand-50 text-brand-600'
                        : 'border-line text-ink hover:bg-canvas'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    {opt.hint && (
                      <div className="text-xs text-muted mt-0.5">{opt.hint}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {cancelText !== null && (
            <button
              onClick={() => close(false)}
              className="flex-1 border border-line text-muted py-2.5 rounded-xl text-sm font-medium hover:bg-canvas transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            autoFocus={!input}
            onClick={() => close(input || selectOptions ? value : true)}
            className={`flex-[1.4] py-2.5 rounded-xl text-sm font-medium transition-colors ${t.btnCls}`}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tasdiqlash oynasini ochadi.
 *
 * @returns {Promise<boolean|string>} tasdiqlansa true (yoki
 *   input qiymati), bekor qilinsa false
 */
export function confirm(options = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    const close = (result) => {
      root.unmount();
      host.remove();
      resolve(result);
    };

    root.render(
      <ConfirmDialog
        options={typeof options === 'string' ? { title: options } : options}
        onClose={close}
      />,
    );
  });
}

/** O'chirish uchun tayyor variant. */
export function confirmDelete(name, extra) {
  return confirm({
    title: name ? `"${name}" o'chirilsinmi?` : "O'chirilsinmi?",
    content: extra || 'Bu amalni qaytarib bo‘lmaydi.',
    okText: "O'chirish",
    tone: 'danger',
  });
}

/** Sabab so'raydigan variant. */
export function confirmWithReason(title, placeholder = 'Sabab (ixtiyoriy)') {
  return confirm({
    title,
    input: true,
    inputPlaceholder: placeholder,
    okText: 'Yuborish',
    tone: 'warning',
  });
}

/**
 * Oddiy xabar oynasi — alert() o'rniga.
 * Bitta tugma, dizayn bir xil.
 */
export function notify(message, tone = 'default') {
  return confirm({
    title: typeof message === 'string' ? message : message?.title,
    content: typeof message === 'object' ? message.content : undefined,
    okText: 'Tushunarli',
    cancelText: null,
    tone,
  });
}
