import { type ClassValue, clsx } from 'clsx';
import { normalizeIndianMobile } from './phone';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export const RENT_LIKE_PURPOSES = ['Rent', 'Lease', 'PG', 'CoLiving', 'Hostel', 'Short Stay', 'Vacation Rental'];

export function getPropertyPrice(p?: { purpose?: string | null; price?: number | null; rent_amount?: number | null }): number | null {
  if (!p) return null;
  const isRent = RENT_LIKE_PURPOSES.includes(p.purpose || '');
  if (isRent) {
    return p.rent_amount && p.rent_amount > 0 ? p.rent_amount : null;
  }
  return p.price && p.price > 0 ? p.price : null;
}

export function formatPrice(value: number | null | undefined, purpose?: string): string {
  if (value == null) return '—';
  const isRent = RENT_LIKE_PURPOSES.includes(purpose || '');
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(value);
  return isRent ? `${formatted}/month` : formatted;
}

function trimTrailingZeros(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function formatCompactPrice(value: number | null | undefined, purpose?: string): string {
  if (value == null) return '—';
  const isRent = RENT_LIKE_PURPOSES.includes(purpose || '');
  let formatted = `₹${value}`;
  if (value >= 10000000) formatted = `₹${trimTrailingZeros(value / 10000000)} Cr`;
  else if (value >= 100000) formatted = `₹${trimTrailingZeros(value / 100000)} L`;
  else if (value >= 1000) formatted = `₹${(value / 1000).toFixed(0)}K`;

  return isRent ? `${formatted}/month` : formatted;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function initials(first: string | null, last: string | null, email?: string | null): string {
  const f = (first?.[0] ?? '').toUpperCase();
  const l = (last?.[0] ?? '').toUpperCase();
  if (f || l) return `${f}${l}`;
  return email?.[0]?.toUpperCase() ?? 'U';
}

export function truncate(text: string | null | undefined, len = 120): string {
  if (!text) return '';
  return text.length > len ? `${text.slice(0, len).trim()}…` : text;
}

/** Serialize any value to a safe CSV cell string. */
function serializeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function exportToCsv(
  filenameOrRows: string | Record<string, unknown>[],
  rowsOrFilename?: Record<string, unknown>[] | string,
  columns: { key: string; label: string }[] = [],
) {
  let filename: string;
  let rows: Record<string, unknown>[];
  const cols = columns;

  if (typeof filenameOrRows === 'string') {
    filename = filenameOrRows;
    rows = (rowsOrFilename as Record<string, unknown>[]) || [];
  } else {
    rows = filenameOrRows || [];
    filename = (rowsOrFilename as string) || 'export';
  }

  const effectiveCols = cols.length > 0 ? cols : Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }));
  const header = effectiveCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const body = rows
    .map((r) => effectiveCols.map((c) => `"${serializeCell(r[c.key]).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  // UTF-8 BOM ensures Excel opens the file with correct encoding
  const BOM = '\uFEFF';
  const csv = `${BOM}${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/\.csv$/, '')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(
  filenameOrRows: string | Record<string, unknown>[],
  rowsOrFilename?: Record<string, unknown>[] | string,
  columns: { key: string; label: string }[] = [],
) {
  let filename: string;
  let rows: Record<string, unknown>[];
  const cols = columns;

  if (typeof filenameOrRows === 'string') {
    filename = filenameOrRows;
    rows = (rowsOrFilename as Record<string, unknown>[]) || [];
  } else {
    rows = filenameOrRows || [];
    filename = (rowsOrFilename as string) || 'export';
  }

  const XLSX = await import('xlsx');
  const effectiveCols = cols.length > 0 ? cols : Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }));
  const data = rows.map((r) =>
    Object.fromEntries(effectiveCols.map((c) => [c.label, serializeCell(r[c.key])]))
  );
  const worksheet = XLSX.utils.json_to_sheet(data);
  // Auto-size columns to fit content
  const colWidths = effectiveCols.map((c) => ({
    wch: Math.min(60, Math.max(c.label.length + 2, ...data.map((row) => String(row[c.label] ?? '').length))),
  }));
  worksheet['!cols'] = colWidths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename.replace(/\.xlsx$/, '')}.xlsx`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function exportToPdf(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
) {
  const html2pdf = (await import('html2pdf.js')).default;
  const container = document.createElement('div');
  container.style.padding = '16px';
  container.innerHTML = `
    <h2 style="font-family: sans-serif; margin-bottom: 12px; font-size: 16px;">${escapeHtml(filename)}</h2>
    <table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 10px;">
      <thead>
        <tr>${columns.map((c) => `<th style="border:1px solid #ddd; padding:6px; text-align:left; background:#f5f5f5;">${escapeHtml(c.label)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((r) => `<tr>${columns.map((c) => `<td style="border:1px solid #ddd; padding:6px;">${escapeHtml(r[c.key])}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  await html2pdf()
    .set({ margin: 10, filename: `${filename}.pdf`, jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' } })
    .from(container)
    .save();
}

// Translates raw Postgres/Supabase/storage error text into a message safe to
// show end users — never surface RLS policy names, column names, or SQL
// error codes to them; the raw error still belongs in the console for
// debugging.
export function getFriendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  console.error(err);
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/row-level security policy/i.test(raw)) {
    return "We couldn't save that — please try again, and contact support if it keeps happening.";
  }
  if (/violates.*constraint|duplicate key/i.test(raw)) {
    return 'This looks like a duplicate submission. Please check your details and try again.';
  }
  if (/network|fetch/i.test(raw)) {
    return 'Network error — please check your connection and try again.';
  }
  return fallback;
}

export function generatePropertyUrl(p?: { id?: string | null; title?: string | null; seo_slug?: string | null } | null): string {
  if (!p || !p.id) return '#';
  if (p.seo_slug && typeof p.seo_slug === 'string' && p.seo_slug.trim()) {
    const cleanSeo = p.seo_slug.trim().replace(/^\/+/, '');
    return `/property/${cleanSeo}`;
  }
  if (!p.title) return `/property/${p.id}`;
  const slug = p.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60)
    .replace(/-$/, '');
  
  return `/property/${slug ? `${slug}-` : ''}${p.id}`;
}

/**
 * Normalizes phone numbers into E.164 standard (+91XXXXXXXXXX for India by default).
 * Accepts raw strings like "98765 43210", "+91 98765-43210", "09876543210".
 *
 * Delegates validation to the canonical src/lib/phone.ts (normalizeIndianMobile)
 * so contact-modal links / WhatsApp URLs can never diverge from Auth's "91..."
 * normalization. Invalid non-Indian inputs now return '' instead of a made-up
 * number.
 */
export function normalizePhoneNumber(phone?: string | null, defaultCountryCode = '+91'): string {
  const normalized = normalizeIndianMobile(phone ?? '');
  if (!normalized) return '';
  return `${defaultCountryCode}${normalized}`;
}

/**
 * Builds standard wa.me URL for the assigned Agent with a professional prefilled message.
 */
export function buildWhatsAppUrl(phone?: string | null, propertyTitle?: string | null): string {
  const normalized = normalizePhoneNumber(phone).replace(/\+/g, '');
  if (!normalized) return '';

  const titleText = propertyTitle?.trim() ? `'${propertyTitle.trim()}'` : 'this property';
  const text = `Hi, I'm interested in the property ${titleText} listed on RealtyNow. I would like to know more details.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

