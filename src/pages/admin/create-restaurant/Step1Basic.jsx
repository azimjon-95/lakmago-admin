import { useCreateForm } from './context';
import { ImageUpload } from '@/components/ImageUpload';
import { CATEGORIES, KINDS } from '../restaurantMeta';
import { Field } from './fields';

export function Step1Basic() {
  const { form, set, setErr } = useCreateForm();

  return (
    <>
        {/* Asosiy ma'lumot */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <i className="ti ti-info-circle text-brand-600" /> Asosiy ma'lumot
          </h2>
          <div className="grid gap-4">
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => set('imageUrl', url)}
              folder="banners"
              label="Muassasa rasmi (banner)"
              aspect="16/9"
            />
            <Field label="Muassasa nomi *" value={form.name} onChange={(v) => set('name', v)} placeholder="Masalan: Milliy Taomlar" />
            <Field label="Oshxona / yo'nalish tavsifi *" value={form.cuisine} onChange={(v) => set('cuisine', v)} placeholder="Masalan: Milliy oshxona, osh va shashlik" />
          </div>
        </section>

        {/* Kategoriya */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-tag text-brand-600" /> Kategoriya
          </h2>
          <p className="text-xs text-muted mb-4">Muassasa qaysi yo'nalishда — mijozlar shu bo'yicha filtrlaydi</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => set('category', c.value)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs text-center transition-colors ${
                  form.category === c.value
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-line text-muted hover:bg-canvas'
                }`}
              >
                <i className={`ti ${c.icon} text-xl`} />
                <span className="leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Muassasa turi */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <i className="ti ti-building text-brand-600" /> Muassasa turi
          </h2>
          <p className="text-xs text-muted mb-4">Ish tartibi va xarakteri</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => set('kind', k.value)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  form.kind === k.value ? 'border-brand-400 bg-brand-50' : 'border-line hover:bg-canvas'
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className={`ti ${k.icon} text-lg ${form.kind === k.value ? 'text-brand-600' : 'text-muted'}`} />
                  <span className={`text-sm font-medium ${form.kind === k.value ? 'text-brand-600' : 'text-ink'}`}>{k.label}</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-tight">{k.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Do'kon yo'nalishlari — faqat magazin tanlansa */}
    </>
  );
}

