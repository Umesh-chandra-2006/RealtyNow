import { Button } from '../../../components/ui';
import type { WorkflowStep, WorkflowField } from '../../../lib/listing-config';

interface PreviewStepProps {
  steps: WorkflowStep[];
  fieldsByStep: Record<string, WorkflowField[]>;
  answers: Record<string, unknown>;
  onPublish: () => void;
  publishing: boolean;
}

function formatValue(field: WorkflowField, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field.field_type === 'boolean') return value ? 'Yes' : 'No';
  if (field.field_type === 'file') return `${(value as unknown[]).length} file(s)`;
  if (field.field_type === 'location') {
    const loc = value as { address?: string };
    return loc.address || '—';
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

export function PreviewStep({ steps, fieldsByStep, answers, onPublish, publishing }: PreviewStepProps) {
  const relevantSteps = steps.filter((s) => s.step_key !== 'ai_content' && s.step_key !== 'review');

  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-500">
        Review everything before publishing. Your listing will go to our team for approval.
      </p>
      {relevantSteps.map((step) => {
        const fields = fieldsByStep[step.id] ?? [];
        if (fields.length === 0) return null;
        return (
          <div key={step.id} className="rounded-xl border border-navy-150 p-4">
            <p className="mb-2 text-sm font-bold text-navy-800">{step.label}</p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.id}>
                  <dt className="text-xs font-semibold text-navy-400">{field.label}</dt>
                  <dd className="text-sm text-navy-800">{formatValue(field, answers[field.field_key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      <Button variant="primary" size="lg" className="w-full" loading={publishing} onClick={onPublish}>
        Submit Property
      </Button>
    </div>
  );
}
