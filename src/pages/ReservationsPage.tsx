import { useState } from 'react';

interface PanelReservation {
  _id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'rejected';
}

const demo: PanelReservation[] = [
  { _id: 'rv1', name: 'Aziz Karimov', phone: '+998 90 123 45 67', date: '12 iyul', time: '18:30', guests: 4, status: 'pending' },
  { _id: 'rv2', name: 'Dilnoza Yusupova', phone: '+998 93 555 22 11', date: '12 iyul', time: '19:00', guests: 2, status: 'confirmed' },
  { _id: 'rv3', name: 'Sardor Aliyev', phone: '+998 91 777 88 99', date: '13 iyul', time: '20:00', guests: 6, status: 'pending' },
];

export function ReservationsPage() {
  const [list, setList] = useState(demo);

  function setStatus(id: string, status: PanelReservation['status']) {
    setList((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)));
    // Real: panelApi.updateReservation(id, status) → mijozga Telegram push
  }

  return (
    <div className="flex-1 p-5 min-w-0">
      <h1 className="text-lg font-medium text-ink mb-4">Stol bronlari</h1>
      <div className="flex flex-col gap-2.5">
        {list.map((r) => (
          <div key={r._id} className="bg-surface border border-line rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm font-medium text-ink">{r.name}</div>
              {r.status === 'confirmed' && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56]">
                  Tasdiqlangan
                </span>
              )}
              {r.status === 'rejected' && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FCEBEB] text-[#A32D2D]">
                  Rad etilgan
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted mb-2.5">
              <i className="ti ti-calendar text-xs align-[-1px]" aria-hidden="true" /> {r.date}, {r.time}{' '}
              · <i className="ti ti-users text-xs align-[-1px]" aria-hidden="true" /> {r.guests} kishi ·{' '}
              {r.phone}
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setStatus(r._id, 'confirmed')}
                  className="flex-1 bg-brand-400 text-brand-text text-[13px] font-medium py-2 rounded-lg"
                >
                  Tasdiqlash
                </button>
                <button
                  onClick={() => setStatus(r._id, 'rejected')}
                  className="border border-line text-muted text-[13px] px-4 rounded-lg"
                >
                  Rad etish
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
