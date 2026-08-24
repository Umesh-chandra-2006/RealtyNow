import { useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Switch } from '../../components/ui';
import { useToast } from '../../components/toast';

export function PartnerSettings() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { profile, refreshProfile, signOut } = useAuth();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const toggleTwoFactor = async (value: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ two_factor_enabled: value }).eq('id', profile!.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      addToast('success', value ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to update setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout sections={sections} title={t('common:settings', 'Settings')}>
      <PageHeader title="Settings" subtitle="Manage your account preferences" />

      <Card className="p-6 mb-4">
        <h3 className="font-display text-sm font-bold text-navy-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-navy-400" /> Security
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-navy-900">Two-Factor Authentication</p>
            <p className="text-xs text-navy-500 mt-0.5">Add an extra layer of security to your account.</p>
          </div>
          <Switch checked={!!profile?.two_factor_enabled} onChange={toggleTwoFactor} disabled={saving} />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-sm font-bold text-navy-900 mb-4">Account</h3>
        <Button variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={() => signOut()}>Sign Out</Button>
      </Card>
    </DashboardLayout>
  );
}
