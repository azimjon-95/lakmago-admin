import { som, signed, pct, periodLabel } from './format';

/*
 * ═══════════════════════════════════════════════════════════
 * DAVR HISOB VARAQASI — "shu davrda qancha ishladim va pul qayerda"
 * ═══════════════════════════════════════════════════════════
 *
 * Chek shaklida: yuqorida ulush qanday chiqqani (taom − komissiyangiz
 * + yetkazish), pastda pul qayerda turgani (karta — LokmaGo o'tkazadi,
 * naqd — sizda, LokmaGo qismi), oxirida davr natijasi.
 *
 * Mijoz xizmat haqi alohida aytiladi: uni mijoz to'laydi va u
 * ulushingizdan ushlanmaydi. Naqd buyurtmada esa uni ham siz olgansiz,
 * shuning uchun u "LokmaGo qismi"ga kiradi — aks holda restoran
 * "nega 2,5% emas, 5%" deb so'raydi.
 */
export function PeriodStatement({ period, orders, finance }) {
  const f = finance || {};
  const n = orders?.ordersTotal ?? 0;
  const net = Number(f.net) || 0;

  if (!n && !f.payouts?.amount && !f.bonusCompensation) {
    return (
      <section className="rb-stmt" data-testid="period-statement">
        <header className="rb-stmt__head">
          <h2>Hisob varaqasi</h2>
          <span>{periodLabel(period?.from, period?.to)}</span>
        </header>
        <p className="rb-stmt__empty">
          Bu davrda yakunlangan buyurtma yo‘q. Sanani o‘zgartirib ko‘ring.
        </p>
      </section>
    );
  }

  return (
    <section className="rb-stmt" data-testid="period-statement">
      <header className="rb-stmt__head">
        <h2>Hisob varaqasi</h2>
        <span>{periodLabel(period?.from, period?.to)}</span>
      </header>

      <dl className="rb-stmt__lines">
        <Line label={`Taom savdosi · ${n} ta buyurtma`} value={som(f.food)} />
        <Line
          label={`Komissiyangiz${f.commissionPercent != null ? ` (${pct(f.commissionPercent)})` : ''}`}
          value={`−${som(f.commission)}`}
          tone="minus"
        />
        {f.delivery > 0 && <Line label="Yetkazish puli (sizning kuryeringiz)" value={`+${som(f.delivery)}`} />}
        <Line label="Ulushingiz" value={som(f.share)} strong />
      </dl>

      {f.customerFee > 0 && (
        <p className="rb-stmt__aside">
          Mijoz xizmat haqi{f.customerFeePercent != null ? ` (${pct(f.customerFeePercent)})` : ''} — {som(f.customerFee)} so‘m.
          Uni mijoz to‘laydi, ulushingizdan ushlanmaydi.
        </p>
      )}

      <h3 className="rb-stmt__sub">Pul qayerda</h3>
      <dl className="rb-stmt__lines">
        {f.fromLokma > 0 && (
          <Line
            label="Karta va LokmaGo kuryeri orqali — LokmaGo sizga o‘tkazadi"
            value={`+${som(f.fromLokma)}`}
            tone="plus"
          />
        )}
        {f.cashCollected > 0 && (
          <Line label="Naqd — qo‘lingizga tushgan" value={som(f.cashCollected)} muted />
        )}
        {f.toLokma > 0 && (
          <Line
            label="Naqddan LokmaGo qismi (komissiya + mijoz xizmat haqi)"
            value={`−${som(f.toLokma)}`}
            tone="minus"
          />
        )}
        {f.bonusCompensation > 0 && (
          <Line label="Sovg‘a bonusi qoplanishi" value={`+${som(f.bonusCompensation)}`} tone="plus" />
        )}
        <Line
          label={net >= 0 ? 'Davr natijasi — LokmaGo sizga' : 'Davr natijasi — siz LokmaGo’ga'}
          value={`${signed(net)} so‘m`}
          strong
          tone={net >= 0 ? 'plus' : 'minus'}
          testid="period-net"
        />
      </dl>

      {f.payouts?.amount > 0 && (
        <p className="rb-stmt__foot">
          Shu davrda sizga o‘tkazildi: <b>{som(f.payouts.amount)} so‘m</b>
          {f.payouts.count > 1 ? ` (${f.payouts.count} marta)` : ''}
        </p>
      )}
      {f.legacyOrders > 0 && (
        <p className="rb-stmt__foot">
          {f.legacyOrders} ta buyurtma eski tizimda yozilgan — ularning komissiyasi va ulushi bu varaqaga kirmagan,
          pastdagi kunlik jadvalda ko‘rinadi.
        </p>
      )}
    </section>
  );
}

function Line({ label, value, strong, muted, tone, testid }) {
  return (
    <div className={`rb-stmt__line${strong ? ' is-strong' : ''}${muted ? ' is-muted' : ''}${tone ? ` is-${tone}` : ''}`} data-testid={testid}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
