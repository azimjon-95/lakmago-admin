# District — admin (Vercel) tomoni: cheklangan haqiqiy test

Branch: `feature/district-production-test`. `main` o'zgarmagan. Server bosqichlari: `lakmago-server/docs/DISTRICT-PRODUCTION-TEST.md`.

## Vercel holati (tekshirilgan, faqat o'qish)

Loyiha `lakmago-admin`. Mavjud ENV'lar (hammasi "sensitive", qiymatlari ko'rinmaydi — TEKSHIRA OLMADIM), hammasi Production + Preview:
`VITE_YANDEX_MAPS_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_RESTAURANT_ID`.
`VITE_DISTRICT_BOUNDARIES_ENABLED` **mavjud emas** → production'da district bloki O'CHIQ.
`VITE_API_URL` Preview'da ham bor → Preview admin **production API**ga ulanadi: u yerdagi yozuvlar HAQIQIY.

## Flag

| ENV | Production | Preview (branch `feature/district-production-test`) |
|---|---|---|
| `VITE_DISTRICT_BOUNDARIES_ENABLED` | **QO'YMANG** | `true` (server `DISTRICT_BOUNDARIES_ENABLED` yoqilgandan KEYIN) |

Qiymat aynan `true`. Server o'chiq bo'lsa blok ko'rinmaydi (`/admin/district-preview` → `enabled:false`).
Vercel → `lakmago-admin` → Settings → Environment Variables → Preview + Git Branch tanlab qo'shing → Redeploy.

## Admin test ehtiyotkorligi

- FAQAT o'qish: restoran xaritasida nuqta qo'yib "qaysi tuman" ko'rsatkichini ko'ring (`district-preview`, bazaga yozmaydi).
- Restoran yaratish/tahrirlash, "xizmat hududi" va bosh admin override — HAQIQIY yozuv. Test davomida qilmang (override sabab bilan audit yozadi).
- Kuryer tumani (`Restaurant.district`) o'zgarmaydi — "Kuryer xizmati tumani" maydoni avvalgidek ishlashini tekshiring.

## Rollback

Preview env'ni o'chiring → Redeploy. Production'ga tegilmagan.
