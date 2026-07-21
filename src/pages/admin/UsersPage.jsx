import { useState, useEffect } from 'react';
import { adminApi } from '@/api';

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 p-4 sm:p-6 min-w-0">
      <h1 className="text-xl font-semibold text-ink mb-1">Mijozlar</h1>
      <p className="text-sm text-muted mb-5">Ro'yxatdan o'tgan foydalanuvchilar</p>

      {loading ? (
        <div className="text-muted text-sm py-10 text-center">Yuklanmoqda...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-muted text-sm py-12 border border-dashed border-line rounded-xl">
          Hozircha mijoz yo'q.
        </div>
      ) : (
        <div className="grid gap-2">
          {users.map((u) => (
            <div key={u._id} className="bg-surface border border-line rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-medium flex-none">
                {(u.firstName || 'M').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink truncate">{u.firstName} {u.lastName || ''}</div>
                <div className="text-xs text-muted">
                  {u.username ? `@${u.username}` : u.phone || 'Telegram mijoz'}
                </div>
              </div>
              <div className="text-xs text-muted flex-none">
                {new Date(u.createdAt).toLocaleDateString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
