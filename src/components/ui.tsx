import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  gold: 'btn-gold',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: '',
  lg: 'text-base px-6 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(variantClass[variant], sizeClass[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export function Card({ className, children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('card', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold';
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-navy-100 text-navy-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    info: 'bg-navy-100 text-navy-700',
    gold: 'bg-gold-100 text-gold-700',
  };
  return <span className={cn('badge', styles[variant], className)}>{children}</span>;
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    hint?: string;
    containerClassName?: string;
  }
>(({ label, error, hint, className, containerClassName, id, ...props }, ref) => {
  const inputId = id || props.name;
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn('input', error && 'border-error-400 focus:ring-error-200', className)}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
    hint?: string;
    containerClassName?: string;
  }
>(({ label, error, hint, className, containerClassName, id, ...props }, ref) => {
  const taId = id || props.name;
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={taId} className="label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={taId}
        className={cn('input min-h-[96px] resize-y', error && 'border-error-400', className)}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
});
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    error?: string;
    hint?: string;
    containerClassName?: string;
    children: React.ReactNode;
  }
>(({ label, error, hint, className, containerClassName, id, children, ...props }, ref) => {
  const selId = id || props.name;
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={selId} className="label">
          {label}
        </label>
      )}
      <select ref={ref} id={selId} className={cn('input pr-8', error && 'border-error-400', className)} {...props}>
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
});
Select.displayName = 'Select';

export function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}) {
  const isModalOpen = open ?? isOpen ?? false;
  if (!isModalOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 pb-safe">
      <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn('relative z-10 w-full max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/80', sizes[size])}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-navy-100 px-4 sm:px-5 py-4">
            <h3 className="font-display text-lg font-semibold text-navy-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-4 sm:px-5 py-4 max-h-[calc(100dvh-7rem)] overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-navy-100 px-4 sm:px-5 py-3.5">{footer}</div>}
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-400">{icon}</div>
      )}
      <h3 className="font-display text-lg font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-navy-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-error-50 text-error-500">!</div>
      <p className="text-sm text-error-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={cn('h-5 w-5 animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="50" fill="#BA252A" />
      <polygon points="50,10 15.36,70 84.64,70" fill="white" />
      <polygon points="32.68,40 67.32,40 50,70" fill="#BA252A" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 p-4">
      <div className="relative flex items-center justify-center">
        {/* Outer ambient glow */}
        <div className="absolute inset-0 h-32 w-32 -translate-x-4 -translate-y-6 animate-pulse rounded-full bg-red-400/20 blur-2xl" style={{ animationDuration: '3s' }} />
        
        {/* Spinner rings */}
        <div className="absolute h-24 w-24 rounded-full border-[3px] border-slate-100" />
        <div className="absolute h-24 w-24 animate-spin rounded-full border-[3px] border-transparent border-t-red-600 border-r-red-500" style={{ animationDuration: '1.2s' }} />
        <div className="absolute h-20 w-20 animate-spin rounded-full border-[3px] border-transparent border-b-rose-500 border-l-rose-400 opacity-70" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
        
        {/* Inner static logo */}
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl shadow-red-500/10 p-2">
          <svg 
            viewBox="0 0 100 100" 
            className="h-full w-full object-contain"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="50" fill="#BA252A" />
            <polygon points="50,10 15.36,70 84.64,70" fill="white" />
            <polygon points="32.68,40 67.32,40 50,70" fill="#BA252A" />
          </svg>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">
          Loading Experience
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-500" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-500" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-500" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src)
    return (
      <img
        src={src}
        alt={name ?? undefined}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  const safeName = name || '?';
  return (
    <div
      className="grid place-items-center rounded-full bg-navy-700 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {safeName.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        checked ? 'bg-primary-600' : 'bg-navy-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export function BulkActionsBar({
  selected,
  onClear,
  onDelete,
  onExport,
  deleteLabel = 'Delete',
}: {
  selected: string[];
  onClear: () => void;
  onDelete: () => void;
  onExport?: () => void;
  deleteLabel?: string;
}) {
  if (!selected.length) return null;
  return (
    <div className="flex items-center justify-between rounded-xl border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm">
      <span className="font-medium text-navy-700">{selected.length} selected</span>
      <div className="flex gap-2">
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport}>
            Export
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}
