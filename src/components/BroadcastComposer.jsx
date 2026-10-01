import { useState, useEffect } from 'react';
import { adminApi } from '@/api';
import { ImageUpload } from '@/components/ImageUpload';
import { VideoPicker } from '@/components/VideoPicker';
import { validateVideo } from '@/lib/adVideo';
import { useLockScroll } from '@/hooks/useLockScroll';
import { Img } from '@/components/Img';

// Telegram reklama yaratish — rasm/matn/tugma har xil kombinatsiyada.
// target: { chatId, title } (bitta guruh) yoki { all: true } (barcha guruhlar)
export function BroadcastComposer({ target, onClose, onSent }) {
  useLockScroll();
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttonText, setButtonText] = useState('🍽 Buyurtma berish');
  const [buttonUrl, setButtonUrl] = useState('');
  const [pin, setPin] = useState(false);
  // Media: rasm YOKI video (bittasi). Ikkalasining holati saqlanadi — almashtirganda yo'qolmaydi,
  // lekin yuboriladigan FAQAT faol tur.
  const [mediaKind, setMediaKind] = useState('image');
  const [videoFile, setVideoFile] = useState(null);
  const [progress, setProgress] = useState(null); // null | 0..1 (video yuklanmoqda)
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  const activeImage = mediaKind === 'image' ? imageUrl : '';
  const activeVideo = mediaKind === 'video' ? videoFile : null;
  const canSend = Boolean(text.trim() || activeImage || activeVideo) && !sending;

  const send = async () => {
    if (!canSend) return;
    setErr(null);
    const problem = validateVideo(activeVideo);
    if (problem) { setErr(problem); return; }
    setSending(true);
    setProgress(null);
    const payload = {
      text: text.trim(),
      imageUrl: activeImage,
      buttonText: buttonText.trim(),
      buttonUrl: buttonUrl.trim(),
      pin,
    };
    // Tugma matni bor lekin URL yo'q bo'lsa — tugmani yubormaymiz
    if (payload.buttonText && !payload.buttonUrl) { payload.buttonText = ''; }

    try {
      let r;
      if (activeVideo) {
        /*
         * VIDEO: multipart. Fayl serverda xotirada turadi va bazaga
         * saqlanmasdan Telegram'ga uzatiladi. Maydonlar matn sifatida ketadi.
         */
        const form = new FormData();
        form.append('text', payload.text);
        form.append('buttonText', payload.buttonText);
        form.append('buttonUrl', payload.buttonUrl);
        form.append('pin', String(pin));
        form.append('video', activeVideo, activeVideo.name);
        const opts = { onProgress: setProgress };
        setProgress(0);
        r = target.all
          ? await adminApi.broadcastToAllForm(form, opts)
          : await adminApi.broadcastToGroupForm(target.chatId, form, opts);
      } else {
        r = target.all
          ? await adminApi.broadcastToAll(payload)
          : await adminApi.broadcastToGroup(target.chatId, payload);
      }
      if (target.all) {
        const why = r.failures?.length ? `\n${r.failures.map((f) => `• ${f.title || f.chatId}: ${f.error}`).join('\n')}` : '';
        alert(`Yuborildi: ${r.sent}/${r.total} guruh${r.failed ? `, ${r.failed} xato` : ''}${why}`);
      }
      onSent?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  // Yuborish tugmasi matni: video yuklanayotganda foiz, keyin "Telegramga yuborilmoqda"
  const sendLabel = !sending
    ? (target.all ? 'Barcha guruhlarga yuborish' : 'Yuborish')
    : progress === null ? 'Yuborilmoqda...'
    : progress < 1 ? `Video yuklanmoqda ${Math.round(progress * 100)}%`
    : 'Telegramga yuborilmoqda...';

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
            {/* Media turi: rasm YOKI video */}
            <div role="tablist" aria-label="Media turi" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-canvas border border-line">
              {[['image', 'ti-photo', 'Rasm'], ['video', 'ti-video', 'Video']].map(([k, icon, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mediaKind === k}
                  disabled={sending}
                  onClick={() => setMediaKind(k)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                    mediaKind === k ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  <i className={`ti ${icon}`} /> {label}
                </button>
              ))}
            </div>

            {mediaKind === 'image' ? (
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="banners"
                label="Rasm (ixtiyoriy)"
                aspect="16/9"
              />
            ) : (
              <VideoPicker value={videoFile} onChange={setVideoFile} disabled={sending} />
            )}

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
                {activeImage && (
                  <Img src={activeImage} w={800} className="w-full object-cover" style={{ maxHeight: 180 }} />
                )}
                {activeVideo && <VideoPreview file={activeVideo} />}
                {(text || (!activeImage && !activeVideo && !text)) && (
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

                {/* Video yuklanish chizig'i (faqat yuklanayotganda) */}
        {sending && progress !== null && (
          <div className="h-1 bg-canvas" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-1 bg-brand-400 transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {/* Yuborish */}
        <div className="px-6 py-4 border-t border-line flex gap-3">
          <button onClick={onClose} className="px-5 py-2.5 border border-line text-muted rounded-xl hover:bg-canvas">Bekor</button>
          <button onClick={send} disabled={!canSend} className="flex-1 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50">
            {sendLabel}
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

// Telegram ko'rinishida video (tanlangan fayldan vaqtinchalik havola)
function VideoPreview({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return <video src={url} muted playsInline preload="metadata" controls className="w-full bg-black" style={{ maxHeight: 180 }} />;
}
