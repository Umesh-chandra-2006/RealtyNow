import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  ChevronDown,
  Search,
  Heart,
  LogOut,
  Globe,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  LayoutDashboard,
  MapPin,
  User,
  ChevronRight,
  ArrowRight,
  LogIn,
  Home,
  Building2,
  Store,
  Landmark,
  Compass,
  Calculator,
  TrendingUp,
  Users,
  Hammer,
  Star,
  FileText,
  Truck,
  Briefcase,
  ShieldCheck,
  PaintBucket,
  Droplets,
  PieChart,
  Bug,
  Paintbrush,
  Sparkles,
  Bot,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLanguageContext } from '../lib/i18n/language-context';
import { LanguageSelectorModal } from './language-selector-modal';
import { Avatar } from './ui';
import { Logo, LogoLight } from './logo';
import { LocationSelector } from './location-selector';
import { cn } from '../lib/utils';
import { PostPropertyLink } from './post-property-link';
import { HeaderSearchModal } from './header-search-modal';

// Official X (formerly Twitter) SVG Icon
const XTwitterIcon = ({ className = 'h-3.5 w-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function isRouteActive(to: string, pathname: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/* ─── Nav data ──────────────────────────────────────────────── */
type MegaItem = {
  label: string;
  desc: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If set, show a confirmation popup with this message before navigating (e.g. hand-off to RealtyNow's team). */
  confirmMessage?: string;
};

type MegaColumn = {
  title: string;
  items: MegaItem[];
};

type MegaMenu = {
  title: string;
  badge: string;
  columns: MegaColumn[];
};

const getMegaMenuConfig = (t: (key: string, fallback?: string) => string): Record<string, MegaMenu> => ({
  Buy: {
    title: t('menu.buyTitle', 'Buy Properties'),
    badge: t('menu.buyBadge', 'Verified'),
    columns: [
      {
        title: t('menu.residentialBuy', 'Residential Buy'),
        items: [
          {
            label: t('menu.flatsApartments', 'Flats & Apartments'),
            desc: t('menu.flatsDesc', 'Ready & under-construction 1-5 BHK'),
            to: '/search?purpose=Sale&type=Apartment',
            icon: Home,
          },
          {
            label: t('menu.luxuryVillas', 'Luxury Villas'),
            desc: t('menu.villasDesc', 'Gated community & standalone villas'),
            to: '/search?purpose=Sale&type=Villa',
            icon: Landmark,
          },
          {
            label: t('menu.plotLand', 'Plot & Land'),
            desc: t('menu.plotsDesc', 'Residential & commercial plots'),
            to: '/search?purpose=Sale&type=Plots',
            icon: Compass,
          },
        ],
      },
      {
        title: t('menu.commercialBuy', 'Commercial Buy'),
        items: [
          {
            label: t('menu.commercialOffices', 'Commercial Offices'),
            desc: t('menu.officesDesc', 'Grade-A corporate workspaces'),
            to: '/search?purpose=Sale&type=Office+Space',
            icon: Briefcase,
          },
          {
            label: t('menu.retailShops', 'Retail & Shops'),
            desc: t('menu.shopsDesc', 'High footfall retail outlets'),
            to: '/search?purpose=Sale&type=Shop',
            icon: Store,
          },
          {
            label: t('menu.warehouses', 'Warehouses'),
            desc: t('menu.warehousesDesc', 'Logistics & industrial hubs'),
            to: '/search?purpose=Sale&type=Warehouse',
            icon: Building2,
          },
        ],
      },
      {
        title: t('menu.toolsTrends', 'Tools & Trends'),
        items: [
          {
            label: t('menu.emiCalculator', 'Home Loan EMI Calculator'),
            desc: t('menu.emiDesc', 'Calculate monthly payments'),
            to: '/emi-calculator',
            icon: Calculator,
          },
          {
            label: t('menu.priceTrends', 'Price Trends & ROI'),
            desc: t('menu.trendsDesc', 'High appreciation hotspots'),
            to: '/search?luxury=1',
            icon: TrendingUp,
          },
        ],
      },
    ],
  },
  Rent: {
    title: t('menu.rentTitle', 'Rent Properties'),
    badge: t('menu.rentBadge', 'Trending'),
    columns: [
      {
        title: t('menu.residentialRent', 'Residential Rent'),
        items: [
          {
            label: t('menu.flatsApartments', 'Flats & Apartments'),
            desc: t('menu.rentFlatsDesc', 'Verified furnished rentals'),
            to: '/search?purpose=Rent&type=Apartment',
            icon: Home,
          },
          {
            label: t('menu.independentHouses', 'Independent Houses'),
            desc: t('menu.housesDesc', 'Spacious family homes with yard'),
            to: '/search?purpose=Rent&type=Independent+House',
            icon: Landmark,
          },
          {
            label: t('menu.penthouseSuites', 'Penthouse Suites'),
            desc: t('menu.penthouseDesc', 'Skyline views & luxury specs'),
            to: '/search?purpose=Rent&type=Penthouse',
            icon: Star,
          },
        ],
      },
      {
        title: t('menu.commercialRent', 'Commercial Rent'),
        items: [
          {
            label: t('menu.officeSpaces', 'Office Spaces'),
            desc: t('menu.servicedDesksDesc', 'Fully serviced flexible desks'),
            to: '/search?purpose=Rent&type=Office+Space',
            icon: Briefcase,
          },
          {
            label: t('menu.commercialShops', 'Commercial Shops'),
            desc: t('menu.streetRetailDesc', 'High visibility street retail'),
            to: '/search?purpose=Rent&type=Shop',
            icon: Store,
          },
          {
            label: t('menu.industrialFacilities', 'Industrial Facilities'),
            desc: t('menu.heavyShedsDesc', 'Heavy industrial sheds'),
            to: '/search?purpose=Rent&type=Industrial',
            icon: Building2,
          },
        ],
      },
      {
        title: t('menu.rentingServices', 'Renting Services'),
        items: [
          {
            label: t('menu.rentalAgreement', 'Rental Agreement'),
            desc: t('menu.legalDraftDesc', 'Instant online legal draft'),
            to: '/contact?service=Legal+Services',
            icon: FileText,
          },
          {
            label: t('menu.packersMovers', 'Packers & Movers'),
            desc: t('menu.relocationDesc', 'Stress-free home relocation'),
            to: '/contact?service=Packers+and+Movers',
            icon: Truck,
            confirmMessage: t(
              'menu.packersConfirmMessage',
              "You'll be taken to our Contact page — our RealtyNow team will personally assist you with packers & movers.",
            ),
          },
        ],
      },
    ],
  },
  Commercial: {
    title: t('menu.commercialSpaces', 'Commercial Spaces'),
    badge: t('menu.highRoi', 'High ROI'),
    columns: [
      {
        title: t('menu.commercialBuying', 'Commercial Buying'),
        items: [
          {
            label: t('menu.itParksOffices', 'IT Parks & Offices'),
            desc: t('menu.corporateFloorsDesc', 'Grade-A corporate floors'),
            to: '/commercial?purpose=Sale&type=Office+Space',
            icon: Briefcase,
          },
          {
            label: t('menu.showroomsShops', 'Showrooms & Shops'),
            desc: t('menu.primeRetailDesc', 'Prime main road commercial retail'),
            to: '/commercial?purpose=Sale&type=Shop',
            icon: Store,
          },
          {
            label: t('menu.commercialLand', 'Commercial Land'),
            desc: t('menu.towersPlotDesc', 'Development plots for towers'),
            to: '/commercial?purpose=Sale&type=Land',
            icon: Compass,
          },
        ],
      },
      {
        title: t('menu.commercialRenting', 'Commercial Renting'),
        items: [
          {
            label: t('menu.coworkingDesks', 'Co-Working Desks'),
            desc: t('menu.sharedPassesDesc', 'Flexible shared office passes'),
            to: '/commercial?purpose=Rent&type=Office+Space',
            icon: Users,
          },
          {
            label: t('menu.warehouseStorage', 'Warehouse & Storage'),
            desc: t('menu.hubsDesc', 'Cold storage & distribution hubs'),
            to: '/commercial?purpose=Rent&type=Warehouse',
            icon: Building2,
          },
        ],
      },
    ],
  },
});

/* ─── Services dropdown (simple glassmorphism flyout, not a full mega menu) ── */
type ServiceLink = {
  label: string;
  desc: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  confirmMessage?: string;
};

const getServicesMenu = (t: (key: string, fallback?: string) => string): ServiceLink[] => [
  {
    label: t('menu.homeServices', 'Home Services'),
    desc: t('menu.homeServicesDesc', 'Professional care for your home'),
    to: 'https://kamkaka.com',
    icon: Hammer,
  },
  {
    label: t('menu.interiorServices', 'Interior Services'),
    desc: t('menu.interiorServicesDesc', 'Design beautiful spaces'),
    to: 'https://borninteriors.in',
    icon: PaintBucket,
  },
  {
    label: t('menu.borewellServices', 'Borewell Services'),
    desc: t('menu.borewellServicesDesc', 'Reliable water solutions'),
    to: '/borewell-services',
    icon: Droplets,
  },
  {
    label: t('menu.homeLoans', 'Home Loans'),
    desc: t('menu.homeLoansDesc', 'Easy financing for your dream home'),
    to: '/home-loans',
    icon: PieChart,
  },
  {
    label: t('menu.legalServices', 'Legal Services'),
    desc: t('menu.legalServicesDesc', 'Agreements & documentation'),
    to: '/contact?service=Legal+Services',
    icon: FileText,
    confirmMessage: t(
      'menu.legalConfirmMessage',
      "You'll be taken to our Contact page — our RealtyNow team will personally assist you with legal services.",
    ),
  },
  {
    label: t('menu.packersMovers', 'Packers & Movers'),
    desc: t('menu.packersMoversDesc', 'Stress-free home relocation'),
    to: '/contact?service=Packers+and+Movers',
    icon: Truck,
    confirmMessage: t(
      'menu.packersConfirmMessage',
      "You'll be taken to our Contact page — our RealtyNow team will personally assist you with packers & movers.",
    ),
  },
  {
    label: t('menu.pestControl', 'Pest Control'),
    desc: t('menu.pestControlDesc', 'Safe, effective treatments'),
    to: '/contact?service=Pest+Control',
    icon: Bug,
    confirmMessage: t(
      'menu.pestConfirmMessage',
      "You'll be taken to our Contact page — our RealtyNow team will personally assist you with pest control.",
    ),
  },
  {
    label: t('menu.painting', 'Painting'),
    desc: t('menu.paintingDesc', 'Interior & exterior painting'),
    to: '/contact?service=Painting',
    icon: Paintbrush,
    confirmMessage: t(
      'menu.paintingConfirmMessage',
      "You'll be taken to our Contact page — our RealtyNow team will personally assist you with painting.",
    ),
  },
  {
    label: t('menu.cleaning', 'Cleaning'),
    desc: t('menu.cleaningDesc', 'Deep cleaning for move-in/out'),
    to: '/contact?service=Cleaning',
    icon: Sparkles,
    confirmMessage: t(
      'menu.cleaningConfirmMessage',
      "You'll be taken to our Contact page — our RealtyNow team will personally assist you with cleaning.",
    ),
  },
];

/* ─── Topbar (42px) ─────────────────────────────────────────── */
function Topbar({ onOpenLanguageModal }: { onOpenLanguageModal: () => void }) {
  const { currentLanguage, t } = useLanguageContext();

  return (
    <div className="hidden h-[42px] border-b border-navy-800 bg-navy-900 text-navy-200 lg:block">
      <div className="container-wide flex h-full items-center justify-between text-xs">
        <LocationSelector isTransparent={false} />

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenLanguageModal}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
            title={t('common.selectLanguage', 'Change Language')}
            aria-label={t('common.selectLanguage', 'Change Language')}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{currentLanguage.code.toUpperCase()}</span>
            <span className="text-navy-400">· {currentLanguage.nativeName}</span>
          </button>

          <div className="flex items-center gap-3 border-l border-white/10 pl-4">
            {[
              { Icon: Facebook, label: 'Facebook' },
              { Icon: XTwitterIcon, label: 'X (Twitter)' },
              { Icon: Instagram, label: 'Instagram' },
              { Icon: Linkedin, label: 'LinkedIn' },
              { Icon: Youtube, label: 'YouTube' },
            ].map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="text-navy-400 transition-colors hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main layout ───────────────────────────────────────────── */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguageContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [pendingHandoff, setPendingHandoff] = useState<{ to: string; message: string } | null>(null);

  const desktopNavRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(desktopNavRef, () => setHoveredMenu(null), hoveredMenu !== null);
  useClickOutside(userMenuRef, () => setUserMenu(false), userMenu);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setMobileOpen(false);
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileAccordion(null);
    setHoveredMenu(null);
    setUserMenu(false);
  }, [location.pathname]);

  const dashboardLink =
    profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'agent'
        ? '/agent'
        : profile?.role === 'builder'
          ? '/builder'
          : '/portal';

  const megaMenuConfig = getMegaMenuConfig(t);
  const servicesMenu = getServicesMenu(t);

  const dynamicNavLinks = [
    { key: 'Buy', label: t('common.sale', 'Buy'), to: '/buy', hasMega: true },
    { key: 'Rent', label: t('common.rent', 'Rent'), to: '/rent', hasMega: true },
    { key: 'Commercial', label: t('common.commercial', 'Commercial'), to: '/commercial', hasMega: true },
    { key: 'Projects', label: t('common.projects', 'Projects'), to: '/projects' },
    { key: 'Plots', label: t('common.plots', 'Plots'), to: '/plots' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar onOpenLanguageModal={() => setLanguageModalOpen(true)} />
      <LanguageSelectorModal isOpen={languageModalOpen} onClose={() => setLanguageModalOpen(false)} />

      {/* Global Intelligent Search Discovery Modal */}
      <HeaderSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchQuery}
      />

      {/* Hand-off confirmation — shown before routing a mega-menu item to the Contact page */}
      <AnimatePresence>
        {pendingHandoff && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm"
              onClick={() => setPendingHandoff(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-navy-100 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy-900">
                    {t('common.realtynowTeamAssist', 'RealtyNow team will assist you')}
                  </p>
                  <p className="mt-1 text-xs text-navy-500">{pendingHandoff.message}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setPendingHandoff(null)}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-navy-600 hover:bg-navy-50"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    const to = pendingHandoff.to;
                    setPendingHandoff(null);
                    navigate(to);
                  }}
                  className="rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-700"
                >
                  {t('common.continue', 'Continue')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main header (56px) with glassmorphic scroll transition ── */}
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200/70 shadow-sm text-navy-900'
            : 'bg-white/95 backdrop-blur-md border-b border-navy-100 text-navy-900 shadow-2xs'
        )}
      >
        <div className="container-wide">
          <div className="flex h-[56px] items-center justify-between gap-3">
            {/* Logo */}
            <Logo to="/" size={140} className="shrink-0 transition-transform duration-200 hover:scale-105" />

            {/* Desktop / tablet nav — centered, compact on lg, spacious on xl */}
            <nav
              ref={desktopNavRef}
              className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap lg:flex xl:gap-1"
              aria-label={t('common.mainNavigation', 'Main navigation')}
            >
              <Link
                to="/"
                className={cn(
                  'nav-link flex items-center justify-center rounded-xl p-2 transition-colors lg:px-2.5 xl:px-4',
                  isRouteActive('/', location.pathname) ? 'bg-[#D8232A]/5 text-[#D8232A]' : 'text-navy-700 hover:bg-navy-50 hover:text-[#D8232A]'
                )}
                aria-label="Home"
                title={t('common.home', 'Home')}
              >
                <Home className="h-[18px] w-[18px]" />
              </Link>
              {dynamicNavLinks.map((item) => {
                const configKey = item.key || item.label;
                const config = megaMenuConfig[configKey];
                const isActive = isRouteActive(item.to, location.pathname);

                if (config) {
                  const isOpen = hoveredMenu === configKey;
                  return (
                    <div
                      key={item.label}
                      className="relative"
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoveredMenu(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setHoveredMenu(null);
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          // Always open (never toggle-close) on the trigger's own click — a
                          // fast double-click previously closed the menu right after opening
                          // it (click 1 opens, click 2 re-toggles closed). Closing already
                          // works via outside-click, Escape, and switching to another item.
                          setHoveredMenu(configKey);
                        }}
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        className={cn(
                          'nav-link flex items-center gap-1 rounded-xl py-2 text-[13px] font-medium transition-all duration-200 lg:px-2.5 xl:px-4',
                          isOpen || isActive
                            ? 'bg-[#D8232A]/5 text-[#D8232A]'
                            : 'text-navy-700 hover:bg-navy-50 hover:text-[#D8232A]',
                        )}
                      >
                        {item.label}
                        <ChevronDown
                          className={cn('h-4 w-4 text-navy-400 transition-transform duration-200', isOpen && 'rotate-180 text-[#D8232A]')}
                        />
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            role="menu"
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute left-0 top-full z-50 pt-2"
                          >
                            <div className="w-[min(680px,90vw)] rounded-2xl border border-navy-100 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
                              {/* Header Title & Badge */}
                              <div className="mb-4 flex items-center justify-between border-b border-navy-100 pb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-display text-base font-bold text-navy-900">{config.title}</span>
                                  <span className="rounded-full bg-[#D8232A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#D8232A]">
                                    {config.badge}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-navy-400">
                                  {t('menu.exploreCurated', 'Explore curated categories')}
                                </span>
                              </div>

                              {/* Columns Grid */}
                              <div className={cn('grid gap-6', config.columns.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                                {config.columns.map((col) => (
                                  <div key={col.title} className="space-y-3">
                                    <p className="border-b border-navy-50 pb-1 text-[11px] font-bold uppercase tracking-wider text-navy-400">
                                      {col.title}
                                    </p>
                                    <ul className="space-y-2">
                                      {col.items.map((subItem) => {
                                        const ItemIcon = subItem.icon;
                                        return (
                                          <li key={subItem.label}>
                                            <Link
                                              to={subItem.to}
                                              role="menuitem"
                                              onClick={(e) => {
                                                setHoveredMenu(null);
                                                if (subItem.confirmMessage) {
                                                  e.preventDefault();
                                                  setPendingHandoff({ to: subItem.to, message: subItem.confirmMessage });
                                                }
                                              }}
                                              className="group flex items-start gap-3 rounded-xl p-2 transition-all hover:bg-[#D8232A]/5"
                                            >
                                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600 transition-colors group-hover:bg-[#D8232A] group-hover:text-white">
                                                <ItemIcon className="h-4 w-4" />
                                              </div>
                                              <div>
                                                <p className="text-xs font-semibold text-navy-900 group-hover:text-[#D8232A]">
                                                  {subItem.label}
                                                </p>
                                                <p className="text-[11px] text-navy-500 line-clamp-1">{subItem.desc}</p>
                                              </div>
                                            </Link>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      'nav-link rounded-xl py-2 text-[13px] font-medium transition-colors lg:px-2.5 xl:px-4',
                      isActive ? 'bg-[#D8232A]/5 text-[#D8232A]' : 'text-navy-700 hover:bg-navy-50 hover:text-[#D8232A]',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Services — glassmorphism flyout, not a full mega menu */}
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoveredMenu(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setHoveredMenu(null);
                }}
              >
                <button
                  type="button"
                  onClick={() => setHoveredMenu('Services')}
                  aria-haspopup="true"
                  aria-expanded={hoveredMenu === 'Services'}
                  className={cn(
                    'nav-link flex items-center gap-1 rounded-xl py-2 text-[13px] font-medium transition-all duration-200 lg:px-2.5 xl:px-4',
                    hoveredMenu === 'Services'
                      ? 'bg-[#D8232A]/5 text-[#D8232A]'
                      : 'text-navy-700 hover:bg-navy-50 hover:text-[#D8232A]',
                  )}
                >
                  {t('common.services', 'Services')}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-navy-400 transition-transform duration-200',
                      hoveredMenu === 'Services' && 'rotate-180 text-[#D8232A]',
                    )}
                  />
                </button>

                <AnimatePresence>
                  {hoveredMenu === 'Services' && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
                    >
                      <div className="grid w-[min(420px,90vw)] grid-cols-2 gap-1 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-2xl backdrop-blur-xl">
                        {servicesMenu.map((svc) => {
                          const SvcIcon = svc.icon;
                          const external = /^https?:\/\//.test(svc.to);
                          const content = (
                            <>
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600 transition-colors group-hover:bg-[#D8232A] group-hover:text-white">
                                <SvcIcon className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-semibold text-navy-800 group-hover:text-[#D8232A]">{svc.label}</span>
                            </>
                          );
                          return external ? (
                            <a
                              key={svc.label}
                              href={svc.to}
                              target="_blank"
                              rel="noopener noreferrer"
                              role="menuitem"
                              onClick={() => setHoveredMenu(null)}
                              className="group flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white"
                            >
                              {content}
                            </a>
                          ) : (
                            <Link
                              key={svc.label}
                              to={svc.to}
                              role="menuitem"
                              onClick={(e) => {
                                setHoveredMenu(null);
                                if (svc.confirmMessage) {
                                  e.preventDefault();
                                  setPendingHandoff({ to: svc.to, message: svc.confirmMessage });
                                }
                              }}
                              className="group flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white"
                            >
                              {content}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* AI Assistant */}
              <Link
                to="/ai-hub"
                className={cn(
                  'nav-link flex items-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition-colors lg:px-2.5 xl:px-4',
                  isRouteActive('/ai-hub', location.pathname)
                    ? 'bg-[#D8232A]/5 text-[#D8232A]'
                    : 'text-navy-700 hover:bg-navy-50 hover:text-[#D8232A]',
                )}
              >
                <Bot className="h-4 w-4" />
                {t('common.aiAssistant', 'AI Assistant')}
                <span className="rounded-full bg-gradient-to-r from-[#D8232A] to-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  {t('common.aiBadge', 'AI')}
                </span>
              </Link>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search toggle — opens overlay, only navigates once a query is submitted */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="icon-btn flex items-center justify-center rounded-full"
                aria-label={t('search.placeholder', 'Search properties')}
              >
                <Search className="h-[18px] w-[18px]" />
              </button>

              {/* Post Property — primary CTA */}
              <PostPropertyLink to="/portal/list-property" className="hidden sm:block">
                <button
                  type="button"
                  className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e5262d] to-[#c01e24] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-sm shadow-[#D8232A]/20 ring-1 ring-inset ring-white/15 transition-all duration-200 hover:shadow-md hover:shadow-[#D8232A]/30 hover:brightness-110 active:scale-95"
                >
                  <span>{t('forms.postProperty', 'Post Property')}</span>
                  <span className="rounded-full bg-white/95 px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wider text-[#c01e24] transition-colors group-hover:bg-amber-300 group-hover:text-slate-950">
                    FREE
                  </span>
                </button>
              </PostPropertyLink>

              {/* Login / Profile */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenu(true)}
                  aria-haspopup="true"
                  aria-expanded={userMenu}
                  className="group relative flex items-center justify-center rounded-full p-0.5 shadow-md shadow-[#D8232A]/20 transition-all duration-300 hover:scale-105 hover:shadow-[#D8232A]/40 active:scale-95"
                  style={{ background: 'linear-gradient(90deg,#D8232A,#f43f5e,#f59e0b)' }}
                  title={t('common.accountOptions', 'Account & User Options')}
                >
                  <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white text-navy-900 shadow-inner">
                    {user ? (
                      <Avatar
                        name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || (user.email ?? 'U')}
                        src={profile?.avatar_url}
                        size={30}
                      />
                    ) : (
                      <User className="h-4 w-4 text-[#D8232A] transition-transform group-hover:scale-110" />
                    )}
                  </div>
                </button>

                {/* Dropdown Menu under Animated User Icon */}
                <AnimatePresence>
                  {userMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-full z-50 mt-2.5 w-60 rounded-2xl border border-navy-100 bg-white/95 p-2 text-left shadow-2xl backdrop-blur-xl"
                    >
                      {user ? (
                        <>
                          <div className="mb-1 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                            <p className="text-xs font-bold leading-tight text-navy-900">
                              {profile?.first_name
                                ? `${profile.first_name} ${profile.last_name ?? ''}`
                                : t('common.userAccount', 'User Account')}
                            </p>
                            <p className="truncate text-[11px] font-medium text-navy-500">{user.email}</p>
                          </div>
                          <div className="my-1 h-px bg-navy-100" />
                          <Link
                            to={dashboardLink}
                            onClick={() => setUserMenu(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-navy-800 transition hover:bg-[#D8232A]/5 hover:text-[#D8232A]"
                          >
                            <LayoutDashboard className="h-4 w-4 text-[#D8232A]" /> {t('common.dashboard', 'Dashboard')}
                          </Link>
                          <Link
                            to="/portal/saved"
                            onClick={() => setUserMenu(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-navy-800 transition hover:bg-[#D8232A]/5 hover:text-[#D8232A]"
                          >
                            <Heart className="h-4 w-4 text-[#D8232A]" /> {t('common.saved', 'Saved Properties')}
                          </Link>
                          <Link
                            to="/portal/settings"
                            onClick={() => setUserMenu(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-navy-800 transition hover:bg-[#D8232A]/5 hover:text-[#D8232A]"
                          >
                            <User className="h-4 w-4 text-[#D8232A]" /> {t('common.edit', 'Settings')}
                          </Link>
                          <div className="my-1 h-px bg-navy-100" />
                          <button
                            onClick={() => {
                              signOut();
                              navigate('/');
                              setUserMenu(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#D8232A] transition hover:bg-[#D8232A]/5"
                          >
                            <LogOut className="h-4 w-4" /> {t('common.logout', 'Sign out')}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="mb-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                            <p className="text-xs font-extrabold text-navy-900">
                              {t('common.welcomeHeader', 'Welcome to RealtyNow')}
                            </p>
                            <p className="mt-0.5 text-[10px] text-navy-500">
                              {t('common.welcomeSub', 'Sign in to access your properties & saved listings')}
                            </p>
                          </div>

                          <Link
                            to="/login"
                            onClick={() => setUserMenu(false)}
                            className="my-1 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#D8232A]/20 transition-all hover:scale-[1.02] active:scale-95"
                            style={{ background: 'linear-gradient(90deg,#D8232A,#f43f5e)' }}
                          >
                            <div className="flex items-center gap-2">
                              <LogIn className="h-4 w-4" />
                              <span>{t('common.login', 'Sign In')}</span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="icon-btn rounded-full lg:hidden"
                aria-label={mobileOpen ? t('common.closeMenu', 'Close menu') : t('common.openMenu', 'Open menu')}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile menu drawer (hamburger + accordion) ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-navy-100 bg-white lg:hidden"
            >
              <div className="container-wide max-h-[calc(100dvh-4rem)] space-y-1 overflow-y-auto py-4 pb-safe">
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center justify-between py-3 text-sm font-semibold text-navy-800 border-b border-navy-50 hover:text-[#D8232A]"
                  aria-label="Home"
                  title={t('common.home', 'Home')}
                >
                  <Home className="h-5 w-5" />
                </Link>
                {dynamicNavLinks.map((item) => {
                  const configKey = item.key || item.label;
                  const config = megaMenuConfig[configKey];
                  if (config) {
                    const isOpen = mobileAccordion === configKey;
                    return (
                      <div key={item.label} className="border-b border-navy-50">
                        <button
                          type="button"
                          onClick={() => setMobileAccordion((v) => (v === configKey ? null : configKey))}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between py-3 text-sm font-semibold text-navy-800"
                        >
                          {item.label}
                          <ChevronDown className={cn('h-4 w-4 text-navy-400 transition-transform', isOpen && 'rotate-180 text-[#D8232A]')} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-3 pb-3 pl-1">
                                {config.columns.map((col) => (
                                  <div key={col.title}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400">{col.title}</p>
                                    <div className="mt-1 space-y-0.5">
                                      {col.items.map((subItem) => (
                                        <Link
                                          key={subItem.label}
                                          to={subItem.to}
                                          onClick={(e) => {
                                            if (subItem.confirmMessage) {
                                              e.preventDefault();
                                              setPendingHandoff({ to: subItem.to, message: subItem.confirmMessage });
                                            }
                                            setMobileOpen(false);
                                          }}
                                          className="block py-1.5 text-sm text-navy-600 hover:text-[#D8232A]"
                                        >
                                          {subItem.label}
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="block border-b border-navy-50 py-3 text-sm font-semibold text-navy-800 hover:text-[#D8232A]"
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* Services accordion */}
                <div className="border-b border-navy-50">
                  <button
                    type="button"
                    onClick={() => setMobileAccordion((v) => (v === 'Services' ? null : 'Services'))}
                    aria-expanded={mobileAccordion === 'Services'}
                    className="flex w-full items-center justify-between py-3 text-sm font-semibold text-navy-800"
                  >
                    {t('common.services', 'Services')}
                    <ChevronDown
                      className={cn('h-4 w-4 text-navy-400 transition-transform', mobileAccordion === 'Services' && 'rotate-180 text-[#D8232A]')}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileAccordion === 'Services' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-1 pb-3 pl-1">
                          {servicesMenu.map((svc) => {
                            const SvcIcon = svc.icon;
                            const external = /^https?:\/\//.test(svc.to);
                            return external ? (
                              <a
                                key={svc.label}
                                href={svc.to}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2 py-1.5 text-xs font-medium text-navy-600 hover:text-[#D8232A]"
                              >
                                <SvcIcon className="h-3.5 w-3.5 shrink-0" /> {svc.label}
                              </a>
                            ) : (
                              <Link
                                key={svc.label}
                                to={svc.to}
                                onClick={(e) => {
                                  if (svc.confirmMessage) {
                                    e.preventDefault();
                                    setPendingHandoff({ to: svc.to, message: svc.confirmMessage });
                                  }
                                  setMobileOpen(false);
                                }}
                                className="flex items-center gap-2 py-1.5 text-xs font-medium text-navy-600 hover:text-[#D8232A]"
                              >
                                <SvcIcon className="h-3.5 w-3.5 shrink-0" /> {svc.label}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* AI Assistant */}
                <Link
                  to="/ai-hub"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 border-b border-navy-50 py-3 text-sm font-semibold text-navy-800 hover:text-[#D8232A]"
                >
                  <Bot className="h-4 w-4" /> {t('common.aiAssistant', 'AI Assistant')}
                </Link>

                <div className="flex flex-col gap-2 pt-3">
                  {!user && (
                    <>
                      <Link to="/login" className="btn-outline-red w-full text-center">
                        {t('common.login', 'Sign In')}
                      </Link>
                    </>
                  )}
                  <PostPropertyLink to="/portal/list-property"
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md"
                    style={{ background: 'linear-gradient(90deg,#D8232A,#f43f5e)' }}
                  >
                    <span>{t('forms.postProperty', 'Post Property')}</span>
                    <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950">FREE</span>
                  </PostPropertyLink>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1">{children}</main>

            {/* ── Footer ── */}
      <footer className="relative overflow-hidden bg-slate-950 text-white border-t border-white/5">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-red-900/10 blur-[120px]"></div>
          <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[100px]"></div>
        </div>

        {/* Huge Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center items-center opacity-[0.02] pointer-events-none z-0 overflow-hidden">
          <h1 className="font-display text-[15vw] font-black tracking-tighter whitespace-nowrap leading-none select-none">
            REALTYNOW
          </h1>
        </div>

        <div className="container-wide py-16 sm:py-24 relative z-10">
          {/* Top CTA Row */}
          <div className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 mb-16 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
              <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">Ready to list your property?</h3>
              <p className="text-white/60 max-w-md text-sm md:text-base">Join thousands of property owners who trust India's leading AI-powered real estate platform.</p>
            </div>
            <PostPropertyLink to="/portal/list-property"
              className="relative z-10 flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all hover:scale-105"
            >
              Post Property FREE
              <ArrowRight className="h-4 w-4" />
            </PostPropertyLink>
          </div>

          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12">
            {/* Column 1 - Brand */}
            <div className="lg:col-span-4 pr-0 lg:pr-8">
              <LogoLight to="/" size={165} src="/2.png" />
              <p className="mt-6 text-sm leading-relaxed text-white/60 font-light">
                {t(
                  'footer.tagline',
                  "India's AI-powered real estate marketplace. Find, compare, and buy properties with intelligent recommendations, price predictions, and verified listings.",
                )}
              </p>
              
              <div className="mt-8 space-y-3 text-sm text-white/70">
                <div className="flex items-start gap-3 group">
                  <div className="mt-1 h-6 w-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <MapPin className="h-3 w-3 text-red-500" />
                  </div>
                  <span className="flex-1">#19, Road No. 2B, Chandrapuri Colony, LB Nagar, Hyderabad 500074, Telangana</span>
                </div>
                <div className="flex items-center gap-3 group">
                  <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <Phone className="h-3 w-3 text-red-500" />
                  </div>
                  <a href="tel:+919494230774" className="hover:text-white transition-colors">
                    +91 94942 30774
                  </a>
                </div>
                <div className="flex items-center gap-3 group">
                  <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <Mail className="h-3 w-3 text-red-500" />
                  </div>
                  <a href="mailto:info@realtynow.in" className="hover:text-white transition-colors">
                    info@realtynow.in
                  </a>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="lg:col-span-2 lg:col-start-6">
              <h4 className="font-display text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                {t('footer.popularSearches', 'Popular Searches')}
              </h4>
              <ul className="mt-6 space-y-4 text-sm text-white/50">
                {[
                  { label: t('footer.flatsForSale', 'Flats for Sale'), path: '/search?purpose=Sale' },
                  { label: t('footer.flatsForRent', 'Flats for Rent'), path: '/search?purpose=Rent' },
                  { label: t('footer.luxuryVillas', 'Luxury Villas'), path: '/search?type=Villa' },
                  { label: t('footer.commercialProps', 'Commercial Properties'), path: '/commercial' },
                  { label: t('footer.plotsLand', 'Plots & Land'), path: '/search?type=Plots' },
                ].map((link, idx) => (
                  <li key={idx}>
                    <Link
                      to={link.path}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="group flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <span className="h-px w-0 bg-red-500 transition-all duration-300 group-hover:w-3"></span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3 */}
            <div className="lg:col-span-3">
              <h4 className="font-display text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                {t('footer.topCities', 'Top Cities')}
              </h4>
              <ul className="mt-6 space-y-4 text-sm text-white/50">
                {[
                  { label: t('footer.propsJubileeHills', 'Properties in Jubilee Hills'), path: '/search?city=Hyderabad&locality=Jubilee+Hills' },
                  { label: t('footer.propsBanjaraHills', 'Properties in Banjara Hills'), path: '/search?city=Hyderabad&locality=Banjara+Hills' },
                  { label: t('footer.propsHitecCity', 'Properties in HITEC City'), path: '/search?city=Hyderabad&locality=HITEC+City' },
                  { label: t('footer.propsGachibowli', 'Properties in Gachibowli'), path: '/search?city=Hyderabad&locality=Gachibowli' },
                  { label: t('footer.propsKondapur', 'Properties in Kondapur'), path: '/search?city=Hyderabad&locality=Kondapur' },
                ].map((link, idx) => (
                  <li key={idx}>
                    <Link
                      to={link.path}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="group flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <span className="h-px w-0 bg-red-500 transition-all duration-300 group-hover:w-3"></span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4 - Company & Legal Policies */}
            <div className="lg:col-span-2">
              <h4 className="font-display text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                {t('footer.legalPolicies', 'Company & Legal')}
              </h4>
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-white/50">
                {[
                  { label: t('common.aboutUs', 'About Us'), path: '/about-us' },
                  { label: t('common.contactUs', 'Contact Us'), path: '/contact' },
                  { label: t('footer.privacy', 'Privacy Policy'), path: '/privacy' },
                  { label: t('footer.terms', 'Terms & Conditions'), path: '/terms' },
                  { label: t('footer.refundPolicy', 'Refund & Cancellation Policy'), path: '/refund-policy' },
                  { label: t('footer.listingPolicy', 'Property Listing Policy'), path: '/listing-policy' },
                  { label: t('footer.userAgreement', 'User Agreement'), path: '/user-agreement' },
                  { label: t('footer.cookiePolicy', 'Cookie Policy'), path: '/cookie-policy' },
                  { label: t('footer.securityStatement', 'Security Statement'), path: '/security-statement' },
                ].map((link, idx) => (
                  <li key={idx}>
                    <Link to={link.path} className="group flex items-center gap-2 hover:text-white transition-colors">
                      <span className="h-px w-0 bg-red-500 transition-all duration-300 group-hover:w-3"></span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-white/10 bg-black/20 backdrop-blur-sm relative z-10">
          <div className="container-wide py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40 font-light">
            <div className="flex flex-col gap-2">
              <p>
                &copy; {new Date().getFullYear()} Realtynow Properties Private limited. {t('footer.rightsReserved', 'All rights reserved.')}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <span>•</span>
                <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
                <span>•</span>
                <Link to="/refund-policy" className="hover:text-white transition-colors">Refund & Cancellation</Link>
                <span>•</span>
                <Link to="/listing-policy" className="hover:text-white transition-colors">Listing Policy</Link>
                <span>•</span>
                <Link to="/user-agreement" className="hover:text-white transition-colors">User Agreement</Link>
                <span>•</span>
                <Link to="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
                <span>•</span>
                <Link to="/security-statement" className="hover:text-white transition-colors">Security Statement</Link>
              </div>
            </div>
            
            <div className="flex gap-4 items-center">
              {[
                { Icon: Facebook, href: '#' },
                { Icon: XTwitterIcon, href: '#' },
                { Icon: Instagram, href: '#' },
                { Icon: Linkedin, href: '#' },
                { Icon: Youtube, href: '#' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="text-white/40 hover:text-red-500 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            <p className="flex items-center gap-1.5">{t('footer.madeWithLove', 'Made with')} <span className="text-red-500">❤️</span> for Indian Real Estate</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
