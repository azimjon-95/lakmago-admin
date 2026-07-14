import { useState } from 'react';
import { useAuth } from '@/store/auth';

// Login sahifasi — admin (lakmago.uz/eka) va restoran (lakmago.uz) uchun umumiy.
// isAdminRoute — /eka sahifasida ochilganini bildiradi (faqat ko'rinish uchun).
export function LoginPage({ isAdminRoute = false }) {
  const login = useAuth((s) => s.login);
  const error = useAuth((s) => s.error);
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginValue.trim(), password);
    } catch {
      // xato store'da ko'rsatiladi
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-brand-400 flex items-center justify-center mb-3 shadow-lg shadow-brand-400/25">
            <i className="ti ti-tools-kitchen-2 text-brand-text text-2xl" />
          </div>
          <h1 className="text-xl font-semibold text-ink">LokmaGo</h1>
          <p className="text-sm text-muted mt-1">
            {isAdminRoute ? 'Administrator paneli' : 'Restoran paneli'}
          </p>
        </div>

        <form onSubmit={submit} className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-ink mb-1.5">Login</label>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder={isAdminRoute ? 'admin' : 'restoran logini'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors mb-4"
          />

          <label className="block text-sm font-medium text-ink mb-1.5">Parol</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink outline-none focus:border-brand-400 transition-colors"
          />

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !loginValue || !password}
            className="w-full mt-5 bg-brand-400 text-brand-text font-medium py-2.5 rounded-xl hover:bg-brand-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-5">
          © {new Date().getFullYear()} LokmaGo — barcha huquqlar himoyalangan
        </p>
      </div>
    </div>
  );
}
