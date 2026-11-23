import { som, dayLabel } from './format';

/*
 * Kunlik hisob-kitob. Buyurtma ustunlari (buyurtma, taom, komissiya,
 * ulush, naqddan LokmaGo qismi) — shu kuni YAKUNLANGAN buyurtmalar.
 * O'tkazma va bonus — shu kuni yozilgan pul harakati. Kun — Toshkent
 * kuni (server hisoblaydi).
 */
export function DailyTable({ rows, loading }) {
  return (
    <section className="mt-6" data-testid="daily-table">
      <h2 className="text-sm font-semibold text-ink mb-2.5">Kunlik hisob-kitob</h2>

      {loading ? (
        <div className="text-muted text-sm py-6 text-center">Yuklanmoqda...</div>
      ) : !rows?.length ? (
        <div className="text-center text-muted text-sm py-8 border border-dashed border-line rounded-xl">
          Bu davrda yozuv yo‘q
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-muted text-xs">
                  <th className="px-4 py-2.5 font-medium">Sana</th>
                  <th className="px-3 py-2.5 font-medium text-right">Buyurtma</th>
                  <th className="px-3 py-2.5 font-medium text-right">Taom</th>
                  <th className="px-3 py-2.5 font-medium text-right">Komissiya</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ulushingiz</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Naqd buyurtmalardan LokmaGo'ga beriladigan qism">Naqddan LokmaGo qismi</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Mijozga bepul bergan sovg‘alar puli — LokmaGo qoplaydi">Sovg‘a bonusi</th>
                  <th className="px-4 py-2.5 font-medium text-right">O‘tkazildi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium text-ink whitespace-nowrap">{dayLabel(d.day)}</td>
                    <td className="px-3 py-2.5 text-right text-ink">
                      {d.orders || '—'}
                      {d.orders > 0 && <span className="text-muted text-xs"> ({d.cashOrders} naqd)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink">{d.o_food ? som(d.o_food) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">{d.o_commission > 0 ? `−${som(d.o_commission)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">{d.o_share ? som(d.o_share) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">{d.o_toLokma > 0 ? `−${som(d.o_toLokma)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-green-600">{d.bonusKompensatsiya > 0 ? `+${som(d.bonusKompensatsiya)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{d.tolangan > 0 ? som(d.tolangan) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 md:hidden">
            {rows.map((d) => (
              <div key={d.day} className="rb-daycard">
                <div className="rb-daycard__head">
                  <b>{dayLabel(d.day)}</b>
                  <span>{d.orders ? `${d.orders} ta buyurtma` : 'Buyurtma yo‘q'}</span>
                </div>
                <div className="rb-daycard__rows">
                  {d.o_food > 0 && <div><span>Taom savdosi</span><span className="text-ink">{som(d.o_food)}</span></div>}
                  {d.o_commission > 0 && <div><span>Komissiya</span><span className="text-red-600">−{som(d.o_commission)}</span></div>}
                  {d.o_share > 0 && <div><span>Ulushingiz</span><span className="font-medium text-ink">{som(d.o_share)}</span></div>}
                  {d.o_toLokma > 0 && <div><span>Naqddan LokmaGo qismi</span><span className="text-red-600">−{som(d.o_toLokma)}</span></div>}
                  {d.bonusKompensatsiya > 0 && <div><span>Sovg‘a bonusi</span><span className="text-green-600">+{som(d.bonusKompensatsiya)}</span></div>}
                  {d.tolangan > 0 && <div><span>Sizga o‘tkazildi</span><span className="text-green-600">{som(d.tolangan)}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
