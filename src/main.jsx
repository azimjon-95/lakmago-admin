import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

/*
 * KESHLASH (2026-08 optimizatsiya).
 *
 * Muammo: admin panelda React Query o'rnatilgan bo'lsa-da,
 * UMUMAN ishlatilmayotgan edi — har bir sahifa useEffect+fetch
 * bilan ishlardi. Natijada bir sahifadan ikkinchisiga o'tib
 * qaytganda hamma narsa NOLDAN qayta yuklanardi ("hadeb
 * zagruzka" shikoyatining sababi).
 *
 * Sozlamalar tanlovi:
 *  - staleTime 60s: shu vaqt ichida qayta so'rov YUBORILMAYDI,
 *    sahifalar orasida o'tish darhol bo'ladi
 *  - gcTime 5daq: sahifadan chiqib ketilsa ham kesh saqlanadi
 *  - refetchOnWindowFocus false: boshqa oynadan qaytganda
 *    keraksiz so'rovlar bo'lmaydi (kompyuterga yuk berardi)
 *  - retry 1: tarmoq uzilsa cheksiz urinib brauzerni qotirmasin
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
