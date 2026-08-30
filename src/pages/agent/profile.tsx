import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  UserCircle,
  ShieldCheck,
  Award,
  Save,
  Upload,
  ExternalLink,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Input, Button, Textarea, Badge, Avatar } from '../../components/ui';
import { useToast } from '../../components/toast';
import { uploadProfilePhoto } from '../../lib/profile-photo';

const SPECIALIZATION_OPTIONS = [
  'Residential Apartments',
  'Luxury Villas',
  'Commercial Offices',
  'Retail Shops',
  'Open Plots & Land',
  'Gated Communities',
  'Rental & Leasing',
  'Farm Houses',
];

export function AgentProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp_number: '',
    company: '',
    license_number: '',
    specialization: '',
    assigned_areas: [] as string[],
    bio: '',
  });

  const [newAreaInput, setNewAreaInput] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        whatsapp_number: (profile as any).whatsapp_number || profile.phone || '',
        company: profile.company || '',
        license_number: profile.license_number || '',
        specialization: profile.specialization || 'Residential Apartments',
        assigned_areas: profile.assigned_areas || ['Gachibowli', 'Kondapur', 'Hitec City'],
        bio: profile.bio || '',
      });
      setPhotoPreview(profile.avatar_url);
    }
  }, [profile]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // Upload immediately
    setUploadingPhoto(true);
    try {
      const res = await uploadProfilePhoto(file, 'agent');
      if (res.error) throw new Error(res.error);
      if (res.url) {
        await supabase.from('profiles').update({ avatar_url: res.url }).eq('id', user!.id);
        await refreshProfile();
        addToast('success', 'Profile photo updated successfully!');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddArea = () => {
    const trimmed = newAreaInput.trim();
    if (!trimmed) return;
    if (form.assigned_areas.includes(trimmed)) {
      addToast('info', 'Area already added.');
      return;
    }
    setForm((f) => ({ ...f, assigned_areas: [...f.assigned_areas, trimmed] }));
    setNewAreaInput('');
  };

  const handleRemoveArea = (area: string) => {
    setForm((f) => ({ ...f, assigned_areas: f.assigned_areas.filter((a) => a !== area) }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim(),
          whatsapp_number: form.whatsapp_number.trim(),
          company: form.company.trim(),
          license_number: form.license_number.trim(),
          specialization: form.specialization,
          assigned_areas: form.assigned_areas,
          bio: form.bio.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      addToast('success', 'Agent profile updated successfully!');
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout sections={agentSections} title="Public Profile" badge="Agent">
      <PageHeader
        title="Agent Public Profile & Credentials"
        subtitle="Manage your public-facing real estate advisor profile, verified credentials, service areas, and contact options."
        action={
          user && (
            <Link to={`/agents/${user.id}`} target="_blank">
              <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                View Public Profile
              </Button>
            </Link>
          )
        }
      />

      <form onSubmit={handleSaveProfile} className="grid gap-6 lg:grid-cols-3 mt-6">
        {/* Left Column: Photo & Trust Badges */}
        <div className="space-y-6">
          <Card className="p-6 text-center border-navy-100">
            <div className="relative mx-auto w-28 h-28 mb-4">
              <Avatar src={photoPreview} name={`${form.first_name} ${form.last_name}`} size={112} />
              <label
                htmlFor="agent-photo-upload"
                className="absolute bottom-0 right-0 p-2 bg-gold-500 hover:bg-gold-600 text-navy-950 rounded-full cursor-pointer shadow-md transition"
                title="Change Photo"
              >
                <Upload className="h-4 w-4" />
                <input
                  id="agent-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
            {uploadingPhoto && <p className="text-xs text-gold-600 animate-pulse mb-2">Uploading photo...</p>}

            <h3 className="font-display font-bold text-navy-900 text-lg">
              {form.first_name || 'Your'} {form.last_name || 'Name'}
            </h3>
            <p className="text-xs text-navy-500">{form.company || 'Independent RealtyNow Advisor'}</p>

            <div className="mt-4 pt-4 border-t border-navy-100 flex flex-wrap gap-2 justify-center">
              {profile?.rera_verified ? (
                <Badge variant="success" className="flex items-center gap-1 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" /> RERA Verified
                </Badge>
              ) : (
                <Badge variant="warning" className="flex items-center gap-1 text-xs">
                  <FileCheck className="h-3.5 w-3.5" /> RERA Verification Pending
                </Badge>
              )}
              <Badge variant="gold" className="text-xs">
                Certified Partner
              </Badge>
            </div>
          </Card>

          {/* Quick Credential Highlights */}
          <Card className="p-5 border-navy-100 space-y-3">
            <h4 className="font-display font-bold text-navy-900 text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-gold-500" /> Trust Badges & Verification
            </h4>
            <div className="text-xs space-y-2 text-navy-700">
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-50">
                <span>RERA License:</span>
                <span className="font-mono font-bold text-navy-900">
                  {form.license_number || profile?.license_number || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-50">
                <span>Direct Contact:</span>
                <span className="font-bold text-navy-900">{form.phone || user?.phone || 'Configured'}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-50">
                <span>Status:</span>
                <Badge variant="success" className="text-[10px]">
                  Active Agent
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Profile Form Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-navy-100 space-y-4">
            <h3 className="font-display font-bold text-navy-900 text-base border-b border-navy-100 pb-2 flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-gold-500" /> Personal & Agency Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">First Name *</label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="e.g. Ramesh"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">Last Name *</label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="e.g. Rao"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">Phone Number (Calling) *</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98000 00000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">WhatsApp Business Number</label>
                <Input
                  value={form.whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="+91 98000 00000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">Agency / Company Name</label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Hyderabad Prime Realty"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1">RERA Registration / License Number</label>
                <Input
                  value={form.license_number}
                  onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
                  placeholder="e.g. A02400001234"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-700 mb-1">Primary Real Estate Specialization</label>
              <select
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                className="w-full text-sm rounded-lg border border-navy-200 p-2.5 bg-white text-navy-900 focus:ring-2 focus:ring-gold-400 outline-none"
              >
                {SPECIALIZATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Areas */}
            <div>
              <label className="block text-xs font-bold text-navy-700 mb-1">Assigned Service Areas / Localities</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newAreaInput}
                  onChange={(e) => setNewAreaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddArea();
                    }
                  }}
                  placeholder="Add locality (e.g. Tellapur, Madhapur)..."
                  className="flex-1"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddArea}>
                  Add Area
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.assigned_areas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1 rounded-lg bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-800"
                  >
                    📍 {area}
                    <button
                      type="button"
                      onClick={() => handleRemoveArea(area)}
                      className="ml-1 text-navy-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-navy-700 mb-1">Professional Bio & Introduction</label>
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Describe your real estate background, portfolio track record, client service ethos, and major Hyderabad corridors you specialize in..."
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                icon={<Save className="h-4 w-4" />}
                disabled={saving || uploadingPhoto}
                className="px-6"
              >
                {saving ? 'Saving Profile...' : 'Save Profile Changes'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </DashboardLayout>
  );
}
