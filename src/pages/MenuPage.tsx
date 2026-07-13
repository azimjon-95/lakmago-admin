import { useState } from 'react';
import type { PanelDish } from '@/api';

const demoDishes: PanelDish[] = [
  { _id: 'd1', section: 'Milliy taomlar', name: 'Osh (Palov)', description: 'Toshkent uslubida', price: 38000, icon: 'ti-bowl', tint: '#FAEEDA', isAvailable: true },
  { _id: 'd2', section: 'Milliy taomlar', name: 'Lag‘mon', description: 'Qo‘lda cho‘zilgan', price: 32000, oldPrice: 40000, icon: 'ti-soup', tint: '#FAEEDA', isAvailable: true },
  { _id: 'd3', section: 'Milliy taomlar', name: 'Manti (5 dona)', description: 'Bug‘da pishirilgan', price: 28000, icon: 'ti-meat', tint: '#FAEEDA', isAvailable: false },
  { _id: 'd4', section: 'Shashlik', name: 'Kabob set', description: 'Assorti', price: 45000, oldPrice: 60000, icon: 'ti-meat', tint: '#FCEBEB', isAvailable: true },
];

function formatSom(v: number) {
  return v.toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function MenuPage() {
  const [dishes, setDishes] = useState(demoDishes);

  function toggle(id: string) {
    setDishes((prev) =>
      prev.map((d) => (d._id === id ? { ...d, isAvailable: !d.isAvailable } : d)),
    );
    // Real: panelApi.toggleDish(id, !current)
  }

  const sections = Array.from(new Set(dishes.map((d) => d.section)));

  return (
    <div className="flex-1 p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-ink">Menyu</h1>
        <button className="bg-brand-ink text-white text-[13px] font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
          <i className="ti ti-plus text-base" aria-hidden="true" /> Taom qo‘shish
        </button>
      </div>

      {sections.map((section) => (
        <div key={section} className="mb-5">
          <div className="text-sm font-medium text-muted mb-2">{section}</div>
          <div className="flex flex-col gap-2">
            {dishes
              .filter((d) => d.section === section)
              .map((dish) => (
                <div
                  key={dish._id}
                  className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex-none flex items-center justify-center"
                    style={{ background: dish.tint }}
                  >
                    <i
                      className={`ti ${dish.icon} text-xl`}
                      style={{ color: '#EF9F27' }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink">{dish.name}</div>
                    <div className="text-xs text-muted">{dish.description}</div>
                  </div>
                  <div className="text-sm text-ink whitespace-nowrap">
                    {dish.oldPrice && (
                      <span className="text-muted line-through text-xs mr-1">
                        {formatSom(dish.oldPrice)}
                      </span>
                    )}
                    {formatSom(dish.price)} so‘m
                  </div>
                  <button className="text-muted hover:text-ink p-1" aria-label="Tahrirlash">
                    <i className="ti ti-edit text-lg" aria-hidden="true" />
                  </button>
                  {/* Mavjudlik toggle */}
                  <button
                    onClick={() => toggle(dish._id)}
                    className="w-11 h-6 rounded-full flex-none relative transition-colors"
                    style={{ background: dish.isAvailable ? '#EF9F27' : '#D3D1C7' }}
                    aria-label="Mavjudlik"
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
                      style={{ left: dish.isAvailable ? '22px' : '2px' }}
                    />
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
