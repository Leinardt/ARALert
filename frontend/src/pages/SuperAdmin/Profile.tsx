import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState<User | null>(user);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalUser(user);
    setAvatarPreview(user?.avatar ?? null);
  }, [user]);

  if (!localUser) {
    return (
      <div className="min-h-screen p-8 bg-slate-50">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
          <p className="mt-4 text-slate-600">Loading profile information...</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append('username', localUser.username);
    if (password) {
      formData.append('password', password);
      formData.append('confirm_password', confirmPassword);
    }
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    try {
      const updated = await updateProfile(formData);
      setLocalUser(updated);
      setMessage('Profile updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : 'Unable to save profile.';
      setError(messageText);
      console.error('Profile update failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow border border-slate-200 p-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
            <p className="mt-2 text-sm text-slate-500">Update your account details and avatar.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-indigo-100">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-indigo-700">{localUser.first_name?.[0]?.toUpperCase() ?? localUser.username[0].toUpperCase()}</span>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Role</p>
              <p className="text-sm font-semibold text-slate-900">{localUser.is_superuser ? 'SuperAdmin' : localUser.role?.toUpperCase() ?? 'USER'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6">
          {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
          {message && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              First Name
              <input
                value={localUser.first_name}
                readOnly
                disabled
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 cursor-not-allowed"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Last Name
              <input
                value={localUser.last_name}
                readOnly
                disabled
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 cursor-not-allowed"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={localUser.email}
                readOnly
                disabled
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 cursor-not-allowed"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Username
              <input
                value={localUser.username}
                onChange={(event) => setLocalUser({ ...localUser, username: event.target.value })}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              New Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                placeholder="Leave blank to keep current password"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                placeholder="Repeat new password"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 text-sm font-medium text-slate-700">
              <span>Avatar</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none"
              />
            </div>
            <div className="space-y-2 text-sm font-medium text-slate-700">
              <span>Account created</span>
              <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {new Date(localUser.date_joined).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
