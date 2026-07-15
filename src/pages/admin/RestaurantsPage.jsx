import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/api';
import { CATEGORIES, KINDS, KIND_LABEL } from './restaurantMeta';


export function RestaurantsPage() {
  const [list, setList] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await adminApi.getRestaurants());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (r) => {
    await adminApi.updateRestaurant(r._id, { isActive: !r.isActive });
    load();
  };

  const toggleBlock = async (r) => {
    const action = r.isBlocked ? 'blokdan chiqarish' : 'BLOKLASH';
    const warn = r.isBlocked ? '' : ' Bloklansa mijozlarga taomlari bilan ko\u2018rinmaydi.';
    if (!confirm(`"${r.name}" ${action}?${warn}`)) return;
    await adminApi.toggleBlock(r._id, !r.isBlocked);
    load();
  };

  const remove = async (r) => {
    if (!confirm(`"${r.name}" o'chirilsinmi? Akkaunt ham o'chadi.`)) return;
    await adminApi.deleteRestaurant(r._id);
    load();
  };

  const resetPass = async (r) => {
    const p = prompt(`"${r.name}" uchun yangi parol:`);
    if (!p) return;
    await adminApi.resetPassword(r._id, p);
    alert('Parol yangilandi');
  };

  return (
    <div className="flex-1 p-6 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Muassasalar</h1>
          <p className="text-sm text-muted mt-0.5">Restoran, kafe va magazinlarni boshqarish</p>
        </div>
        <button
          onClick={() => navigate('/restaurants/new')}
          className="bg-brand-400 text-brand-text font-medium px-4 py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors flex items-center gap-2"
        >
          <i className="ti ti-plus" /> Yangi qo'shish
        </button>
      </div>

      {err && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : (
        <div className="grid gap-3">
          {list.length === 0 && (
            <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
              Hozircha muassasa yo'q. "Yangi qo'shish" tugmasini bosing.
            </div>
          )}
          {list.map((r) => (
            <div key={r._id} className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-none">
                <i className={`ti ${r.icon || 'ti-building-store'} text-xl text-brand-600`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600">
                    {KIND_LABEL[r.kind] || 'Restoran'}
                  </span>
                  {r.isBlocked ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">🚫 Bloklangan</span>
                  ) : r.isActive ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Faol</span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Yopiq</span>
                  )}
                </div>
                <div className="text-sm text-muted mt-0.5">{r.cuisine}</div>
                {r.ownerLogin && (
                  <div className="text-xs text-muted mt-1">
                    <i className="ti ti-user text-[11px]" /> login: <span className="font-mono text-ink">{r.ownerLogin}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-none">
                <button
                  onClick={() => toggleActive(r)}
                  title={r.isActive ? 'Yopish' : 'Ochish'}
                  className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted"
                >
                  <i className={`ti ${r.isActive ? 'ti-lock' : 'ti-lock-open'}`} />
                </button>
                <button
                  onClick={() => toggleBlock(r)}
                  title={r.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${r.isBlocked ? 'border-red-300 bg-red-50 text-red-600' : 'border-line hover:bg-canvas text-muted'}`}
                >
                  <i className={`ti ${r.isBlocked ? 'ti-ban' : 'ti-shield-x'}`} />
                </button>
                <button
                  onClick={() => resetPass(r)}
                  title="Parolni almashtirish"
                  className="w-9 h-9 rounded-lg border border-line hover:bg-canvas flex items-center justify-center text-muted"
                >
                  <i className="ti ti-key" />
                </button>
                <button
                  onClick={() => remove(r)}
                  title="O'chirish"
                  className="w-9 h-9 rounded-lg border border-line hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-500"
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

