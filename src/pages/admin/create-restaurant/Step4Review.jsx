import { useCreateForm } from './context';
import { CATEGORIES, KINDS } from '../restaurantMeta';
import { Review } from './fields';

export function Step4Review() {
  const { form } = useCreateForm();
  const cat = CATEGORIES.find((c) => c.value === form.category);
  const kind = KINDS.find((k) => k.value === form.kind);
  const som = (n) => (n ?? 0).toLocaleString('ru-RU');

  return (
    <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
        <i className="ti ti-checks text-brand-600" /> Tekshiruv
      </h2>
      <p className="text-xs text-muted mb-4">
        Ma'lumotlarni tekshiring. O'zgartirish uchun yuqoridagi bosqichga qayting.
      </p>

      {form.imageUrl && (
        <img src={form.imageUrl} alt="" className="w-full h-36 object-cover rounded-xl mb-4" />
      )}

      <Review label="Nomi" value={form.name} />
      <Review label="Turi" value={kind?.label} />
      <Review label="Kategoriya" value={cat?.label} />
      <Review label="Tavsif" value={form.cuisine} />

      <Review label="Telefon" value={form.phone} />
      <Review label="Manzil" value={form.address} />
      {form.landmark && <Review label="Mo'ljal" value={form.landmark} />}
      <Review
        label="Koordinata"
        value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'Kiritilmagan'}
        warn={!form.lat || !form.lng}
      />
      <Review
        label="Yetkazish"
        value={`${form.deliveryMin}–${form.deliveryMax} daq · ${
          form.deliveryFee > 0 ? som(form.deliveryFee) + " so'm" : 'bepul'
        }`}
      />

      {form.kind === 'shop' && form.shopTypes.length > 0 && (
        <Review label="Do'kon yo'nalishi" value={`${form.shopTypes.length} ta tanlangan`} />
      )}
      <Review
        label="Olib ketish"
        value={form.pickupEnabled ? `Ha · ${form.prepMinutes} daq` : "Yo'q"}
      />
      <Review
        label="Stol bron"
        value={form.reservationEnabled ? 'Yoqilgan' : "O'chirilgan"}
      />

      <Review label="Login" value={form.login} />
      <Review label="Parol" value={'•'.repeat(form.password.length)} />
    </section>
  );
}
