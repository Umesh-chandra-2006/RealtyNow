import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, Home, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLanguageContext } from '../lib/i18n/language-context';
import { LanguageSelectorModal } from './language-selector-modal';
import { Avatar } from './ui';
import { Logo } from './logo';
import { NotificationBell } from './notification-bell';
import { cn } from '../lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: string | number;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry && Array.isArray((entry as NavGroup).children);
}

export interface NavSection {
  heading?: string;
  items: NavEntry[];
}

let savedSidebarScrollTop = 0;

// Global memory cache for expanded groups so navigation across pages never collapses groups
let globalExpandedGroups: Record<string, boolean> = (() => {
  try {
    const saved = localStorage.getItem('rn_sidebar_expanded_groups');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
})();

function persistExpandedGroups(groups: Record<string, boolean>) {
  globalExpandedGroups = { ...globalExpandedGroups, ...groups };
  try {
    localStorage.setItem('rn_sidebar_expanded_groups', JSON.stringify(globalExpandedGroups));
  } catch {
    // ignore
  }
}

export function DashboardLayout({
  children,
  sections,
  title,
  badge,
  breadcrumbs,
}: {
  children: React.ReactNode;
  sections: NavSection[];
  title: string;
  badge?: string;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  const { profile, signOut } = useAuth();
  const { currentLanguage, t } = useLanguageContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const desktopNavRef = useRef<HTMLElement>(null);

  // Collect all leaf targets for active matching
  const allNavTargets = useMemo(() => {
    const targets: string[] = [];
    sections.forEach((s) => {
      s.items.forEach((item) => {
        if (isNavGroup(item)) {
          item.children.forEach((c) => targets.push(c.to));
        } else {
          targets.push(item.to);
        }
      });
    });
    return targets;
  }, [sections]);

  const isActive = (to: string, end?: boolean) => {
    const [toPath, toSearch] = to.split('?');
    if (toSearch) {
      return location.pathname === toPath && location.search === `?${toSearch}`;
    }
    const pathMatches = end ? location.pathname === toPath : location.pathname === toPath || location.pathname.startsWith(`${toPath}/`);
    if (!pathMatches) return false;
    const moreSpecificSiblingActive = allNavTargets.some((other) => {
      if (other === to) return false;
      const [otherPath, otherSearch] = other.split('?');
      return !!otherSearch && otherPath === toPath && location.search === `?${otherSearch}`;
    });
    return !moreSpecificSiblingActive;
  };

  // Synchronous initialization: ensure active groups and previously open groups are immediately true on initial render
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { ...globalExpandedGroups };
    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (isNavGroup(item)) {
          const hasActiveChild = item.children.some((child) => {
            const [toPath, toSearch] = child.to.split('?');
            if (toSearch) {
              return location.pathname === toPath && location.search === `?${toSearch}`;
            }
            return child.end
              ? location.pathname === toPath
              : location.pathname === toPath || location.pathname.startsWith(`${toPath}/`);
          });
          if (hasActiveChild) {
            initial[item.key] = true;
          }
        }
      });
    });
    return initial;
  });

  useLayoutEffect(() => {
    if (desktopNavRef.current && savedSidebarScrollTop > 0) {
      desktopNavRef.current.scrollTop = savedSidebarScrollTop;
    }
  }, [location.pathname]);

  // Synchronize browser tab title with current dashboard page
  useEffect(() => {
    if (title) {
      document.title = `${title} | RealtyNow`;
    }
  }, [title]);

  // Ensure active group is expanded if URL changes dynamically
  useEffect(() => {
    let changed = false;
    const next = { ...expandedGroups };
    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (isNavGroup(item)) {
          const hasActiveChild = item.children.some((child) => isActive(child.to, child.end));
          if (hasActiveChild && !next[item.key]) {
            next[item.key] = true;
            changed = true;
          }
        }
      });
    });
    if (changed) {
      setExpandedGroups(next);
      persistExpandedGroups(next);
    }
  }, [location.pathname, location.search, sections]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      };
      persistExpandedGroups(next);
      return next;
    });
  };

  const renderNavEntry = (item: NavEntry, isMobile = false) => {
    if (isNavGroup(item)) {
      const isExpanded = !!expandedGroups[item.key];
      const hasActiveChild = item.children.some((c) => isActive(c.to, c.end));

      return (
        <div key={item.key} className="space-y-1 mb-1">
          <button
            type="button"
            onClick={() => toggleGroup(item.key)}
            className={cn(
              'sidebar-link w-full justify-between group cursor-pointer transition-colors',
              hasActiveChild ? 'bg-red-50/70 text-red-700 font-semibold' : 'text-navy-700 hover:bg-navy-50'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <item.icon className={cn('h-4 w-4 shrink-0 transition-colors', hasActiveChild ? 'text-red-600' : 'text-navy-500 group-hover:text-navy-700')} />
              <span className="truncate text-xs tracking-wide uppercase font-bold text-navy-800">{t(item.label, item.label)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                  {item.badge}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-navy-400 transition-transform duration-150 ease-out',
                  isExpanded ? 'rotate-180 text-red-600' : ''
                )}
              />
            </div>
          </button>

          {/* Sticky, non-jumping sub-menu panel */}
          <div
            className={cn(
              'overflow-hidden pl-3 pr-1 pt-0.5 pb-1 space-y-0.5 ml-4 border-l border-slate-200/90 transition-all duration-150',
              isExpanded ? 'block' : 'hidden'
            )}
          >
            {item.children.map((child) => {
              const active = isActive(child.to, child.end);
              return (
                <Link
                  key={child.to}
                  to={child.to}
                  onClick={() => isMobile && setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    active
                      ? 'bg-red-50 text-red-700 font-semibold border-l-2 border-red-600 pl-2 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <child.icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-red-600' : 'text-slate-400')} />
                  <span className="truncate">{t(child.label, child.label)}</span>
                  {child.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                      {child.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      );
    }

    const active = isActive(item.to, item.end);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => isMobile && setOpen(false)}
        className={cn('sidebar-link', active && 'sidebar-link-active')}
      >
        <item.icon className="h-4 w-4" />
        <span className="truncate">{t(item.label, item.label)}</span>
        {item.badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-navy-50/40">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-navy-100 bg-white lg:flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-navy-100 px-5">
          <Logo to="/" size={175} maxHeight={46} />
        </div>
        <nav
          ref={desktopNavRef}
          onScroll={(e) => {
            savedSidebarScrollTop = e.currentTarget.scrollTop;
          }}
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          {sections.map((section, i) => (
            <div key={i} className="mb-4">
              {section.heading && (
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-navy-400">
                  {t(section.heading, section.heading)}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => renderNavEntry(item, false))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-navy-100 p-3">
          <button
            onClick={() => {
              const isAdmin = profile?.role === 'admin';
              signOut();
              navigate(isAdmin ? '/admin/login' : '/');
            }}
            className="sidebar-link w-full text-left text-error-600 hover:bg-error-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> {t('common.logout', 'Sign out')}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-white lg:hidden flex flex-col"
            >
              <div className="flex h-16 items-center justify-between border-b border-navy-100 px-5">
                <Logo to="/" size={175} maxHeight={46} />
                <button onClick={() => setOpen(false)} className="cursor-pointer p-1">
                  <X className="h-5 w-5 text-navy-500" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                {sections.map((section, i) => (
                  <div key={i} className="mb-4">
                    {section.heading && (
                      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-navy-400">
                        {t(section.heading, section.heading)}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((item) => renderNavEntry(item, true))}
                    </div>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-navy-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden grid place-items-center rounded-lg p-2 text-navy-700 hover:bg-navy-50"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base sm:text-lg font-semibold text-navy-900 flex items-center gap-2 truncate">
              <span className="truncate">{t(title, title)}</span>
              {badge && <span className="badge bg-gold-100 text-gold-700 shrink-0">{badge}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setLangModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-red-500 bg-white hover:bg-red-50/50 text-slate-800 font-bold text-xs transition-all shadow-xs cursor-pointer"
              title={t('common.selectLanguage', 'Select Language')}
            >
              <Globe className="h-4 w-4 text-red-600" />
              <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
              <span className="sm:hidden uppercase font-mono">{currentLanguage.code}</span>
            </button>
            <Link
              to="/"
              className="hidden sm:grid place-items-center rounded-xl p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 transition-colors"
              aria-label="Home"
            >
              <Home className="h-5 w-5" />
            </Link>
            <NotificationBell />
            <Link
              to={
                profile?.role === 'admin'
                  ? '/admin/settings'
                  : profile?.role === 'agent'
                    ? '/agent/settings'
                    : '/portal/settings'
              }
              className="flex items-center justify-center rounded-full p-0.5 ring-2 ring-slate-100 hover:ring-red-300 transition-all ml-0.5"
              aria-label="Settings & Profile"
            >
              <Avatar
                name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || (profile?.email ?? 'U')}
                src={profile?.avatar_url}
                size={34}
              />
            </Link>
          </div>
        </header>

        <LanguageSelectorModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  action,
  actions,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: PageHeaderAction[];
  breadcrumbs?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-navy-400 mb-1.5 font-medium">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span key={idx} className="flex items-center gap-1.5">
                  {crumb.to && !isLast ? (
                    <Link to={crumb.to} className="hover:text-red-600 transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast ? 'text-red-700 font-semibold' : '')}>{crumb.label}</span>
                  )}
                  {!isLast && <span className="text-slate-300">/</span>}
                </span>
              );
            })}
          </nav>
        )}
        <h2 className="font-display text-2xl font-bold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-navy-500">{subtitle}</p>}
      </div>
      {action}
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer',
                a.primary
                  ? 'bg-navy-900 text-white hover:bg-navy-800'
                  : 'border border-navy-200 text-navy-700 hover:bg-navy-50',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  accent = 'navy',
  to,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  accent?: 'navy' | 'gold' | 'success' | 'error';
  to?: string;
  onClick?: () => void;
}) {
  const accentBg = {
    navy: 'bg-navy-50 text-navy-700',
    gold: 'bg-gold-50 text-gold-600',
    success: 'bg-success-50 text-success-600',
    error: 'bg-error-50 text-error-600',
  }[accent];

  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-navy-500 font-medium group-hover:text-navy-700 transition-colors">{label}</p>
        <p className="mt-2 font-display text-2xl font-bold text-navy-900">{value}</p>
        {trend && <p className="mt-1 text-xs text-success-600 font-semibold">{trend}</p>}
      </div>
      <div
        className={cn(
          'grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:scale-110',
          accentBg,
        )}
      >
        {icon}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="card p-5 block group hover:shadow-cardHover hover:border-navy-300 transition-all cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        className="card p-5 block group hover:shadow-cardHover hover:border-navy-300 transition-all cursor-pointer"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      {content}
    </motion.div>
  );
}
