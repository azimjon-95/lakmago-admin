import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { weddingApi } from '@/api';
import { PageHeader, ErrorBox, som } from './common';

/* To'yxonalar bo'limi — boshqaruv paneli (faqat to'yxona serveri ma'lumoti) */
export function WeddingDashboardPage() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    weddingApi.stats().then(setS).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const Card = ({ to, icon, label, value, sub, tone = '' }) => (
    <Link to={to} className={`bg-surface border border-line rounded-2xl p-4 hover:border-brand-400 transition-colors ${tone}`}>
      <div className="flex items-center gap-2 text-xs text-muted"><i className={`ti ${icon} text-base`} />{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-ink tabular-nums">{value ?? '—'}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Link>
  );

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <PageHeader title="To'yxonalar — boshqaruv" subtitle="Lokma To'yxonalari: alohida server va baza">
        <button onClick={load} className="border border-line text-muted px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-1.5 text-sm">
          <i className="ti ti-refresh" /> Yangilash
        </button>
      </PageHeader>
      <ErrorBox error={err} onRetry={load} />
      {!s && !err ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card to="/weddings/venues" icon="ti-building-castle" label="To'yxonalar" value={s.venues.total}
              sub={`${s.venues.active} faol · ${s.venues.blocked} bloklangan`} />
            <Card to="/weddings/payments" icon="ti-alert-triangle" label="Qarzdorlar" value={s.subscriptions.overdue}
              sub={`Qarz: ${som(s.subscriptions.debt_amount)} so'm`} tone={s.subscriptions.overdue ? 'border-red-200' : ''} />
            <Card to="/weddings/payments" icon="ti-receipt" label="Shu oy to'landi" value={`${som(s.subscriptions.paid_this_month)}`}
              sub={`${s.subscriptions.payments_this_month} ta to'lov · ${s.subscriptions.due_soon} tasi muddati yaqin`} />
            <Card to="/weddings/bookings" icon="ti-calendar-event" label="Kelayotgan bronlar" value={s.bookings.upcoming}
              sub={`Kutilmoqda: ${s.bookings.by_status.pending || 0}`} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card to="/weddings/bookings" icon="ti-calendar-check" label="Shu oy to'ylar" value={s.bookings.this_month}
              sub={`${som(s.bookings.this_month_total)} so'm`} />
            <Card to="/weddings/bookings" icon="ti-x" label="Bekor qilingan" value={s.bookings.by_status.cancelled || 0} />
            <Card to="/weddings/videographers" icon="ti-video" label="Videochilar" value={s.vendors.video} />
            <Card to="/weddings/corteges" icon="ti-car" label="Kortejlar" value={s.vendors.cortege}
              sub={s.vendors.blocked ? `${s.vendors.blocked} bloklangan xizmat` : undefined} />
          </div>
        </>
      )}
    </div>
  );
}
