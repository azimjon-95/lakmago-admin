import { useState, useEffect, useCallback } from 'react';
import { panelApi } from '@/api';
import { NumberInput, MoneyInput } from '@/components/form/NumberInput';
import { useLockScroll } from '@/hooks/useLockScroll';
import { confirm } from '@/components/ui/confirm';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

const CATEGORIES = [
  ['milliy', 'Milliy taom'], ['osh', 'Osh'], ['shashlik', 'Shashlik'],
  ['sup', "Sho'rva"], ['salat', 'Salatlar'], ['choyxona', 'Choyxona'],
  ['zavtroki', 'Nonushta'], ['obed', 'Tushlik'], ['fastfood', 'Fast food'],
  ['lavash', 'Lavash'], ['burger', 'Burger'], ['tovuq', 'Tovuq'],
  ['pitsa', 'Pitsa'], ['sushi', 'Sushi'], ['evropa', 'Yevropa'],
  ['turetskaya', 'Turk taomlari'], ['koffe', 'Qahva'],
  ['shirinlik', 'Shirinlik'], ['salqin', 'Ichimlik'],
];

const PLACEMENTS = [
  ['home', 'Bosh sahifa'],
  ['category', 'Kategoriya'],
  ['search', 'Qidiruv'],
];

export function PromotionPage() {
  const [tab, setTab] = useState('promotions');
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    panelApi.getPromoOverview().then(setOverview).catch(() => {});
  }, [tab]);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink mb-1">Mijozlarni jalb qilish</h1>
      <p className="text-sm text-muted mb-5">
        Aksiya, reklama va bonuslar bilan mijoz jalb qiling
      </p>

      {/* Xizmat narxi va qarz */}
      {overview?.xizmat && (
        <div className="bg-surface border border-line rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted">Xizmat narxi</div>
              <div className="text-sm font-semibold text-ink">
                {som(overview.xizmat.kunlikNarx)} so'm / 24 soat
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-muted">Joriy qarz</div>
              <div className={`text-lg font-bold ${
                overview.xizmat.qarz > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {som(overview.xizmat.qarz)} so'm
              </div>
              {overview.xizmat.kunlar > 0 && (
                <div className="text-[11px] text-muted">
                  {overview.xizmat.kunlar} kun
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            Aksiya va reklama birga ishlatilsa ham bitta narx olinadi.
            Bonus narxni oshirmaydi.
          </p>
        </div>
      )}

      {/* Umumiy ko'rsatkichlar */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat label="Aksiya chegirmasi" value={overview.aksiyalar.chegirma} />
          <Stat label="Aksiya tushumi" value={overview.aksiyalar.tushum} accent />
          <Stat label="Berilgan bonus" value={overview.bonuslar.berilgan} />
          <Stat label="Reklama xarajati" value={overview.reklama.xarajat} />
        </div>
      )}

      <div className="flex gap-2 mb-4 border-b border-line overflow-x-auto">
        {[
          ['promotions', 'Aksiyalar'],
          ['ads', 'Reklama'],
          ['bonuses', 'Bonuslar'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === k ? 'border-brand-400 text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'promotions' && <Promotions />}
      {tab === 'ads' && <Ads overview={overview} />}
      {tab === 'bonuses' && <Bonuses />}
    </div>
  );
}

/* ═══ AKSIYALAR ═══ */
function Promotions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getPromotions()
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (p) => {
    if (!await confirm({ title: `"${p.name}" o'chirilsinmi?` })) return;
    try { await panelApi.deletePromotion(p._id); load(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <>
      <button
        onClick={() => setEditing('new')}
        className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl mb-4"
      >
        <i className="ti ti-plus" /> Aksiya yaratish
      </button>

      {items.length === 0 ? (
        <Empty icon="ti-discount" title="Aksiya yo'q"
          text="Chegirma yarating — mijozlar ko'proq buyurtma beradi" />
      ) : (
        <div className="space-y-2.5">
          {items.map((p) => (
            <div key={p._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-sm text-brand-600 font-semibold mt-0.5">
                    {p.discountType === 'percent'
                      ? `−${p.discountValue}%`
                      : `−${som(p.discountValue)} so'm`}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${
                  p.running ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
                }`}>
                  {p.running ? 'Faol' : p.isActive ? 'Kutilmoqda' : "O'chiq"}
                </span>
              </div>

              <div className="text-xs text-muted space-y-0.5">
                <div>{fmtDate(p.startsAt)} — {fmtDate(p.endsAt)}</div>
                {p.minOrderAmount > 0 && (
                  <div>Minimal: {som(p.minOrderAmount)} so'm</div>
                )}
                <div>
                  Ishlatilgan: {p.usedCount}
                  {p.maxUses > 0 && ` / ${p.maxUses}`}
                  {p.stats?.totalDiscount > 0 && ` · ${som(p.stats.totalDiscount)} so'm chegirma`}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(p)}
                  className="flex-1 border border-line text-muted py-2 rounded-lg text-sm">
                  Tahrirlash
                </button>
                <button onClick={() => remove(p)}
                  className="px-3 border border-line text-red-500 py-2 rounded-lg">
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PromoForm
          promo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function PromoForm({ promo, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(promo);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: promo?.name || '',
    discountType: promo?.discountType || 'percent',
    discountValue: promo?.discountValue ?? null,
    scope: promo?.scope || 'all',
    categories: promo?.categories || [],
    minOrderAmount: promo?.minOrderAmount ?? null,
    maxDiscountAmount: promo?.maxDiscountAmount ?? null,
    startsAt: promo?.startsAt?.slice(0, 10) || today,
    endsAt: promo?.endsAt?.slice(0, 10) || nextWeek,
    maxUses: promo?.maxUses ?? null,
    isActive: promo?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCat = (c) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  };

  const submit = async () => {
    if (form.name.trim().length < 2) { setErr('Nom kiriting'); return; }
    if (!form.discountValue) { setErr('Chegirma miqdorini kiriting'); return; }

    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscountAmount: Number(form.maxDiscountAmount) || 0,
        maxUses: Number(form.maxUses) || 0,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
      };
      if (isEdit) await panelApi.updatePromotion(promo._id, payload);
      else await panelApi.createPromotion(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Aksiyani tahrirlash' : 'Yangi aksiya'} onClose={onClose}>
      <Field label="Nomi *">
        <input value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="Hafta oxiri chegirmasi" className="inp" />
      </Field>

      <Field label="Chegirma turi">
        <div className="flex gap-2">
          {[['percent', 'Foiz (%)'], ['fixed', "So'm"]].map(([k, label]) => (
            <button key={k} onClick={() => set('discountType', k)}
              className={`flex-1 py-2.5 rounded-xl text-sm border ${
                form.discountType === k
                  ? 'border-brand-400 bg-brand-50 text-brand-600'
                  : 'border-line text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Miqdori *">
        {form.discountType === 'percent' ? (
          <NumberInput value={form.discountValue}
            onChange={(v) => set('discountValue', v)} suffix="%" placeholder="10" />
        ) : (
          <MoneyInput value={form.discountValue}
            onChange={(v) => set('discountValue', v)} placeholder="10 000" />
        )}
      </Field>

      {form.discountType === 'percent' && (
        <Field label="Eng ko'p chegirma" hint="Bo'sh = cheklovsiz">
          <MoneyInput value={form.maxDiscountAmount}
            onChange={(v) => set('maxDiscountAmount', v)} />
        </Field>
      )}

      <Field label="Nimaga qo'llaniladi">
        <select value={form.scope} onChange={(e) => set('scope', e.target.value)} className="inp">
          <option value="all">Barcha taomlar</option>
          <option value="category">Tanlangan kategoriya</option>
        </select>
      </Field>

      {form.scope === 'category' && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CATEGORIES.map(([v, label]) => (
            <button key={v} onClick={() => toggleCat(v)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                form.categories.includes(v)
                  ? 'border-brand-400 bg-brand-50 text-brand-600'
                  : 'border-line text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <Field label="Minimal buyurtma" hint="Bo'sh = cheklovsiz">
        <MoneyInput value={form.minOrderAmount} onChange={(v) => set('minOrderAmount', v)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Boshlanish">
          <input type="date" value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)} className="inp" />
        </Field>
        <Field label="Tugash">
          <input type="date" value={form.endsAt}
            onChange={(e) => set('endsAt', e.target.value)} className="inp" />
        </Field>
      </div>

      <Field label="Maksimal foydalanish" hint="Bo'sh = cheksiz">
        <NumberInput value={form.maxUses} onChange={(v) => set('maxUses', v)} suffix="marta" />
      </Field>

      <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Faol" />

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ REKLAMA ═══ */
function Ads({ overview }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getAds().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (a) => {
    if (!await confirm({ title: `"${a.name}" o'chirilsinmi?` })) return;
    try { await panelApi.deleteAd(a._id); load(); } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <>
      {overview && overview.reklama.korishlar > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Mini label="Ko'rishlar" value={overview.reklama.korishlar} raw />
          <Mini label="Bosishlar" value={overview.reklama.bosishlar} raw />
          <Mini label="Buyurtmalar" value={overview.reklama.buyurtmalar} raw />
          <Mini label="Tushum" value={overview.reklama.tushum} />
        </div>
      )}

      <button onClick={() => setEditing('new')}
        className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl mb-4">
        <i className="ti ti-plus" /> Reklama yaratish
      </button>

      {items.length === 0 ? (
        <Empty icon="ti-speakerphone" title="Reklama yo'q"
          text="Ilova ichida ko'rinib, ko'proq mijoz jalb qiling" />
      ) : (
        <div className="space-y-2.5">
          {items.map((a) => (
            <div key={a._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{a.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {a.placements?.map((p) =>
                      PLACEMENTS.find(([k]) => k === p)?.[1]).join(', ')}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${
                  a.running ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
                }`}>
                  {a.running ? 'Faol' : "To'xtagan"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center my-3">
                <Mini label="Ko'rish" value={a.stats.impressions} raw small />
                <Mini label="Bosish" value={a.stats.clicks} raw small />
                <Mini label="CTR" value={`${a.ctr}%`} text small />
                <Mini label="Sarflandi" value={a.stats.spent} small />
              </div>

              <div className="text-xs text-muted">
                Kunlik budjet: {som(a.dailyBudget)} so'm ·
                {' '}{fmtDate(a.startsAt)} — {fmtDate(a.endsAt)}
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(a)}
                  className="flex-1 border border-line text-muted py-2 rounded-lg text-sm">
                  Tahrirlash
                </button>
                <button onClick={() => remove(a)}
                  className="px-3 border border-line text-red-500 py-2 rounded-lg">
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AdForm ad={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}

function AdForm({ ad, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(ad);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: ad?.name || '',
    targetType: ad?.targetType || 'restaurant',
    dishId: ad?.dishId || null,
    placements: ad?.placements || ['home'],
    dailyBudget: ad?.dailyBudget ?? null,
    startsAt: ad?.startsAt?.slice(0, 10) || today,
    endsAt: ad?.endsAt?.slice(0, 10) || nextWeek,
    isActive: ad?.isActive ?? true,
  });
  const [dishes, setDishes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (form.targetType === 'dish' && dishes.length === 0) {
      panelApi.getDishes().then(setDishes).catch(() => {});
    }
  }, [form.targetType, dishes.length]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const togglePlace = (p) => {
    setForm((f) => ({
      ...f,
      placements: f.placements.includes(p)
        ? f.placements.filter((x) => x !== p)
        : [...f.placements, p],
    }));
  };

  const submit = async () => {
    if (form.name.trim().length < 2) { setErr('Nom kiriting'); return; }
    if (!form.dailyBudget || form.dailyBudget < 1000) {
      setErr('Kunlik budjet kamida 1 000 so\u2018m'); return;
    }
    if (form.placements.length === 0) { setErr('Joy tanlang'); return; }

    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        dailyBudget: Number(form.dailyBudget),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
      };
      if (isEdit) await panelApi.updateAd(ad._id, payload);
      else await panelApi.createAd(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Reklamani tahrirlash' : 'Yangi reklama'} onClose={onClose}>
      <Field label="Nomi *">
        <input value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="Yozgi kampaniya" className="inp" />
      </Field>

      <Field label="Nima reklama qilinadi">
        <div className="flex gap-2">
          {[['restaurant', 'Restoran'], ['dish', 'Taom']].map(([k, label]) => (
            <button key={k} onClick={() => set('targetType', k)}
              className={`flex-1 py-2.5 rounded-xl text-sm border ${
                form.targetType === k
                  ? 'border-brand-400 bg-brand-50 text-brand-600'
                  : 'border-line text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      {form.targetType === 'dish' && (
        <Field label="Taom">
          <select value={form.dishId || ''} onChange={(e) => set('dishId', e.target.value)}
            className="inp">
            <option value="">Tanlang</option>
            {dishes.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Qayerda ko'rsatiladi">
        <div className="flex flex-wrap gap-2">
          {PLACEMENTS.map(([k, label]) => (
            <button key={k} onClick={() => togglePlace(k)}
              className={`text-sm px-3 py-2 rounded-lg border ${
                form.placements.includes(k)
                  ? 'border-brand-400 bg-brand-50 text-brand-600'
                  : 'border-line text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Kunlik budjet *" hint="Kamida 1 000 so'm">
        <MoneyInput value={form.dailyBudget} onChange={(v) => set('dailyBudget', v)}
          placeholder="50 000" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Boshlanish">
          <input type="date" value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)} className="inp" />
        </Field>
        <Field label="Tugash">
          <input type="date" value={form.endsAt}
            onChange={(e) => set('endsAt', e.target.value)} className="inp" />
        </Field>
      </div>

      <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Faol" />

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ BONUSLAR ═══ */
function Bonuses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    panelApi.getBonuses().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (b) => {
    if (!await confirm({ title: 'Qoida o\'chirilsinmi?' })) return;
    try { await panelApi.deleteBonus(b._id); load(); } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-muted text-sm">Yuklanmoqda...</div>;

  return (
    <>
      <button onClick={() => setEditing('new')}
        className="bg-brand-400 text-brand-text font-medium px-4 py-2 rounded-xl mb-4">
        <i className="ti ti-plus" /> Bonus qoidasi
      </button>

      {items.length === 0 ? (
        <Empty icon="ti-gift" title="Bonus qoidasi yo'q"
          text="Mijozlar qayta buyurtma berishi uchun bonus bering" />
      ) : (
        <div className="space-y-2.5">
          {items.map((b) => (
            <div key={b._id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-medium text-ink">{b.name}</div>
                  <div className="text-sm text-green-600 font-semibold mt-0.5">
                    +{b.bonusType === 'percent' ? `${b.bonusValue}%` : `${som(b.bonusValue)} so'm`}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-none ${
                  b.isActive ? 'bg-green-50 text-green-700' : 'bg-canvas text-muted'
                }`}>
                  {b.isActive ? 'Faol' : "O'chiq"}
                </span>
              </div>

              <div className="text-xs text-muted">
                {b.minOrderAmount > 0 && `${som(b.minOrderAmount)} so'mdan boshlab · `}
                {b.stats?.orders || 0} marta berilgan
                {b.stats?.totalGiven > 0 && ` · jami ${som(b.stats.totalGiven)} so'm`}
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(b)}
                  className="flex-1 border border-line text-muted py-2 rounded-lg text-sm">
                  Tahrirlash
                </button>
                <button onClick={() => remove(b)}
                  className="px-3 border border-line text-red-500 py-2 rounded-lg">
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BonusForm rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}

function BonusForm({ rule, onClose, onSaved }) {
  useLockScroll();
  const isEdit = Boolean(rule);

  const [form, setForm] = useState({
    name: rule?.name || 'Bonus',
    bonusType: rule?.bonusType || 'fixed',
    bonusValue: rule?.bonusValue ?? null,
    minOrderAmount: rule?.minOrderAmount ?? null,
    maxBonusAmount: rule?.maxBonusAmount ?? null,
    isActive: rule?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.bonusValue) { setErr('Bonus miqdorini kiriting'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        bonusValue: Number(form.bonusValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxBonusAmount: Number(form.maxBonusAmount) || 0,
      };
      if (isEdit) await panelApi.updateBonus(rule._id, payload);
      else await panelApi.createBonus(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Bonusni tahrirlash' : 'Yangi bonus qoidasi'} onClose={onClose}>
      <Field label="Nomi">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="inp" />
      </Field>

      <Field label="Bonus turi">
        <div className="flex gap-2">
          {[['fixed', "Qat'iy summa"], ['percent', 'Foiz (%)']].map(([k, label]) => (
            <button key={k} onClick={() => set('bonusType', k)}
              className={`flex-1 py-2.5 rounded-xl text-sm border ${
                form.bonusType === k
                  ? 'border-brand-400 bg-brand-50 text-brand-600'
                  : 'border-line text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Bonus miqdori *">
        {form.bonusType === 'percent' ? (
          <NumberInput value={form.bonusValue} onChange={(v) => set('bonusValue', v)}
            suffix="%" placeholder="5" />
        ) : (
          <MoneyInput value={form.bonusValue} onChange={(v) => set('bonusValue', v)}
            placeholder="5 000" />
        )}
      </Field>

      <Field label="Minimal buyurtma" hint="Shu summadan boshlab beriladi">
        <MoneyInput value={form.minOrderAmount} onChange={(v) => set('minOrderAmount', v)}
          placeholder="100 000" />
      </Field>

      {form.bonusType === 'percent' && (
        <Field label="Eng ko'p bonus" hint="Bo'sh = cheklovsiz">
          <MoneyInput value={form.maxBonusAmount} onChange={(v) => set('maxBonusAmount', v)} />
        </Field>
      )}

      <div className="text-xs text-muted bg-canvas rounded-lg p-3 mb-3 leading-relaxed">
        Bonus buyurtma <b className="text-ink">yetkazilgandan keyin</b> mijoz
        balansiga tushadi va keyingi buyurtmada ishlatiladi.
      </div>

      <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Faol" />

      {err && <ErrBox text={err} />}
      <Actions onClose={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  );
}

/* ═══ Umumiy ═══ */
function Stat({ label, value, accent }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-brand-600' : 'text-ink'}`}>
        {som(value)}
      </div>
      <div className="text-[10px] text-muted">so'm</div>
    </div>
  );
}

function Mini({ label, value, raw, text, small }) {
  return (
    <div className={`bg-canvas rounded-lg ${small ? 'py-1.5' : 'py-2'}`}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`font-semibold text-ink ${small ? 'text-xs' : 'text-sm'}`}>
        {text ? value : raw ? value : som(value)}
      </div>
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className="text-center py-12">
      <i className={`ti ${icon} text-4xl text-muted mb-3 block`} />
      <div className="text-ink font-medium">{title}</div>
      <p className="text-sm text-muted mt-1 max-w-xs mx-auto">{text}</p>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto max-h-[88dvh] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <input type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-brand-400" />
    </label>
  );
}

function ErrBox({ text }) {
  return (
    <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{text}</div>
  );
}

function Actions({ onClose, onSubmit, saving }) {
  return (
    <div className="flex gap-2 mt-4 sticky bottom-0 bg-white pt-3 border-t border-line">
      <button onClick={onClose} className="flex-1 border border-line text-muted py-2.5 rounded-xl">
        Bekor
      </button>
      <button onClick={onSubmit} disabled={saving}
        className="flex-[1.5] bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}
