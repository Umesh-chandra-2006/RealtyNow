import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, User, Phone, Save, CheckCircle2, Upload, Calendar, Clock, Bell, AlertTriangle, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { uploadFile } from '../../lib/storage';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPortalSections } from './sections';
import { Card, EmptyState, Skeleton, Badge, Button, Input, Avatar } from '../../components/ui';
import { formatDate , generatePropertyUrl} from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { enablePushNotifications, isPushRegistered } from '../../lib/push';
import { useToast } from '../../components/toast';

export function PortalEnquiries() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const realtimeTick = useRealtimeCount('enquiries', { column: 'customer_id', value: user?.id ?? '' });

  const { data, isLoading } = useQuery({
    queryKey: ['portal-enquiries', user?.id, realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('enquiries')
        .select('*, property:properties(title, id), agent:profiles!agent_id(first_name, last_name, email, phone)')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false });
      return (data ?? []).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
        agent: Array.isArray(e.agent) ? e.agent[0] : e.agent,
      }));
    },
    enabled: !!user,
  });

  const { data: appointments } = useQuery({
    queryKey: ['portal-appointments', user?.id, realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, property:properties(title, id), agent:profiles!agent_id(first_name, last_name)')
        .eq('customer_id', user!.id)
        .order('scheduled_at', { ascending: false });
      return (data ?? []).map((a) => ({
        ...a,
        property: Array.isArray(a.property) ? a.property[0] : a.property,
        agent: Array.isArray(a.agent) ? a.agent[0] : a.agent,
      }));
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout sections={getPortalSections(t)} title={t('portal.myEnquiries', 'My Enquiries')}>
      <PageHeader
        title={t('portal.myEnquiries', 'My enquiries & appointments')}
        subtitle={t('portal.trackEnquiries', 'Track your property enquiries and scheduled visits.')}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">
            {t('portal.enquiriesHeader', 'Enquiries')}
          </h3>
          <Card className="divide-y divide-navy-50">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : data && data.length > 0 ? (
              data.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Link to={generatePropertyUrl(e.property as any)} className="font-semibold text-navy-900 hover:underline">
                        {e.property?.title ?? t('portal.propEnquiry', 'Property enquiry')}
                      </Link>
                      <p className="mt-1 text-sm text-navy-600">{e.message}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-navy-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(e.created_at)}
                        </span>
                        {e.agent && (
                          <span>
                            {t('portal.agent', 'Agent')}: {e.agent.first_name} {e.agent.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={e.status === 'new' ? 'info' : e.status === 'contacted' ? 'success' : 'default'}>
                      {e.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title={t('portal.noEnquiries', 'No enquiries yet')}
                description={t('portal.noEnquiriesDesc', "When you contact an agent on a listing, it'll show here.")}
                action={
                  <Link to="/search">
                    <Button variant="secondary">{t('search.browseAll', 'Browse properties')}</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">
            {t('portal.appointmentsHeader', 'Appointments')}
          </h3>
          <Card className="divide-y divide-navy-50">
            {!appointments ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : appointments.length > 0 ? (
              appointments.map((a) => (
                <div key={a.id} className="p-4">
                  <p className="font-semibold text-navy-900">
                    {a.property?.title ?? t('portal.appointment', 'Appointment')}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-600">
                    <Calendar className="h-3.5 w-3.5" /> {new Date(a.scheduled_at).toLocaleString('en-IN')}
                  </p>
                  {a.agent && (
                    <p className="mt-1 text-xs text-navy-500">
                      {t('portal.with', 'with')} {a.agent.first_name} {a.agent.last_name}
                    </p>
                  )}
                  {a.notes && <p className="mt-1 text-sm text-navy-600">{a.notes}</p>}
                  <div className="mt-2">
                    <Badge
                      variant={
                        a.status === 'confirmed'
                          ? 'success'
                          : a.status === 'cancelled'
                            ? 'error'
                            : a.status === 'completed'
                              ? 'default'
                              : 'warning'
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title={t('portal.noAppts', 'No appointments')}
                description={t('portal.noApptsDesc', 'Book a visit from any property detail page.')}
              />
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export { PortalHelp } from './portal-help';

export function PortalSettings() {
  const { t } = useLanguageContext();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
    bio: profile?.bio ?? '',
    avatar_url: profile?.avatar_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    isPushRegistered(user.id).then(setPushEnabled);
  }, [user]);

  const requestPushPermission = async () => {
    if (!user) return;
    setPushLoading(true);
    const result = await enablePushNotifications(user.id);
    setPushLoading(false);

    if (!result.success) {
      toast.addToast('error', result.error ?? 'Could not enable notifications');
      return;
    }
    setPushEnabled(!result.degraded);
    if (result.degraded) {
      toast.addToast('info', 'Notifications enabled for this tab. Background push is not configured yet.');
    } else {
      toast.addToast('success', 'Push notifications enabled');
    }
  };

  const requestAccountDeletion = async () => {
    if (!user) return;
    const first = window.confirm(
      'Delete your RealtyNow account and personal data? This action is permanent and cannot be undone.',
    );
    if (!first) return;
    const second = window.confirm(
      'Are you absolutely sure? All your profile data, enquiries, listings and notifications will be erased. This cannot be reversed.',
    );
    if (!second) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('fn_request_account_erasure');
      if (error) {
        toast.addToast('error', error.message);
        return;
      }
      const mode = (data as { mode?: string } | null)?.mode;
      toast.addToast(
        'success',
        mode === 'anonymized'
          ? 'Account deactivated and personal data erased. Financial records are retained for statutory compliance.'
          : 'Your account and personal data have been permanently deleted.',
      );
      await signOut();
      queryClient.clear();
      navigate('/');
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        bio: form.bio,
        avatar_url: form.avatar_url || null,
      })
      .eq('id', user!.id);
    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: ['portal-stats'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    const { url, error } = await uploadFile('profile-images', file);
    if (!error && url) {
      setForm((f) => ({ ...f, avatar_url: url }));
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user!.id);
      await refreshProfile();
    }
    setUploading(false);
  };

  return (
    <DashboardLayout sections={getPortalSections(t)} title={t('common.editProfile', 'Settings')}>
      <PageHeader
        title={t('portal.profileSettings', 'Profile settings')}
        subtitle={t('portal.updatePersonalInfo', 'Update your personal information and security.')}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar
                name={`${form.first_name} ${form.last_name}`.trim() || 'U'}
                src={form.avatar_url || null}
                size={80}
              />
              <label className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-navy-700 text-white shadow-md hover:bg-navy-800">
                <Upload className="h-3.5 w-3.5" />
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
            </div>
            {uploading && <p className="mt-2 text-xs text-navy-500">{t('common.loading', 'Uploading…')}</p>}
            <p className="mt-3 font-semibold text-navy-900">
              {form.first_name} {form.last_name}
            </p>
            <p className="text-sm text-navy-500">{profile?.email}</p>
            <Badge variant="info" className="mt-2 capitalize">
              {profile?.role}
            </Badge>
          </div>
          <div className="mt-6 space-y-3 border-t border-navy-100 pt-4 text-sm">
            <div className="flex items-center gap-2 text-navy-600">
              <User className="h-4 w-4 text-navy-400" /> {profile?.email}
            </div>
            <div className="flex items-center gap-2 text-navy-600">
              <Phone className="h-4 w-4 text-navy-400" /> {profile?.phone ?? t('portal.noPhone', 'No phone')}
            </div>
            <p className="text-xs text-navy-400">
              {t('portal.memberSince', 'Member since')} {formatDate(profile?.created_at)}
            </p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold text-navy-900">
            {t('portal.personalInfo', 'Personal information')}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label={t('auth.firstName', 'First name')}
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <Input
              label={t('auth.lastName', 'Last name')}
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <Input
              label={t('auth.phone', 'Phone')}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <label className="label">{t('portal.bio', 'Bio')}</label>
              <textarea
                className="input min-h-[80px]"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder={t('portal.tellUsAbout', 'Tell us about yourself')}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>
              {t('forms.saveChanges', 'Save changes')}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success-600">
                <CheckCircle2 className="h-4 w-4" /> {t('forms.saved', 'Saved!')}
              </span>
            )}
          </div>

          <div className="mt-8 border-t border-navy-100 pt-6">
            <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">
              <Bell className="h-5 w-5" /> {t('portal.notificationPrefs', 'Notification Preferences')}
            </h3>
            <p className="mt-1 text-sm text-navy-500">
              {t(
                'portal.notificationDesc',
                'Receive desktop/mobile alerts when your properties get new enquiries or appointments.',
              )}
            </p>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-navy-200 p-4">
              <div>
                <p className="text-sm font-medium text-navy-900">
                  {t('portal.browserPush', 'Browser Push Notifications')}
                </p>
                <p className="text-xs text-navy-500">
                  {pushEnabled ? t('portal.enabled', 'Enabled') : t('portal.notEnabled', 'Not enabled')}
                </p>
              </div>
              {!pushEnabled ? (
                <Button size="sm" onClick={requestPushPermission} loading={pushLoading}>
                  {t('portal.enable', 'Enable')}
                </Button>
              ) : (
                <Badge variant="success">{t('portal.active', 'Active')}</Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 rounded-2xl border border-error-200 bg-error-50/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display font-semibold text-error-700">
              <AlertTriangle className="h-5 w-5" /> {t('portal.dangerZone', 'Danger zone')}
            </h3>
            <p className="mt-1 max-w-xl text-sm text-navy-600">
              {t(
                'portal.deleteAccountDesc',
                'Permanently delete your account and personal data. This includes your profile, enquiries, listings and notifications, and cannot be undone. Financial/tax records may be retained solely for statutory compliance.',
              )}
            </p>
          </div>
          <Button variant="danger" onClick={requestAccountDeletion} loading={deleting} icon={<LogOut className="h-4 w-4" />}>
            {t('portal.deleteAccount', 'Delete my account')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
