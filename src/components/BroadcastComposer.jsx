import { useState } from 'react';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';

// Telegram reklama yaratish — rasm/matn/tugma har xil kombinatsiyada.
// target: { chatId, title } (bitta guruh) yoki { all: true } (barcha guruhlar)
export function BroadcastComposer({ target, onClose, onSent }) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttonText, setButtonText] = useState('🍽 Buyurtma berish');
  const [buttonUrl, setButtonUrl] = useState('');
  const [pin, setPin] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  const canSend = (text.trim() || imageUrl) && !sending;

  const send = async () => {
    if (!canSend) return;
    setErr(null);
    setSending(true);
    const payload = {
      text: text.trim(),
      imageUrl,
      buttonText: buttonText.trim(),
      buttonUrl: buttonUrl.trim(),
      pin,
    };
    // Tugma matni bor lekin URL yo'q bo'lsa — tugmani yubormaymiz
    if (payload.buttonText && !payload.buttonUrl) { payload.buttonText = ''; }

    try {
      if (target.all) {
        const r = await adminApi.broadcastToAll(payload);
        alert(`Yuborildi: ${r.sent}/${r.total} guruh${r.failed ? `, ${r.failed} xato` : ''}`);
      } else {
        await adminApi.broadcastToGroup(target.chatId, payload);
      }
      onSent?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Sarlavha */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Reklama yuborish</h3>
            <p className="text-xs text-muted mt-0.5">
              {target.all ? 'Barcha faol guruhlarga' : `Guruh: ${target.title || target.chatId}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><i className="ti ti-x text-xl" /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-0">
          {/* CHAP: tahrirlash */}
          <div className="p-6 border-r border-line grid gap-4 content-start">
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              folder="banners"
              label="Rasm (ixtiyoriy)"
              aspect="16/9"
            />

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Matn</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Reklama matni... (HTML: <b>qalin</b>, <i>kursiv</i>)"
                className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 resize-none text-sm"
              />
              <p className="text-[11px] text-muted mt-1">HTML formatlash: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;, emoji 🍽🔥⚡️</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Tugma matni</label>
                <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="🍽 Buyurtma berish" className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Tugma havolasi</label>
                <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://t.me/..." className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 text-sm" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} className="w-4 h-4 accent-brand-400" />
              Yuborilgach tepaga pin qilinsin
            </label>

            {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          </div>

          {/* O'NG: jonli Telegram preview */}
          <div className="p-6 bg-canvas">
            <div className="text-xs text-muted mb-3">Telegram ko'rinishi:</div>
            <div className="bg-[#EFEAE2] rounded-xl p-3 min-h-[200px]" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.02) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
              {/* Telegram xabar puffagi */}
              <div className="bg-white rounded-xl rounded-tl-sm shadow-sm overflow-hidden max-w-[85%]">
                {imageUrl && (
                  <img src={imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} />
                )}
                {(text || (!imageUrl && !text)) && (
                  <div className="px-3 py-2">
                    <div className="text-[13px] text-gray-800 whitespace-pre-wrap leading-snug"
                      dangerouslySetInnerHTML={{ __html: renderHtml(text) || '<span class="text-gray-400">Matn...</span>' }} />
                  </div>
                )}
                {buttonText && buttonUrl && (
                  <div className="border-t border-gray-100 px-3 py-2.5 text-center">
                    <span className="text-[13px] text-blue-500 font-medium">{buttonText}</span>
                  </div>
                )}
                <div className="px-3 pb-1.5 text-right">
                  <span className="text-[10px] text-gray-400">11:24</span>
                </div>
              </div>
              {pin && (
                <div className="mt-2 text-[11px] text-brand-600 flex items-center gap-1">
                  <i className="ti ti-pin" /> Tepaga pin qilinadi
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Yuborish */}
        <div className="px-6 py-4 border-t border-line flex gap-3">
          <button onClick={onClose} className="px-5 py-2.5 border border-line text-muted rounded-xl hover:bg-canvas">Bekor</button>
          <button onClick={send} disabled={!canSend} className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
            {sending ? 'Yuborilmoqda...' : target.all ? 'Barcha guruhlarga yuborish' : 'Yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Oddiy HTML tag'larni preview uchun ko'rsatish (b, i)
function renderHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
    .replace(/&lt;i&gt;/g, '<i>').replace(/&lt;\/i&gt;/g, '</i>');
}
