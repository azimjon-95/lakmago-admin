# LokmaGo — Restoran paneli

Restoran egalari uchun desktop veb-panel. React + JavaScript + Vite + Tailwind + TanStack Query + Socket.IO.

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm run dev      # http://localhost:5174
npm run build
```

`.env`:
```
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
VITE_RESTAURANT_ID=<restoran ID>   # bo'lmasa demo rejimi
```

## Bo'limlar

- Buyurtmalar — real-time kelayotgan buyurtmalar, status oqimi (Yangi → Tayyorlanmoqda → Yo'lda → Yetkazildi), statistika kartalari
- Menyu — taomlar ro'yxati, mavjudlik toggle, narx va tahrirlash
- Aksiyalar, Statistika, Sozlamalar — keyingi bosqich

## Real-time

`join:restaurant` orqali restoran o'z xonasiga qo'shiladi, yangi buyurtma
kelganda `order:new` hodisasi ro'yxatni yangilaydi. Status o'zgartirilganda
`PATCH /orders/:id/status` chaqiriladi va mijozga `order:status` yuboriladi.

## Demo rejimi

`VITE_RESTAURANT_ID` yoki backend bo'lmasa, panel demo ma'lumot bilan ishlaydi —
UI to'liq ko'rinadi, tugmalar mahalliy holatni o'zgartiradi.
