import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { ListPropertyWizard } from '../portal/list-property';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui';
import { PublishToSectionControl } from '../../components/admin/publish-to-section-control';

export function AdminPropertyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  React.useEffect(() => {
    // If the URL doesn't have the draft_id param, we should append it so ListPropertyWizard loads it
    const params = new URLSearchParams(window.location.search);
    if (!params.get('draft_id') && id) {
      params.set('draft_id', id);
      navigate(`/admin/properties/edit/${id}?${params.toString()}`, { replace: true });
    }
  }, [id, navigate]);

  return (
    <DashboardLayout sections={adminSections} title="Edit Property">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Button 
          variant="ghost" 
          icon={<ChevronLeft className="h-4 w-4" />} 
          onClick={() => navigate('/admin/properties')}
        >
          Back to Properties
        </Button>

        {id && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 hidden sm:inline">
              Publish to Homepage:
            </span>
            <PublishToSectionControl
              property={{ id, title: `Property #${id.slice(0, 8)}` }}
              compact={false}
            />
          </div>
        )}
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-navy-100 min-h-[80vh] overflow-hidden relative z-0">
        <div className="absolute inset-0 overflow-y-auto">
          <ListPropertyWizard isAdminMode={true} disableLayout={true} />
        </div>
      </div>
    </DashboardLayout>
  );
}

