import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle2, Bell, Upload, Trash2, Monitor, Globe, Building2, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Input, Avatar, Badge, Select, Switch } from '../../components/ui';
import { uploadFile } from '../../lib/storage';
import { formatDateTime } from '../../lib/utils';

interface PlatformSettings {
  site_name: string;
  logo_url: string;
  currency: string;
  timezone: string;
  default_city: string;
}

export function AdminSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [platform, setPlatform] = useState<PlatformSettings>({
    site_name: 'RealtyNow',
    logo_url: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    default_city: '',
  });
  const [notifications, setNotifications] = useState({
    email_enquiries: true,
    email_properties: true,
    email_newsletter: false,
    sms_enquiries: false,
    push_all: true,
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; last_active: string; user_agent: string }[]>([]);

  useQuery({
    queryKey: ['admin-platform-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('platform_settings').select('*').maybeSingle();
      if (data) setPlatform(data as unknown as PlatformSettings);
      return data;
    },
  });

  useQuery({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_active', { ascending: false });
      setSessions(data ?? []);
      return data;
    },
  });

  const saveProfile = async () => {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ ...form, avatar_url: avatarUrl })
      .eq('id', user!.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const savePlatform = async () => {
    await supabase.from('platform_settings').upsert(platform);
    queryClient.invalidateQueries({ queryKey: ['admin-platform-settings'] });
    alert('Platform settings saved');
  };

  const saveNotifications = async () => {
    await supabase.from('profiles').update({ notification_preferences: notifications }).eq('id', user!.id);
    queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    alert('Notification preferences saved');
  };


  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    const { url, error } = await uploadFile('profile-images', file);
    if (!error && url) {
      setAvatarUrl(url);
      if (user?.id) {
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        await refreshProfile();
      }
    }
    setUploadingAvatar(false);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl('');
    if (user?.id) {
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      await refreshProfile();
    }
  };

  const revokeSession = async (sessionId: string) => {
    await supabase.from('user_sessions').delete().eq('id', sessionId);
    queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
  };

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:settings', 'Settings')} badge="Admin">
      <PageHeader title="Admin settings" subtitle="Manage your account, security, and platform settings." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <Avatar src={avatarUrl || null} name={`${profile?.first_name ?? 'A'} ${profile?.last_name ?? ''}`} size={84} />
              {uploadingAvatar && (
                <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white text-[11px] font-bold">
                  Uploading…
                </div>
              )}
            </div>
            <p className="mt-1 font-display font-semibold text-navy-900">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-sm text-navy-500">{profile?.email}</p>
            <Badge variant="error" className="mt-2">
              Administrator
            </Badge>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-navy-50 px-3.5 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-100 transition-colors shadow-2xs">
                <Upload className="h-3.5 w-3.5" /> Change avatar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarUpload(f);
                  }}
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  title="Remove avatar"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
          <div className="mt-6 space-y-3 border-t border-navy-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-navy-600">
              <ShieldCheck className="h-4 w-4 text-success-500" /> Full platform access
            </div>
            <div className="flex items-center gap-2 text-sm text-navy-600">
              <Bell className="h-4 w-4 text-navy-700" /> All system notifications
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2 space-y-8">
          <section>
            <h3 className="font-display font-semibold text-navy-900">Profile</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
              <Input
                label="Last name"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={saveProfile} loading={saving}>
                Save changes
              </Button>
              {saved && (
                <span className="text-sm text-success-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Saved!
                </span>
              )}
            </div>
          </section>

          <section className="border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Two-factor authentication
            </h3>
            <p className="mt-1 text-sm text-navy-500">Add an extra layer of security to your account.</p>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-navy-200 p-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-navy-600" />
                <div>
                  <p className="text-sm font-medium text-navy-900">TOTP Authenticator</p>
                  <p className="text-xs text-navy-500">{twoFactorEnabled ? 'Enabled' : 'Not enabled'}</p>
                </div>
              </div>
              <Switch checked={twoFactorEnabled} onChange={setTwoFactorEnabled} />
            </div>
            {twoFactorEnabled && (
              <Card className="mt-4 p-4">
                <p className="text-sm text-navy-600">
                  Scan this QR code with your authenticator app. (Demo placeholder)
                </p>
                <div className="mt-2 flex h-32 w-32 items-center justify-center rounded-lg bg-navy-100 text-navy-400">
                  QR Code
                </div>
                <Input label="Verification code" placeholder="000000" className="mt-3 max-w-xs" />
                <Button className="mt-2" variant="secondary">
                  Verify & Enable
                </Button>
              </Card>
            )}
          </section>

          <section className="border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notification preferences
            </h3>
            <div className="mt-4 space-y-3">
              {Object.entries({
                email_enquiries: 'Email on new enquiries',
                email_properties: 'Email on property updates',
                email_newsletter: 'Newsletter emails',
                sms_enquiries: 'SMS on new enquiries',
                push_all: 'All push notifications',
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-navy-200 p-3">
                  <p className="text-sm text-navy-700">{label}</p>
                  <Switch
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={(v) => setNotifications((n) => ({ ...n, [key]: v }))}
                  />
                </div>
              ))}
              <Button variant="secondary" onClick={saveNotifications}>
                Save preferences
              </Button>
            </div>
          </section>

          <section className="border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Active sessions
            </h3>
            <div className="mt-4 divide-y divide-navy-50">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{s.user_agent ?? 'Unknown device'}</p>
                    <p className="text-xs text-navy-500">Last active: {formatDateTime(s.last_active)}</p>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => revokeSession(s.id)}>
                    Revoke
                  </Button>
                </div>
              ))}
              {sessions.length === 0 && <p className="py-4 text-sm text-navy-400">No active sessions found.</p>}
            </div>
          </section>

          <section className="border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <Globe className="h-5 w-5" /> Platform settings
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Site name"
                value={platform.site_name}
                onChange={(e) => setPlatform((p) => ({ ...p, site_name: e.target.value }))}
              />
              <Input
                label="Logo URL"
                value={platform.logo_url}
                onChange={(e) => setPlatform((p) => ({ ...p, logo_url: e.target.value }))}
              />
              <Select
                label="Currency"
                value={platform.currency}
                onChange={(e) => setPlatform((p) => ({ ...p, currency: e.target.value }))}
              >
                {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                label="Timezone"
                value={platform.timezone}
                onChange={(e) => setPlatform((p) => ({ ...p, timezone: e.target.value }))}
              >
                {['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                label="Default city"
                value={platform.default_city}
                onChange={(e) => setPlatform((p) => ({ ...p, default_city: e.target.value }))}
              />
            </div>
            <Button className="mt-4" onClick={savePlatform}>
              Save platform settings
            </Button>
          </section>

          <section className="border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Role & permissions
            </h3>
            <p className="mt-1 text-sm text-navy-500">Manage access levels for admin, agents, and customers.</p>
            <div className="mt-4 space-y-3">
              {[
                { role: 'admin', label: 'Administrator', perms: 'Full access' },
                { role: 'agent', label: 'Agent', perms: 'Properties, leads, appointments' },
                { role: 'customer', label: 'Customer', perms: 'Browse, enquire, list properties' },
              ].map((r) => (
                <div key={r.role} className="flex items-center justify-between rounded-lg border border-navy-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{r.label}</p>
                    <p className="text-xs text-navy-500">{r.perms}</p>
                  </div>
                  <Badge variant={r.role === 'admin' ? 'error' : r.role === 'agent' ? 'warning' : 'default'}>
                    {r.role}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </Card>
      </div>
    </DashboardLayout>
  );
}
