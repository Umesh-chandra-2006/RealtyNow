import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Home, Briefcase, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Input, Textarea, Select, Button } from '../../components/ui';
import { useToast } from '../../components/toast';

type ReferralType = 'customer' | 'property' | 'service';

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Open Plots', 'Villa', 'Apartment', 'Farm Land', 'Industrial', 'Rental', 'Other'];
const SERVICE_CATEGORIES = [
  { value: 'home_loan', label: 'Home Loan' },
  { value: 'interior', label: 'Interior Design' },
  { value: 'home_service', label: 'Home Service / Maintenance' },
  { value: 'other', label: 'Other' },
];

export function PartnerReferralNew() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [type, setType] = useState<ReferralType>('customer');
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<{ code: string; id: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [customer, setCustomer] = useState({
    name: '', mobile: '', email: '', requirement: '', property_type: '', budget: '', location: '', purpose: 'buy',
  });
  const [property, setProperty] = useState({
    owner_name: '', owner_mobile: '', property_type: '', location: '', expected_price: '', area: '', description: '',
  });
  const [service, setService] = useState({
    category: 'home_loan', customer_name: '', customer_mobile: '', requirement: '',
    loan_amount: '', employment_type: '', area: '', budget: '', preferred_date: '',
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (type === 'customer') {
      if (!customer.name.trim()) errs.name = 'Name is required.';
      if (!/^[6-9]\d{9}$/.test(customer.mobile.trim())) errs.mobile = 'Enter a valid 10-digit mobile number.';
    } else if (type === 'property') {
      if (!property.owner_name.trim()) errs.owner_name = 'Owner name is required.';
      if (!/^[6-9]\d{9}$/.test(property.owner_mobile.trim())) errs.owner_mobile = 'Enter a valid 10-digit mobile number.';
      if (!property.property_type) errs.property_type = 'Select a property type.';
    } else {
      if (!service.customer_name.trim()) errs.customer_name = 'Customer name is required.';
      if (!/^[6-9]\d{9}$/.test(service.customer_mobile.trim())) errs.customer_mobile = 'Enter a valid 10-digit mobile number.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (force = false) => {
    if (!force && !validate()) return;
    setSubmitting(true);
    setDuplicate(null);
    try {
      let p_category: string | null = null;
      let details: Record<string, any> = {};
      if (type === 'customer') {
        p_category = null;
        details = { ...customer, mobile: customer.mobile.trim() };
      } else if (type === 'property') {
        details = { ...property, owner_mobile: property.owner_mobile.trim() };
      } else {
        p_category = service.category;
        details = { ...service, customer_mobile: service.customer_mobile.trim() };
      }

      const { data, error } = await supabase.rpc('create_referral', {
        p_referral_type: type,
        p_category,
        p_details: details,
        p_force: force,
      });
      if (error) throw new Error(error.message);

      if (data?.success === false) {
        if (data.code === 'DUPLICATE_REFERRAL' || data.code === 'DUPLICATE_LEAD') {
          setDuplicate({ code: data.code, id: data.existing_referral_id ?? data.existing_enquiry_id });
          return;
        }
        throw new Error(data.message || 'Could not submit referral.');
      }

      addToast('success', `Referral ${data.referral_code} submitted successfully.`);
      navigate(`/partner/referrals/${data.referral_id}`);
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to submit referral.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout sections={sections} title="New Referral">
      <Link to="/partner/referrals" className="inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Referrals
      </Link>
      <PageHeader title="Refer Someone" subtitle="Submit a customer, property, or service referral" />

      <Card className="p-6 mb-4">
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'customer', label: 'Customer', icon: User },
            { key: 'property', label: 'Property', icon: Home },
            { key: 'service', label: 'Service', icon: Briefcase },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-all ${
                type === key ? 'border-red-500 bg-red-50/50' : 'border-navy-200 bg-white hover:border-navy-300'
              }`}
            >
              <Icon className={`h-6 w-6 ${type === key ? 'text-red-600' : 'text-navy-400'}`} />
              <span className={`text-sm font-medium ${type === key ? 'text-red-700' : 'text-navy-600'}`}>{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {duplicate && (
        <Card className="p-4 mb-4 border-amber-300 bg-amber-50/60">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-navy-900">Potential duplicate referral detected</p>
              <p className="text-xs text-navy-500 mt-0.5">
                {duplicate.code === 'DUPLICATE_REFERRAL'
                  ? 'An open referral with this mobile number already exists.'
                  : 'An active lead with this mobile number already exists in our system.'}
              </p>
              <Button size="sm" variant="secondary" className="mt-3" loading={submitting} onClick={() => submit(true)}>
                Submit Anyway
              </Button>
            </div>
          </div>
        </Card>
      )}

      {type === 'customer' && (
        <Card className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Customer Name" value={customer.name} error={errors.name} onChange={(e) => setCustomer((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Mobile Number" value={customer.mobile} error={errors.mobile} maxLength={10}
              onChange={(e) => setCustomer((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} />
            <Input label="Email" type="email" value={customer.email} onChange={(e) => setCustomer((f) => ({ ...f, email: e.target.value }))} />
            <Select label="Buying / Renting" value={customer.purpose} onChange={(e) => setCustomer((f) => ({ ...f, purpose: e.target.value }))}>
              <option value="buy">Buy</option>
              <option value="rent">Rent</option>
            </Select>
            <Select label="Property Type" value={customer.property_type} onChange={(e) => setCustomer((f) => ({ ...f, property_type: e.target.value }))}>
              <option value="">Select...</option>
              {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input label="Budget" value={customer.budget} placeholder="e.g. 50L - 80L" onChange={(e) => setCustomer((f) => ({ ...f, budget: e.target.value }))} />
            <Input label="Preferred Location" value={customer.location} containerClassName="sm:col-span-2" onChange={(e) => setCustomer((f) => ({ ...f, location: e.target.value }))} />
            <Textarea label="Requirement Notes" value={customer.requirement} containerClassName="sm:col-span-2" rows={3}
              onChange={(e) => setCustomer((f) => ({ ...f, requirement: e.target.value }))} />
          </div>
        </Card>
      )}

      {type === 'property' && (
        <Card className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Owner Name" value={property.owner_name} error={errors.owner_name} onChange={(e) => setProperty((f) => ({ ...f, owner_name: e.target.value }))} />
            <Input label="Owner Mobile" value={property.owner_mobile} error={errors.owner_mobile} maxLength={10}
              onChange={(e) => setProperty((f) => ({ ...f, owner_mobile: e.target.value.replace(/\D/g, '') }))} />
            <Select label="Property Type" value={property.property_type} error={errors.property_type} onChange={(e) => setProperty((f) => ({ ...f, property_type: e.target.value }))}>
              <option value="">Select...</option>
              {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input label="Expected Price" value={property.expected_price} onChange={(e) => setProperty((f) => ({ ...f, expected_price: e.target.value }))} />
            <Input label="Location" value={property.location} onChange={(e) => setProperty((f) => ({ ...f, location: e.target.value }))} />
            <Input label="Area" value={property.area} placeholder="e.g. 1800 sq ft" onChange={(e) => setProperty((f) => ({ ...f, area: e.target.value }))} />
            <Textarea label="Description" value={property.description} containerClassName="sm:col-span-2" rows={3}
              onChange={(e) => setProperty((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </Card>
      )}

      {type === 'service' && (
        <Card className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Service Category" value={service.category} containerClassName="sm:col-span-2" onChange={(e) => setService((f) => ({ ...f, category: e.target.value }))}>
              {SERVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Customer Name" value={service.customer_name} error={errors.customer_name} onChange={(e) => setService((f) => ({ ...f, customer_name: e.target.value }))} />
            <Input label="Customer Mobile" value={service.customer_mobile} error={errors.customer_mobile} maxLength={10}
              onChange={(e) => setService((f) => ({ ...f, customer_mobile: e.target.value.replace(/\D/g, '') }))} />
            {service.category === 'home_loan' && (
              <>
                <Input label="Loan Amount" value={service.loan_amount} onChange={(e) => setService((f) => ({ ...f, loan_amount: e.target.value }))} />
                <Input label="Employment Type" value={service.employment_type} placeholder="Salaried / Self-employed" onChange={(e) => setService((f) => ({ ...f, employment_type: e.target.value }))} />
              </>
            )}
            {service.category === 'interior' && (
              <>
                <Input label="Area" value={service.area} placeholder="e.g. 1200 sq ft" onChange={(e) => setService((f) => ({ ...f, area: e.target.value }))} />
                <Input label="Budget" value={service.budget} onChange={(e) => setService((f) => ({ ...f, budget: e.target.value }))} />
              </>
            )}
            {service.category === 'home_service' && (
              <Input label="Preferred Date" type="date" value={service.preferred_date} onChange={(e) => setService((f) => ({ ...f, preferred_date: e.target.value }))} />
            )}
            <Textarea label="Requirement Notes" value={service.requirement} containerClassName="sm:col-span-2" rows={3}
              onChange={(e) => setService((f) => ({ ...f, requirement: e.target.value }))} />
          </div>
        </Card>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="primary" size="lg" loading={submitting} onClick={() => submit(false)}>Submit Referral</Button>
      </div>
    </DashboardLayout>
  );
}
