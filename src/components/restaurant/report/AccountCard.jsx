import { som, dateTimeLabel } from './format';

/*
 * UMUMIY HISOB — davrga bog'liq EMAS (tanlangan sana uni o'zgartirmaydi).
 * Ilgari bu karta "Bugun" kartalari orasida turardi va restoran
 * "bugun buyurtma yo'q, nega 7 000 qarzman?" deb o'ylardi. Endi
 * alohida, "barcha vaqt bo'yicha" ekani yozilgan va oxirgi o'tkazma
 * ko'rinadi.
 */
export function AccountCard({ payout }) {
  const owed = payout?.owedToLokma || 0;
  const pending = payout?.pendingToReceive || 0;
  const last = payout?.lastPayout;

  const state = owed > 0 ? 'owe' : pending > 0 ? 'receive' : 'zero';

  return (
    <section className={`rb-acc rb-acc--${state}`} data-testid="account-card">
      <div className="rb-acc__label">Umumiy hisob · barcha vaqt bo‘yicha</div>
      <div className="rb-acc__value">
        {state === 'owe' ? som(owed) : som(pending)} <span>so‘m</span>
      </div>
      <div className="rb-acc__what">
        {state === 'owe' && 'Siz LokmaGo’ga berishingiz kerak — naqd buyurtmalar komissiyasi. Keyingi karta tushumlaridan ushlab qolinadi.'}
        {state === 'receive' && 'LokmaGo sizga o‘tkazishi kerak — karta orqali tushgan ulushingiz.'}
        {state === 'zero' && 'Hisob-kitob teng: hech kim hech kimga qarzdor emas.'}
      </div>
      <dl className="rb-acc__facts">
        <div><dt>Jami o‘tkazilgan</dt><dd>{som(payout?.totalPaidOutSoFar)} so‘m</dd></div>
        <div>
          <dt>Oxirgi o‘tkazma</dt>
          <dd>{last ? `${som(last.amount)} so‘m · ${dateTimeLabel(last.at)}` : 'Hali bo‘lmagan'}</dd>
        </div>
      </dl>
    </section>
  );
}
