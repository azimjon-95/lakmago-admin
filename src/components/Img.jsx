import { optimizeUrl } from '@/lib/cloudinary';

/**
 * Rasm — Cloudinary optimizatsiyasi va lazy yuklash bilan.
 *
 * MUAMMO EDI: kodda 20 ta <img> bor, lekin `optimizeUrl`
 * faqat BITTASIDA ishlatilgan. Qolganlari ASL faylni
 * yuklardi — telefondan yuklangan taom rasmi 2-5 MB bo'ladi
 * va u 44x44 px katakchada ko'rsatiladi. 200 taomli menyuda
 * bu yuzlab megabayt keraksiz trafik va dekodlash demak.
 *
 * NEGA KOMPONENT, NEGA HAR JOYDA optimizeUrl() EMAS:
 * 18 ta joyni qo'lda tuzatish bir martalik yechim —
 * ertaga qo'shilgan yangi <img> yana optimizatsiyasiz
 * qolardi. Komponent esa standartni majburiy qiladi.
 *
 * `w` — rasm KO'RSATILADIGAN kenglik emas, YUKLANADIGAN
 * kenglik. Retina ekranlar uchun CSS o'lchamining ~2 barobari
 * beriladi (44px katakcha -> w=96).
 */
export function Img({ src, w = 400, alt = '', className, style, ...rest }) {
  if (!src) return null;

  return (
    <img
      src={optimizeUrl(src, w)}
      alt={alt}
      /*
       * lazy: ekrandan tashqaridagi rasmlar umuman so'ralmaydi.
       * async: dekodlash asosiy oqimni bloklamaydi — uzun
       * ro'yxatlarda skroll silliq qoladi.
       */
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
      {...rest}
    />
  );
}
