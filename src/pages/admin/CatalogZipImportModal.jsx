import { useState, useRef, useCallback } from 'react';
import { adminApi } from '@/api';
import { uploadImage } from '@/lib/cloudinary';
import { parseCatalogZip, revokePreviewUrls } from '@/lib/zipImport';
import { CATALOG_CATEGORIES } from '@/constants/catalogCategories';
import { useLockScroll } from '@/hooks/useLockScroll';

// Bir vaqtda nechta mahsulot parallel yuklanadi. Ko'p bo'lsa
// Cloudinary/serverni portlatadi, kam bo'lsa sekin ishlaydi.
const CONCURRENCY = 3;

const STATUS_LABEL = {
  idle: 'Kutilmoqda',
  uploading: 'Yuklanmoqda...',
  done: 'Qo\u2018shildi',
  error: 'Xato',
  skipped: "O'tkazib yuborildi",
};

/**
 * ZIP orqali ommaviy import modali.
 *
 * Oqim: fayl tanlash -> ZIP tahlili (brauzerda, tarmoqqa hech
 * narsa yuborilmaydi) -> ko'rib chiqish jadvali (kategoriya
 * moslikini tuzatish, qatorlarni o'chirib qo'yish mumkin) ->
 * "Yuklashni boshlash" -> har bir qator uchun: rasm to'g'ridan
 * Cloudinary'ga, keyin mahsulot mavjud /admin/catalog POST orqali
 * yaratiladi (yangi server endpoint SHART EMAS — bor infratuzilma
 * qayta ishlatiladi).
 */
export function CatalogZipImportModal({ onClose, onImported }) {
  useLockScroll();
  const [stage, setStage] = useState('pick'); // pick | review | uploading | summary
  const [rows, setRows] = useState([]);
  const [zipErr, setZipErr] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef(null);
  const cancelRef = useRef(false);

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setZipErr('Faqat .zip fayl qabul qilinadi');
      return;
    }

    setZipErr(null);
    setParsing(true);
    try {
      const parsed = await parseCatalogZip(file);
      setRows(parsed.map((r) => ({ ...r, status: 'idle', statusMsg: '' })));
      setStage('review');
    } catch (e2) {
      setZipErr(e2.message || 'ZIP faylni o\u2018qib bo\u2018lmadi');
    } finally {
      setParsing(false);
    }
  };

  const toggleRow = (rowId) => {
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, included: !r.included } : r)));
  };

  const setRowCategory = (rowId, value) => {
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? {
      ...r,
      categoryValue: value,
      // Qo'lda kategoriya tanlansa, "kategoriya topilmadi" xatosi
      // endi tegishli emas — qolgan xatolar (masalan rasm yo'q)
      // bo'lsa saqlanadi, shuning uchun boshqa xatolar bormi tekshiramiz
      errors: r.errors.filter((x) => !x.startsWith('Kategoriya')),
    } : r)));
  };

  // Kategoriyasi hali tanlanmagan, lekin boshqa xatosi yo'q qatorlar
  // uchun ham "included" ni qayta hisoblaymiz — foydalanuvchi select'dan
  // kategoriya tanlagach avtomatik yoqilib qolsin.
  const effectiveIncluded = (r) => r.errors.length === 0 && !!r.categoryValue;

  const startImport = async () => {
    cancelRef.current = false;
    setStage('uploading');
    setRows((rs) => rs.map((r) => (
      effectiveIncluded(r) && r.included
        ? { ...r, status: 'idle', statusMsg: '' }
        : { ...r, status: 'skipped', statusMsg: '' }
    )));

    const toProcess = rows.filter((r) => effectiveIncluded(r) && r.included);
    let cursor = 0;

    const worker = async () => {
      while (cursor < toProcess.length && !cancelRef.current) {
        const row = toProcess[cursor];
        cursor += 1;

        setRows((rs) => rs.map((r) => (r.rowId === row.rowId ? { ...r, status: 'uploading' } : r)));
        try {
          const { url } = await uploadImage(row.imageBlob, 'dishes');
          await adminApi.createCatalogProduct({
            name: row.name,
            description: row.description,
            category: row.categoryValue,
            imageUrl: url,
          });
          setRows((rs) => rs.map((r) => (r.rowId === row.rowId
            ? { ...r, status: 'done', statusMsg: '' } : r)));
        } catch (e) {
          setRows((rs) => rs.map((r) => (r.rowId === row.rowId
            ? { ...r, status: 'error', statusMsg: e.message || 'Xato' } : r)));
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setStage('summary');
  };

  const close = useCallback(() => {
    revokePreviewUrls(rows);
    cancelRef.current = true;
    onClose();
  }, [rows, onClose]);

  const doneCount = rows.filter((r) => r.status === 'done').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;
  const includedCount = rows.filter((r) => effectiveIncluded(r) && r.included).length;
  const invalidCount = rows.length - rows.filter((r) => effectiveIncluded(r)).length;

  return (
    <div onClick={stage === 'uploading' ? undefined : close}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90dvh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-none">
          <div>
            <div className="font-bold text-ink">ZIP orqali ommaviy import</div>
            <div className="text-xs text-muted mt-0.5">data.json + images/ tuzilishidagi .zip</div>
          </div>
          {stage !== 'uploading' && (
            <button onClick={close} className="text-muted p-1"><i className="ti ti-x text-xl" /></button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stage === 'pick' && (
            <div className="text-center py-10">
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleFile} />
              <button onClick={pickFile} disabled={parsing}
                className="inline-flex flex-col items-center gap-3 px-8 py-8 border-2 border-dashed border-line rounded-2xl hover:border-brand-400 transition-colors">
                <i className="ti ti-file-zip text-4xl text-muted" />
                <span className="font-semibold text-ink">
                  {parsing ? 'ZIP tahlil qilinmoqda...' : '.zip faylni tanlash'}
                </span>
                <span className="text-xs text-muted max-w-xs">
                  Ichida data.json va images/ papkasi bo'lishi kerak — pastda namuna tuzilma
                </span>
              </button>

              {zipErr && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 inline-block">
                  {zipErr}
                </div>
              )}

              <pre className="mt-6 text-left text-xs text-muted bg-canvas rounded-xl p-4 mx-auto max-w-sm overflow-x-auto">
{`mevalar_yangi_meva.zip
├── data.json
└── images/
    ├── banan.jpg
    └── kivi.jpg`}
              </pre>
            </div>
          )}

          {stage === 'review' && (
            <>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-canvas text-muted font-medium">
                  Jami: {rows.length}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  Tayyor: {includedCount}
                </span>
                {invalidCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                    Muammoli: {invalidCount}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.rowId}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                      effectiveIncluded(r) ? 'border-line' : 'border-red-200 bg-red-50/40'
                    }`}>
                    <input
                      type="checkbox"
                      checked={r.included && effectiveIncluded(r)}
                      disabled={!effectiveIncluded(r)}
                      onChange={() => toggleRow(r.rowId)}
                      className="w-4 h-4 flex-none accent-brand-400"
                    />

                    {r.imagePreviewUrl ? (
                      <img src={r.imagePreviewUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-none bg-canvas" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg flex-none bg-canvas flex items-center justify-center">
                        <i className="ti ti-photo-off text-muted" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{r.name || '(nomsiz)'}</div>
                      {r.errors.length > 0 ? (
                        <div className="text-xs text-red-600 truncate">{r.errors.join(' \u00b7 ')}</div>
                      ) : (
                        <div className="text-xs text-muted truncate">{r.description || '\u2014'}</div>
                      )}
                    </div>

                    <select
                      value={r.categoryValue || ''}
                      onChange={(e) => setRowCategory(r.rowId, e.target.value)}
                      className="inp !w-40 flex-none text-xs !py-1.5"
                    >
                      <option value="">Kategoriya tanlang</option>
                      {CATALOG_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}

          {(stage === 'uploading' || stage === 'summary') && (
            <>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-canvas text-muted font-medium">
                  Jami: {includedCount}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  Qo'shildi: {doneCount}
                </span>
                {errorCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                    Xato: {errorCount}
                  </span>
                )}
              </div>

              <div className="h-2 bg-canvas rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-brand-400 transition-all duration-300"
                  style={{ width: `${includedCount ? ((doneCount + errorCount) / includedCount) * 100 : 0}%` }}
                />
              </div>

              <div className="space-y-1.5">
                {rows.filter((r) => r.included && effectiveIncluded(r)).map((r) => (
                  <div key={r.rowId} className="flex items-center gap-3 py-1.5">
                    {r.imagePreviewUrl && (
                      <img src={r.imagePreviewUrl} alt="" className="w-8 h-8 rounded-md object-cover flex-none" />
                    )}
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">{r.name}</span>
                    <span className={`text-xs font-medium flex-none ${
                      r.status === 'done' ? 'text-emerald-600'
                        : r.status === 'error' ? 'text-red-600'
                          : r.status === 'uploading' ? 'text-brand-600' : 'text-muted'
                    }`}>
                      {r.status === 'error' && r.statusMsg ? r.statusMsg : STATUS_LABEL[r.status] || ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-line flex-none">
          {stage === 'review' && (
            <>
              <button onClick={close} className="flex-1 py-2.5 rounded-xl border border-line font-medium text-ink">
                Bekor qilish
              </button>
              <button
                onClick={startImport}
                disabled={includedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-brand-400 text-brand-text font-semibold disabled:opacity-40"
              >
                {includedCount} tasini yuklash
              </button>
            </>
          )}
          {stage === 'uploading' && (
            <div className="flex-1 text-center text-sm text-muted py-2">
              Yuklanmoqda, sahifani yopmang...
            </div>
          )}
          {stage === 'summary' && (
            <button
              onClick={() => { onImported(); close(); }}
              className="flex-1 py-2.5 rounded-xl bg-brand-400 text-brand-text font-semibold"
            >
              Tayyor — ro'yxatni yangilash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
