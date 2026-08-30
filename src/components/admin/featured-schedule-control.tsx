import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Zap,
  Calendar as CalendarIcon,
  AlertCircle,
  Clock,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { deriveFeaturedStatus, type FeaturedStatus } from '../../lib/featured-properties-api';

interface ScheduleControlProps {
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  onStartChange?: (isoString: string | null) => void;
  onEndChange?: (isoString: string | null) => void;
  onActiveChange?: (active: boolean) => void;
  onStartAtChange?: (isoString: string | null) => void;
  onEndAtChange?: (isoString: string | null) => void;
  onIsActiveChange?: (active: boolean) => void;
  className?: string;
}

// Quick Date presets
const QUICK_DATES = [
  { label: 'Today', getDays: () => 0 },
  { label: 'Tomorrow', getDays: () => 1 },
  { label: 'This Weekend', getDays: () => {
    const d = new Date();
    const day = d.getDay();
    return day === 6 ? 0 : 6 - day;
  }},
  { label: 'Next Week (7d)', getDays: () => 7 },
  { label: 'Next Month (30d)', getDays: () => 30 },
];

// Quick Time presets
const QUICK_TIMES = [
  { label: '09:00 AM', hour: 9, min: 0, period: 'AM' },
  { label: '10:00 AM', hour: 10, min: 0, period: 'AM' },
  { label: '12:00 PM', hour: 12, min: 0, period: 'PM' },
  { label: '02:00 PM', hour: 2, min: 0, period: 'PM' },
  { label: '04:00 PM', hour: 4, min: 0, period: 'PM' },
  { label: '06:00 PM', hour: 6, min: 0, period: 'PM' },
  { label: '11:59 PM', hour: 11, min: 59, period: 'PM' },
];

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format a Date object to "24 Aug 2026"
 */
function formatDateDisplay(d: Date | null): string {
  if (!d) return 'Not Set';
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format a Date object to "10:00 AM"
 */
function formatTimeDisplay(d: Date | null): string {
  if (!d) return 'Not Set';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  return `${hoursStr}:${minStr} ${period}`;
}

/**
 * Calculate readable duration between two dates
 */
function getDurationDisplay(start: Date | null, end: Date | null): string {
  if (!start || !end) return 'Continuous / Ongoing';
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 'Invalid duration';

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHrs / 24);
  const remHrs = diffHrs % 24;

  if (days === 0) return `${diffHrs} hours`;
  if (remHrs === 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${days} day${days > 1 ? 's' : ''}, ${remHrs} hr${remHrs > 1 ? 's' : ''}`;
}

// ──────────────────────────────────────────────────────────────
// Custom Date & Time Picker Modal (Enterprise Popover / Modal)
// ──────────────────────────────────────────────────────────────
interface DateTimePickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValue: string | null;
  onApply: (iso: string) => void;
  minDate?: Date | null;
}

function DateTimePickerModal({
  open,
  onClose,
  title,
  initialValue,
  onApply,
  minDate,
}: DateTimePickerModalProps) {
  const initialDate = useMemo(() => {
    return initialValue ? new Date(initialValue) : new Date();
  }, [initialValue]);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Time State
  const [selectedHour, setSelectedHour] = useState(() => {
    const h = initialDate.getHours() % 12;
    return h === 0 ? '12' : String(h).padStart(2, '0');
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const m = initialDate.getMinutes();
    const nearest5 = Math.round(m / 5) * 5;
    return String(nearest5 >= 60 ? 55 : nearest5).padStart(2, '0');
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(() => {
    return initialDate.getHours() >= 12 ? 'PM' : 'AM';
  });

  // Reset when initialValue changes
  useEffect(() => {
    if (open) {
      const d = initialValue ? new Date(initialValue) : new Date();
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
      setSelectedDay(d.getDate());
      const h = d.getHours() % 12;
      setSelectedHour(h === 0 ? '12' : String(h).padStart(2, '0'));
      const m = d.getMinutes();
      const nearest5 = Math.round(m / 5) * 5;
      setSelectedMinute(String(nearest5 >= 60 ? 55 : nearest5).padStart(2, '0'));
      setSelectedPeriod(d.getHours() >= 12 ? 'PM' : 'AM');
    }
  }, [open, initialValue]);

  // Days in month calculation
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const applyQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    setSelectedDay(d.getDate());
  };

  const applyQuickTime = (hour: number, min: number, period: 'AM' | 'PM') => {
    setSelectedHour(String(hour).padStart(2, '0'));
    setSelectedMinute(String(min).padStart(2, '0'));
    setSelectedPeriod(period);
  };

  const handleConfirm = () => {
    let h = parseInt(selectedHour, 10);
    if (selectedPeriod === 'PM' && h < 12) h += 12;
    if (selectedPeriod === 'AM' && h === 12) h = 0;
    const m = parseInt(selectedMinute, 10);

    const d = new Date(currentYear, currentMonth, selectedDay, h, m, 0);
    onApply(d.toISOString());
    onClose();
  };

  if (!open) return null;

  const today = new Date();
  const isTodayMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-navy-950/70 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-navy-900">{title}</h4>
                <p className="text-[10px] font-semibold text-navy-400">
                  IST (UTC+5:30) · Custom Enterprise Scheduler
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Quick Date Presets */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
                Quick Date Selection
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DATES.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => applyQuickDate(q.getDays())}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. Interactive Calendar */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-3">
                {/* Month / Year Bar */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-navy-900">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-navy-600 hover:bg-slate-100 transition"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-navy-600 hover:bg-slate-100 transition"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-navy-400 uppercase">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-7 w-7" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDay === day;
                    const isToday = isTodayMonth && today.getDate() === day;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          'h-7 w-7 mx-auto flex items-center justify-center rounded-full font-bold transition-all text-xs',
                          isSelected
                            ? 'bg-red-600 text-white shadow-xs scale-105'
                            : isToday
                            ? 'border-2 border-red-500 text-red-600 hover:bg-red-50'
                            : 'text-navy-800 hover:bg-slate-200'
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Interactive Time Selector */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-navy-900 flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-red-600" /> Select Time
                    </span>
                    <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                      {selectedHour}:{selectedMinute} {selectedPeriod}
                    </span>
                  </div>

                  {/* AM / PM Toggle */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl mb-3">
                    {(['AM', 'PM'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPeriod(p)}
                        className={cn(
                          'py-1 rounded-lg text-xs font-bold transition-all',
                          selectedPeriod === p
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-navy-600 hover:text-navy-900'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Hour Pills */}
                  <div className="space-y-1 mb-2">
                    <p className="text-[10px] font-bold text-navy-400 uppercase">Hour</p>
                    <div className="grid grid-cols-6 gap-1">
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setSelectedHour(h)}
                          className={cn(
                            'py-1 rounded-lg text-[11px] font-bold transition',
                            selectedHour === h
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-navy-700 hover:border-red-200'
                          )}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Minute Pills */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-navy-400 uppercase">Minute</p>
                    <div className="grid grid-cols-6 gap-1">
                      {MINUTES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMinute(m)}
                          className={cn(
                            'py-1 rounded-lg text-[11px] font-bold transition',
                            selectedMinute === m
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-navy-700 hover:border-red-200'
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Times */}
                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-[10px] font-bold text-navy-400 uppercase mb-1">Quick Times</p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_TIMES.slice(0, 4).map((qt) => (
                      <button
                        key={qt.label}
                        type="button"
                        onClick={() => applyQuickTime(qt.hour, qt.min, qt.period as any)}
                        className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-navy-600 hover:text-red-600 hover:border-red-200"
                      >
                        {qt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-navy-600 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition active:scale-95"
            >
              <Check className="h-3.5 w-3.5" /> Apply Date & Time
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Featured Schedule Control Component
// ──────────────────────────────────────────────────────────────
export function FeaturedScheduleControl({
  startAt,
  endAt,
  isActive,
  onStartChange,
  onEndChange,
  onActiveChange,
  onStartAtChange,
  onEndAtChange,
  onIsActiveChange,
  className,
}: ScheduleControlProps) {
  const handleStartChange = onStartChange || onStartAtChange || (() => {});
  const handleEndChange = onEndChange || onEndAtChange || (() => {});
  const handleActiveChange = onActiveChange || onIsActiveChange || (() => {});
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);

  const startDateObj = useMemo(() => (startAt ? new Date(startAt) : null), [startAt]);
  const endDateObj = useMemo(() => (endAt ? new Date(endAt) : null), [endAt]);

  const status: FeaturedStatus = useMemo(() => {
    return deriveFeaturedStatus({
      is_active: isActive,
      start_at: startAt,
      end_at: endAt,
    });
  }, [isActive, startAt, endAt]);

  // Validation: End date cannot be before Start date
  const isInvalidRange = useMemo(() => {
    if (startDateObj && endDateObj) {
      return endDateObj.getTime() <= startDateObj.getTime();
    }
    return false;
  }, [startDateObj, endDateObj]);

  const handlePublishImmediately = () => {
    const now = new Date();
    handleStartChange(now.toISOString());
    handleActiveChange(true);
  };

  const handleNoEndDateToggle = () => {
    if (endAt) {
      handleEndChange(null);
    } else {
      // Default to 7 days from start
      const base = startDateObj || new Date();
      const nextEnd = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
      handleEndChange(nextEnd.toISOString());
    }
  };

  return (
    <div className={cn('space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs', className)}>
      {/* Header & Quick Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Featured Schedule & Activation
            </h5>
            <span className="text-[10px] text-navy-400 font-medium">Timezone: IST (UTC+5:30)</span>
          </div>
        </div>

        {/* Quick Action: Publish Immediately */}
        <button
          type="button"
          onClick={handlePublishImmediately}
          className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50/80 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition"
        >
          <Zap className="h-3 w-3" /> Publish Immediately
        </button>
      </div>

      {/* 2 Interactive Scheduling Trigger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* START DATE & TIME CARD */}
        <div
          onClick={() => setIsStartModalOpen(true)}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/60 p-3 hover:border-red-400 hover:bg-red-50/20 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-navy-500 mb-1.5">
            <span className="flex items-center gap-1.5 text-navy-700 group-hover:text-red-600">
              <CalendarIcon className="h-3.5 w-3.5 text-red-600" /> Start Date & Time
            </span>
            <span className="text-[10px] text-red-600 font-extrabold group-hover:underline">Edit</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-navy-900">
              {formatDateDisplay(startDateObj)}
            </span>
            <span className="text-xs font-bold text-navy-600 flex items-center gap-1">
              <Clock className="h-3 w-3 text-navy-400" />
              {formatTimeDisplay(startDateObj)}
            </span>
          </div>
        </div>

        {/* END DATE & TIME CARD */}
        <div
          onClick={() => setIsEndModalOpen(true)}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/60 p-3 hover:border-red-400 hover:bg-red-50/20 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-navy-500 mb-1.5">
            <span className="flex items-center gap-1.5 text-navy-700 group-hover:text-red-600">
              <Clock3 className="h-3.5 w-3.5 text-red-600" /> End Date & Time
            </span>
            <span className="text-[10px] text-red-600 font-extrabold group-hover:underline">Edit</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-navy-900">
              {endDateObj ? formatDateDisplay(endDateObj) : 'No End Date (Continuous)'}
            </span>
            <span className="text-xs font-bold text-navy-600 flex items-center gap-1">
              {endDateObj ? (
                <>
                  <Clock className="h-3 w-3 text-navy-400" />
                  {formatTimeDisplay(endDateObj)}
                </>
              ) : (
                <InfinityIcon className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Validation Alert */}
      {isInvalidRange && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-semibold animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>End date and time must be after the start date and time.</span>
        </div>
      )}

      {/* Options Row: No End Date & Modern Active Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        {/* No End Date Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-navy-700 select-none">
          <input
            type="checkbox"
            checked={!endAt}
            onChange={handleNoEndDateToggle}
            className="rounded text-red-600 focus:ring-red-500 cursor-pointer h-4 w-4"
          />
          <span>No End Date (Keep active indefinitely)</span>
        </label>

        {/* Modern Animated Toggle Switch */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-navy-700">Featured Status:</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => handleActiveChange(!isActive)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              isActive ? 'bg-red-600' : 'bg-slate-300'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                isActive ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
          <span
            className={cn(
              'text-xs font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider',
              isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Schedule Summary & Vertical Timeline Visual */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
            Live Schedule Preview
          </span>
          {/* Status Badge */}
          {status === 'ACTIVE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
              ● Active
            </span>
          )}
          {status === 'SCHEDULED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
              ● Scheduled
            </span>
          )}
          {status === 'EXPIRED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
              ● Expired
            </span>
          )}
          {status === 'INACTIVE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
              ● Inactive
            </span>
          )}
        </div>

        {/* Visual Vertical Timeline */}
        <div className="relative pl-5 space-y-3 text-xs before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-red-500">
          <div className="relative">
            <span className="absolute -left-[17px] top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-4 ring-white" />
            <p className="text-[10px] font-extrabold uppercase text-red-600">Start Time</p>
            <p className="font-bold text-navy-900">
              {formatDateDisplay(startDateObj)} · {formatTimeDisplay(startDateObj)}
            </p>
          </div>

          <div className="text-[11px] font-semibold text-navy-500 pl-1">
            Duration: <span className="font-bold text-navy-800">{getDurationDisplay(startDateObj, endDateObj)}</span>
          </div>

          <div className="relative">
            <span className="absolute -left-[17px] top-1 h-2.5 w-2.5 rounded-full bg-navy-800 ring-4 ring-white" />
            <p className="text-[10px] font-extrabold uppercase text-navy-600">End Time</p>
            <p className="font-bold text-navy-900">
              {endDateObj
                ? `${formatDateDisplay(endDateObj)} · ${formatTimeDisplay(endDateObj)}`
                : 'Continuous (No Expiry Date)'}
            </p>
          </div>
        </div>
      </div>

      {/* Date Pickers Modals */}
      <DateTimePickerModal
        open={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Schedule Start Date & Time"
        initialValue={startAt}
        onApply={(iso) => handleStartChange(iso)}
      />

      <DateTimePickerModal
        open={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title="Schedule End Date & Time"
        initialValue={endAt}
        onApply={(iso) => handleEndChange(iso)}
        minDate={startDateObj}
      />
    </div>
  );
}
