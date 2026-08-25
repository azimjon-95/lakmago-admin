import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi } from '@/api';
import { getSocket } from '@/lib/socket';
import { Img } from '@/components/Img';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// Kategoriya nomlari — menyu bilan bir xil
const CAT_LABEL = {
  milliy: 'Milliy taom', osh: 'Osh', shashlik: 'Shashlik',
  sup: "Sho'rva", salat: 'Salatlar', choyxona: 'Choyxona',
  zavtroki: 'Nonushta', obed: 'Tushlik', fastfood: 'Fast food',
  lavash: 'Lavash', burger: 'Burger', tovuq: 'Tovuq',
  pitsa: 'Pitsa', sushi: 'Sushi', evropa: 'Yevropa',
  turetskaya: 'Turk taomlari', koffe: 'Qahva',
  shirinlik: 'Shirinlik', salqin: 'Ichimlik',
  magazin_oziq: "Do'kon mahsuloti",
};

export function StopListPage() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    panelApi.getStoppedDishes()
      .then((list) => setDishes(Array.isArray(list) ? list : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    // Menyu sahifasidan stop qo'yilsa bu ro'yxat ham yangilanadi
    const socket = getSocket();
    socket.on('dish:stop', load);
    return () => socket.off('dish:stop', load);
  }, [load]);

  const restore = async (dish) => {
    if (busyId) return;
    setBusyId(dish._id);

    // Darhol ro'yxatdan olib tashlaymiz — javob kutmaymiz
    setDishes((prev) => prev.filter((d) => d._id !== dish._id));

    try {
      await panelApi.toggleStop(dish._id, false);
    } catch (e) {
      // Xato bo'lsa qaytaramiz
      setDishes((prev) => [dish, ...prev]);
      alert(e.message || 'Qaytarib bo\u2018lmadi');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted text-sm">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Stop List</h1>
        <p className="text-sm text-muted mt-0.5">
          Vaqtincha to'xtatilgan taomlar — mijozlarga ko'rinmaydi
        </p>
      </div>

      {dishes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-circle-check text-3xl text-green-600" />
          </div>
          <div className="text-ink font-medium">Stop List bo'sh</div>
          <p className="text-sm text-muted mt-1.5 max-w-xs mx-auto leading-relaxed">
            Barcha taomlar sotuvda. Taom tugasa menyudan
            <b className="text-ink"> STOP </b>
            tugmasini bosing.
          </p>
          <button
            onClick={() => navigate('/menu')}
            className="mt-5 border border-line text-muted px-4 py-2 rounded-xl hover:bg-canvas text-sm"
          >
            Menyuga o'tish
          </button>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted mb-3">
            {dishes.length} ta taom to'xtatilgan
          </div>

          <div className="space-y-2.5">
            {dishes.map((d) => (
              <div
                key={d._id}
                className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3"
              >
                {/* Rasm */}
                {d.imageUrl || d.images?.[0] ? (
                  <Img
                    src={d.imageUrl || d.images[0]} w={112}
                    className="w-14 h-14 rounded-lg object-cover flex-none bg-canvas grayscale"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-canvas flex items-center justify-center flex-none">
                    <i className="ti ti-tools-kitchen-2 text-muted" />
                  </div>
                )}

                {/* Ma'lumot */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink truncate">
                    {d.name}
                    {d.volume && (
                      <span className="text-muted font-normal"> · {d.volume}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{CAT_LABEL[d.category] || d.category}</span>
                    <span className="text-line">·</span>
                    <span className="text-ink font-medium">{som(d.price)} so'm</span>
                  </div>
                </div>

                {/* Qaytarish */}
                <button
                  onClick={() => restore(d)}
                  disabled={busyId === d._id}
                  className="flex-none bg-green-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {busyId === d._id ? '...' : "Stop'dan chiqarish"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
