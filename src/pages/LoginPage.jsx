import { useState } from "react";
import { Eye, EyeOff, Store } from "lucide-react";
import { useAuth } from "@/store/auth";

// Login sahifasi — admin (lakmago.uz/eka) va restoran (lakmago.uz) uchun umumiy.
export function LoginPage({ isAdminRoute = false }) {
  const login = useAuth((s) => s.login);
  const error = useAuth((s) => s.error);

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

const submit = async (e) => {
  e.preventDefault();

  if (!loginValue.trim() || !password) return;

  setLoading(true);

  try {
    await login(loginValue.trim(), password);
  } catch {
    // Error store orqali chiqadi
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-white flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-orange-200">
            <Store className="w-9 h-9 text-white" />
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
            LokmaGo
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {isAdminRoute
              ? "Administrator boshqaruv paneli"
              : "Restoran boshqaruv paneli"}
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={submit}
          className="rounded-3xl border border-gray-100 bg-white p-7 shadow-2xl shadow-orange-100"
        >
          {/* Login */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Login
            </label>

            <input
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder={
                isAdminRoute ? "Administrator login" : "Restoran logini"
              }
              className="
                h-14
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                text-gray-900
                placeholder:text-gray-400
                outline-none
                transition-all
                focus:border-orange-500
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Parol
            </label>

            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="
                  h-14
                  w-full
                  rounded-2xl
                  border
                  border-gray-200
                  bg-gray-50
                  px-4
                  pr-14
                  text-gray-900
                  placeholder:text-gray-400
                  outline-none
                  transition-all
                  focus:border-orange-500
                  focus:bg-white
                  focus:ring-4
                  focus:ring-orange-100
                "
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-orange-500"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading || !loginValue.trim() || !password}
            className="
              mt-6
              h-14
              w-full
              rounded-2xl
              bg-gradient-to-r
              from-orange-500
              to-amber-500
              text-base
              font-semibold
              text-white
              shadow-lg
              shadow-orange-200
              transition-all
              hover:-translate-y-0.5
              hover:shadow-xl
              active:scale-[0.98]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-7 text-center">
          <p className="text-sm font-medium text-gray-700">
            LokmaGo Restaurant Platform
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Delivery • Dine-in • POS • CRM
          </p>

          <p className="mt-5 text-xs text-gray-400">
            © {new Date().getFullYear()} LokmaGo. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </div>
    </div>
  );
}