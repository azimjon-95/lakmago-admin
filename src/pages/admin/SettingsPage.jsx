import { useState, useEffect } from 'react';
import { adminApi } from '@/api';

// Komissiya rejimlari — mijoz/restoranга ta'sirini tushuntiradi
const MODES = [
  {
    value: 'none',
    label: 'Komissiyasiz',
    icon: 'ti-circle',
    desc: 'Hozircha komissiya olinmaydi (0%). Keyin yoqishingiz mumkin.',
  },
  {
    value: 'markup',
    label: 'Narx ustiga qo\u2018shish',
    icon: 'ti-arrow-up-circle',
    desc: 'Mijoz taom narxi ustiga komissiya qo\u2018shib to\u2018laydi. Restoran to\u2018liq narxni oladi, foyda platformaga.',
  },
  {
    value: 'deduct',
    label: 'Narxdan olish',
    icon: 'ti-arrow-down-circle',
    desc: 'Restoran taom narxidan komissiya ushlab qolinadi. Mijoz oddiy narx to\u2018laydi, foyda restoran hisobidan.',
  },
];

export function SettingsPage() {
  const [percent, setPercent] = useState(0);
  const [mode, setMode] = useState('none');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getSettings()
      .then((s) => { setPercent(s.commissionPercent); setMode(s.commissionMode); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings({ commissionPercent: Number(percent), commissionMode: mode });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Misol hisob (10 000 so'mlik taom)
  const example = 10000;
  const commission = Math.round(example * (percent / 100));
  let clientPays = example, restaurantGets = example, platformGets = 0;
  if (mode === 'markup') { clientPays = example + commission; platformGets = commission; restaurantGets = example; }
  else if (mode === 'deduct') { clientPays = example; platformGets = commission; restaurantGets = example - commission; }

  if (loading) return <div className="flex-1 p-6 text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <div className="flex-1 p-6 min-w-0 max-w-2xl">
      <h1 className="text-xl font-semibold text-ink">Komissiya sozlamalari</h1>
      <p className="text-sm text-muted mt-0.5 mb-6">Platforma daromadini qanday hisoblashni belgilang</p>

      {/* Rejim tanlash */}
      <div className="grid gap-3 mb-6">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              mode === m.value ? 'border-brand-400 bg-brand-50' : 'border-line hover:bg-canvas'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <i className={`ti ${m.icon} text-lg ${mode === m.value ? 'text-brand-600' : 'text-muted'}`} />
              <span className={`font-medium ${mode === m.value ? 'text-brand-600' : 'text-ink'}`}>{m.label}</span>
              {mode === m.value && <i className="ti ti-check text-brand-600 ml-auto" />}
            </div>
            <p className="text-sm text-muted leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Foiz */}
      {mode !== 'none' && (
        <div className="bg-surface border border-line rounded-xl p-4 mb-6">
          <label className="block text-sm font-medium text-ink mb-2">Komissiya foizi</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="30" step="0.5"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="flex-1 accent-brand-400"
            />
            <div className="flex items-center gap-1 bg-canvas border border-line rounded-lg px-3 py-2">
              <input
                type="number" min="0" max="100" step="0.5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-14 bg-transparent text-ink text-right outline-none font-semibold"
              />
              <span className="text-muted">%</span>
            </div>
          </div>

          {/* Misol hisob */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-xs text-muted mb-2">Misol: 10 000 so'mlik taom uchun</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-canvas rounded-lg py-2">
                <div className="text-[11px] text-muted">Mijoz to'laydi</div>
                <div className="text-sm font-semibold text-ink">{clientPays.toLocaleString('ru-RU')}</div>
              </div>
              <div className="bg-canvas rounded-lg py-2">
                <div className="text-[11px] text-muted">Restoran oladi</div>
                <div className="text-sm font-semibold text-green-600">{restaurantGets.toLocaleString('ru-RU')}</div>
              </div>
              <div className="bg-brand-50 rounded-lg py-2">
                <div className="text-[11px] text-brand-600">Platforma</div>
                <div className="text-sm font-semibold text-brand-600">{platformGets.toLocaleString('ru-RU')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="bg-brand-400 text-brand-text font-medium px-6 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50"
      >
        {saving ? 'Saqlanmoqda...' : saved ? '✓ Saqlandi' : 'Saqlash'}
      </button>
    </div>
  );
}
