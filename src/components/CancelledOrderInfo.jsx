import { OrderFullInfo } from '@/components/OrderFullInfo';

/*
 * Eski nom saqlanadi (boshqa joylar import qilsa buzilmasin).
 * Endi barcha holatlar uchun yagona komponent — OrderFullInfo.
 */
export function CancelledOrderInfo({ order }) {
  return <OrderFullInfo order={order} />;
}
