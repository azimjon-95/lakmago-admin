import { useEffect, useState } from 'react';
import { adminApi } from '@/api';

/*
 * Namangan viloyati tumanlari — YAGONA manba serverda (constants/districts.js, GET /districts).
 * Bir marta yuklanadi va keshlanadi. Server javob bermasa — zaxira ro'yxat (kalitlar server bilan BIR XIL).
 */
const FALLBACK = [
  ['namangan_sh', 'Namangan shahri', 'city'], ['davlatobod', 'Davlatobod tumani', 'city'], ['yangi_namangan', 'Yangi Namangan tumani', 'city'],
  ['pop', 'Pop tumani'], ['chust', 'Chust tumani'], ['kosonsoy', 'Kosonsoy tumani'], ['mingbuloq', 'Mingbuloq tumani'],
  ['namangan_t', 'Namangan tumani'], ['norin', 'Norin tumani'], ['toraqorgon', "To'raqo'rg'on tumani"], ['uychi', 'Uychi tumani'],
  ['uchqorgon', "Uchqo'rg'on tumani"], ['chortoq', 'Chortoq tumani'], ['yangiqorgon', "Yangiqo'rg'on tumani"],
].map(([id, uz, group = 'district']) => ({ id, uz, group }));

export const DEFAULT_DISTRICT = 'pop';
let cache = null;
let inflight = null;

export function loadDistricts() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = adminApi.getDistricts()
      .then((r) => { cache = Array.isArray(r?.districts) && r.districts.length ? r.districts : FALLBACK; return cache; })
      .catch(() => FALLBACK)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useDistricts() {
  const [list, setList] = useState(cache || FALLBACK);
  useEffect(() => { let alive = true; loadDistricts().then((l) => { if (alive) setList(l); }); return () => { alive = false; }; }, []);
  return list;
}

export const districtName = (list, id) => (list.find((d) => d.id === id)?.uz) || id || '—';

export const COURIER_MODES = [
  { id: 'own', title: 'O‘z kuryeri', hint: 'Restoran o‘zi yetkazadi. Yetkazish puli 100% restoranga (hozirgidek).' },
  { id: 'lokma', title: 'LokmaGo kuryeri', hint: 'Buyurtma umumiy qutiga tushadi — kuryerlardan kim ulgursa oladi. Yetkazish puli kuryerga, LokmaGo foizini oladi.' },
  { id: 'both', title: 'Ikkalasi', hint: 'Restoran har buyurtmada tanlaydi: «O‘zim yetkazaman» yoki «LokmaGo kuryeri».' },
];

export const som = (n) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} so‘m`;
