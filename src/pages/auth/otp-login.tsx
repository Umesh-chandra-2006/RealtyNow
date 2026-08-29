import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  Briefcase,
  HardHat,
  Handshake,
  Star,
  Sparkles,
  Users,
  Loader2,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { useToast } from '../../components/toast';
import { Input } from '../../components/ui';
import { Logo, LogoLight } from '../../components/logo';
import { cn } from '../../lib/utils';
import { initMsg91Widget, sendMsg91Otp, verifyMsg91Otp, retryMsg91Otp, MSG91_CAPTCHA_CONTAINER_ID } from '../../lib/msg91';
import { formatIndianMobileForDisplay } from '../../lib/phone';

const OTP_LENGTH = 4;
const OTP_EXPIRY_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 10;
const PRIMARY_RED = '#D8232A';

type LoginTab = 'customer' | 'agent' | 'builder' | 'partner';

// Each segment now maps 1:1 onto its own login intent — Agent and Builder no
// longer share a single 'agent' bucket, and Partner is a 4th standalone tab.
type Segment = 'buyer_owner' | 'agent' | 'builder' | 'partner';
const SEGMENTS: { id: Segment; label: string; tab: LoginTab; icon: typeof Search }[] = [
  { id: 'buyer_owner', label: 'Buyer/Owner', tab: 'customer', icon: Search },
  { id: 'agent', label: 'Agent', tab: 'agent', icon: Briefcase },
  { id: 'builder', label: 'Builder', tab: 'builder', icon: HardHat },
  { id: 'partner', label: 'Partner with us', tab: 'partner', icon: Handshake },
];

// Fixed (not random-per-render) positions/timings for the left panel's floating particles —
// deterministic so the animation doesn't jump on re-renders.
const PARTICLES = [
  { x: 8, y: 18, duration: 6, delay: 0 },
  { x: 22, y: 62, duration: 7.5, delay: 0.6 },
  { x: 38, y: 30, duration: 5.5, delay: 1.2 },
  { x: 55, y: 75, duration: 8, delay: 0.3 },
  { x: 68, y: 22, duration: 6.5, delay: 1.8 },
  { x: 80, y: 55, duration: 7, delay: 0.9 },
  { x: 90, y: 15, duration: 6.8, delay: 1.5 },
  { x: 15, y: 85, duration: 7.2, delay: 2.1 },
  { x: 48, y: 12, duration: 5.8, delay: 0.4 },
  { x: 72, y: 88, duration: 6.3, delay: 1.1 },
];

const mobileSchema = z
  .string()
  .trim()
  .refine((v) => /^(\+91)?[6-9]\d{9}$/.test(v.replace(/\s/g, '')), 'Enter a valid 10-digit Indian mobile number');

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Role destinations mirror the existing ternary in App.tsx / public-layout.tsx. */
function dashboardHomeForRole(role: string | null | undefined): string {
  if (role === 'admin' || role === 'super_admin') return '/admin';
  if (role === 'agent') return '/agent';
  if (role === 'builder') return '/builder';
  if (role === 'partner') return '/partner';
  return '/portal';
}

function tabLabel(tab: LoginTab): string {
  if (tab === 'agent') return 'Agent';
  if (tab === 'builder') return 'Builder';
  if (tab === 'partner') return 'Partner';
  return 'account';
}

/** Maps an otp-auth `code` to a professional, specific status message (see otp-auth's verify action). */
function statusMessageFor(code: string, tab: LoginTab, actualRole?: string | null): { title: string; message: string } {
  switch (code) {
    case 'PENDING_REVIEW':
      return {
        title: 'Application under review',
        message: `Your ${tabLabel(tab)} application is still under review. Please wait for admin approval.`,
      };
    case 'REJECTED':
      return {
        title: 'Application not approved',
        message: 'Your application was not approved. Please contact RealtyNow support for more information.',
      };
    case 'ACCOUNT_SUSPENDED':
      return {
        title: 'Account suspended',
        message: 'Your account has been suspended. Please contact RealtyNow support.',
      };
    case 'ROLE_MISMATCH':
      return {
        title: 'Different account type',
        message: actualRole
          ? `This mobile number is registered as ${tabLabel(actualRole as LoginTab)}. Please use the correct tab to sign in.`
          : 'This mobile number is registered under a different account type.',
      };
    case 'NOT_FOUND':
      return tab === 'partner'
        ? { title: 'No application found', message: 'No partner application was found for this mobile number. Please register as a partner first.' }
        : { title: 'Account not found', message: 'Your account has not been created yet. Please contact the administrator.' };
    default:
      return { title: 'Sign-in failed', message: 'Something went wrong. Please try again.' };
  }
}

function segmentForRole(role: string): Segment {
  return SEGMENTS.find((s) => s.tab === role)?.id ?? 'buyer_owner';
}

function StatusPanel({
  code,
  tab,
  actualRole,
  onSwitchToRole,
}: {
  code: string;
  tab: LoginTab;
  actualRole: string | null;
  onSwitchToRole: (role: string) => void;
}) {
  const { title, message } = statusMessageFor(code, tab, actualRole);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-navy-100 bg-navy-50/70 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-navy-900">{title}</p>
          <p className="mt-1 text-sm text-navy-500">{message}</p>
        </div>
      </div>
      {code === 'NOT_FOUND' && tab === 'partner' && (
        <Link
          to="/partner/register"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline"
        >
          Register as a Partner <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
      {code === 'ROLE_MISMATCH' && actualRole && (
        <button
          type="button"
          onClick={() => onSwitchToRole(actualRole)}
          className="mt-4 text-sm font-semibold text-red-600 hover:underline"
        >
          Switch to the {actualRole === 'customer' ? 'Buyer/Owner' : tabLabel(actualRole as LoginTab)} tab
        </button>
      )}
    </motion.div>
  );
}

export function OtpLoginPage() {
  const { t } = useLanguageContext();
  const { verifyOtpAndSignIn, requestAgentAccess, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addToast } = useToast();

  // /admin/login sends unauthenticated visitors here via
  // `/login?redirect=/admin/login?redirect=...` so this page can hand them
  // back once OTP succeeds. Admin isn't a self-serve tab (no public signup),
  // and the underlying OTP verify already resolves the real role from the
  // DB regardless of which tab is "selected" — the 'customer' intent path
  // used below never rejects an existing admin profile (see otp-auth's
  // verify action: the professional-intent role check only applies to
  // agent/builder/partner). So functionally nothing about the OTP flow
  // needs to change for an admin — only the visual context, so the user
  // isn't shown "Buyer/Owner" as though they chose it.
  const redirectParam = params.get('redirect');
  const isAdminContext = !!redirectParam && redirectParam.startsWith('/admin');

  const [tab, setTab] = useState<LoginTab>('customer');
  const [segment, setSegment] = useState<Segment>('buyer_owner');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [mobileFocused, setMobileFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [reqId, setReqId] = useState<string | undefined>(undefined);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Set once the verified accessToken comes back with a non-generic status
  // code (NOT_FOUND, PENDING_REVIEW, REJECTED, ROLE_MISMATCH,
  // ACCOUNT_SUSPENDED) instead of a session — see otp-auth's verify action.
  const [requestId, setRequestId] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<string | null>(null);
  const [statusActualRole, setStatusActualRole] = useState<string | null>(null);
  const [requestName, setRequestName] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Partner tab shows an intro/choice screen (Register vs. Sign in) before
  // the mobile-number form — flipped to true once "Sign in with Mobile" is
  // clicked.
  const [partnerShowSignIn, setPartnerShowSignIn] = useState(false);

  useEffect(() => {
    if (step !== 'mobile') return;
    initMsg91Widget().catch((err) => {
      console.error('[MSG91] pre-init failed', err);
    });
  }, [step, tab]);

  useEffect(() => {
    if (step !== 'otp') return;
    setExpirySeconds(OTP_EXPIRY_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setExpirySeconds((s) => Math.max(0, s - 1));
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    // Redirect away if the user completes login while already on this page.
    if (profile) navigate(params.get('redirect') ?? dashboardHomeForRole(profile.role), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const selectTab = useCallback((next: LoginTab) => {
    setTab(next);
    setStep('mobile');
    setMobile('');
    setMobileError(null);
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError(null);
    setStatusCode(null);
    setStatusActualRole(null);
    setRequestId(null);
    setRequestName('');
    setRequestSubmitted(false);
    setPartnerShowSignIn(false);
  }, []);

  const selectSegment = useCallback(
    (seg: Segment) => {
      setSegment(seg);
      selectTab(SEGMENTS.find((s) => s.id === seg)!.tab);
    },
    [selectTab],
  );

  const sendOtp = useCallback(async () => {
    if (sending) return;
    const parsed = mobileSchema.safeParse(mobile);
    if (!parsed.success) {
      setMobileError(parsed.error.issues[0]?.message ?? 'Enter a valid mobile number');
      return;
    }
    setMobileError(null);
    setSending(true);
    try {
      if (isAdminContext) {
        const { checkAdminMobile } = await import('../../lib/admin-security');
        const authorized = await checkAdminMobile(mobile);
        if (!authorized) {
          setMobileError('This mobile number is not registered as an administrator.');
          setSending(false);
          return;
        }
      }
      const id = await sendMsg91Otp(formatIndianMobileForDisplay(mobile));
      setReqId(id);
      setOtp(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
      setStatusCode(null);
      setStatusActualRole(null);
      setRequestSubmitted(false);
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  }, [mobile, addToast, isAdminContext, sending]);

  const resendOtp = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await retryMsg91Otp(reqId);
      setOtp(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      addToast('success', 'OTP resent');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not resend OTP');
    } finally {
      setResending(false);
    }
  }, [reqId, resendCooldown, resending, addToast]);

  const submitOtp = useCallback(
    async (code: string) => {
      if (code.length !== OTP_LENGTH || expirySeconds <= 0) return;
      setVerifying(true);
      setOtpError(null);
      setStatusCode(null);
      setStatusActualRole(null);
      try {
        const accessToken = await verifyMsg91Otp(code, reqId);
        const { error, isNewUser, code: errCode, requestId: newRequestId, actualRole } = await verifyOtpAndSignIn(accessToken, tab);
        if (error) {
          if (errCode) {
            if (newRequestId) setRequestId(newRequestId);
            setStatusActualRole(actualRole ?? null);
            setStatusCode(errCode);
          } else {
            setOtpError(error);
          }
          return;
        }
        addToast('success', isNewUser ? 'Account created!' : 'Welcome back!');
        // Best-effort — a no-op (silently caught) for any non-admin caller;
        // logs this OTP sign-in into admin_login_logs when it is an admin,
        // so admin-security's audit trail includes the first factor too.
        void import('../../lib/admin-security').then(({ logAdminOtpLogin }) => logAdminOtpLogin());
        // Actual navigation happens in the profile-watching effect above,
        // once the profile finishes loading.
      } catch (err) {
        setOtpError(err instanceof Error ? err.message : 'Invalid or expired OTP');
      } finally {
        setVerifying(false);
      }
    },
    [expirySeconds, reqId, tab, verifyOtpAndSignIn, addToast],
  );

  const submitAgentRequest = useCallback(async () => {
    if (!requestId || !requestName.trim()) return;
    setRequestSubmitting(true);
    try {
      const { error } = await requestAgentAccess(requestId, requestName.trim(), segment);
      if (error) {
        addToast('error', error);
        return;
      }
      setRequestSubmitted(true);
    } finally {
      setRequestSubmitting(false);
    }
  }, [requestId, requestName, requestAgentAccess, addToast, segment]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^\d]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    const joined = next.join('');
    if (joined.length === OTP_LENGTH) submitOtp(joined);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/[^\d]/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => (next[i] = d));
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) submitOtp(pasted);
  };

  const primaryBtnClass =
    'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 bg-[length:200%_100%] py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all duration-300 hover:bg-[position:100%_0] hover:shadow-xl hover:shadow-red-600/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-navy-950 lg:grid" style={{ gridTemplateColumns: '38% 62%' }}>
      {/* ───────────── Left — cinematic panel ───────────── */}
      <div className="relative hidden overflow-hidden lg:block">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, ease: 'easeOut' }}
        >
          <img
            src="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg"
            alt=""
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Cinematic dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/70 via-transparent to-navy-950/50" />

        {/* Animated glow */}
        <motion.div
          className="pointer-events-none absolute -left-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-red-600/30 blur-[120px]"
          animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.12, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-gold-400/20 blur-[100px]"
          animate={{ opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0">
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/50"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              animate={{ y: [0, -18, 0], opacity: [0.15, 0.8, 0.15] }}
              transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <LogoLight to="/" size={200} src="/2.png" />

          <div className="max-w-md">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold-400" /> AI-Powered Real Estate
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-4 font-display text-4xl font-bold leading-[1.15] tracking-tight"
            >
              {t('auth.welcomeBack', 'Find Your Perfect')}{' '}
              <span className="bg-gradient-to-r from-red-400 to-gold-400 bg-clip-text text-transparent">
                Place to Call Home
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-3 text-sm leading-relaxed text-navy-200"
            >
              {t('auth.otpSub', 'Sign in instantly with your mobile number — no password needed.')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {[
                { icon: ShieldCheck, label: t('auth.feat2', 'Verified listings & trusted agents') },
                { icon: Sparkles, label: t('auth.feat1', 'AI-powered property recommendations') },
                { icon: Users, label: t('auth.feat3', 'Real-time notifications') },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-navy-100 backdrop-blur-md"
                >
                  <Icon className="h-3.5 w-3.5 text-gold-400" /> {label}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-6 flex items-center gap-4 text-xs text-navy-300"
            >
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> 4.9/5 rated
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span>Verified real estate listings</span>
            </motion.div>
          </div>

          <p className="relative text-xs text-navy-400">
            &copy; {new Date().getFullYear()} Realtynow Properties Private limited.{' '}
            {t('footer.rightsReserved', 'All rights reserved.')}
          </p>
        </div>
      </div>

      {/* ───────────── Right — glass login card ───────────── */}
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-white px-4 py-8 sm:px-8 sm:py-12">
        
        {/* ── Real-estate illustration pattern layer ── */}
        {(() => false)() && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">

          {/* Soft gradient orbs */}
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-red-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl" />
          <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-rose-100/30 blur-2xl" />

          {/* ── SVG Illustration icons scattered across the panel ── */}

          {/* House — top left */}
          <svg className="absolute top-[6%] left-[4%] opacity-[0.07] rotate-[-8deg]" width="90" height="90" viewBox="0 0 64 64" fill="none">
            <path d="M4 28L32 4L60 28V60H40V42H24V60H4V28Z" fill="#D8232A" stroke="#D8232A" strokeWidth="2" strokeLinejoin="round"/>
            <rect x="26" y="42" width="12" height="18" rx="2" fill="#991b1b"/>
            <rect x="38" y="30" width="10" height="10" rx="1" fill="#fca5a5"/>
            <rect x="16" y="30" width="10" height="10" rx="1" fill="#fca5a5"/>
          </svg>

          {/* Multi-storey building — top right */}
          <svg className="absolute top-[4%] right-[6%] opacity-[0.065] rotate-[6deg]" width="70" height="100" viewBox="0 0 48 72" fill="none">
            <rect x="4" y="12" width="40" height="60" rx="2" fill="#1e3a5f" stroke="#1e3a5f" strokeWidth="1.5"/>
            <path d="M0 14L24 0L48 14" fill="#0f2a47"/>
            {[16,26,36,46,56].map((y,i) => (
              <g key={i}>
                <rect x="10" y={y-4} width="8" height="8" rx="1" fill="#93c5fd" opacity="0.6"/>
                <rect x="30" y={y-4} width="8" height="8" rx="1" fill="#93c5fd" opacity="0.6"/>
              </g>
            ))}
            <rect x="18" y="52" width="12" height="20" rx="1" fill="#60a5fa" opacity="0.5"/>
          </svg>

          {/* Location pin — center top */}
          <svg className="absolute top-[10%] left-[42%] opacity-[0.08]" width="50" height="60" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C9.373 0 4 5.373 4 12C4 20 16 40 16 40C16 40 28 20 28 12C28 5.373 22.627 0 16 0Z" fill="#D8232A"/>
            <circle cx="16" cy="12" r="5" fill="white"/>
          </svg>

          {/* House — middle left */}
          <svg className="absolute top-[35%] left-[2%] opacity-[0.055] rotate-[12deg]" width="70" height="70" viewBox="0 0 64 64" fill="none">
            <path d="M4 28L32 4L60 28V60H40V42H24V60H4V28Z" fill="#b45309" stroke="#b45309" strokeWidth="2" strokeLinejoin="round"/>
            <rect x="26" y="42" width="12" height="18" rx="2" fill="#92400e"/>
            <rect x="38" y="30" width="10" height="10" rx="1" fill="#fde68a"/>
            <rect x="16" y="30" width="10" height="10" rx="1" fill="#fde68a"/>
          </svg>

          {/* Key — right side */}
          <svg className="absolute top-[30%] right-[3%] opacity-[0.07] rotate-[-20deg]" width="80" height="80" viewBox="0 0 64 64" fill="none">
            <circle cx="22" cy="22" r="16" stroke="#D8232A" strokeWidth="4" fill="none"/>
            <circle cx="22" cy="22" r="8" fill="#D8232A" opacity="0.3"/>
            <rect x="34" y="20" width="26" height="6" rx="3" fill="#D8232A"/>
            <rect x="50" y="26" width="6" height="8" rx="2" fill="#D8232A"/>
            <rect x="42" y="26" width="6" height="6" rx="2" fill="#D8232A"/>
          </svg>

          {/* Floor plan grid — bottom left */}
          <svg className="absolute bottom-[8%] left-[3%] opacity-[0.065] rotate-[5deg]" width="100" height="80" viewBox="0 0 80 64" fill="none">
            <rect x="2" y="2" width="76" height="60" rx="3" stroke="#1e3a5f" strokeWidth="2.5" fill="none"/>
            <line x1="2" y1="32" x2="50" y2="32" stroke="#1e3a5f" strokeWidth="2"/>
            <line x1="50" y1="2" x2="50" y2="62" stroke="#1e3a5f" strokeWidth="2"/>
            <line x1="50" y1="44" x2="78" y2="44" stroke="#1e3a5f" strokeWidth="2"/>
            <rect x="6" y="6" width="20" height="22" rx="1" fill="#dbeafe" opacity="0.5"/>
            <rect x="30" y="6" width="16" height="22" rx="1" fill="#fecaca" opacity="0.5"/>
            <rect x="54" y="6" width="20" height="34" rx="1" fill="#dcfce7" opacity="0.5"/>
            <rect x="6" y="36" width="40" height="22" rx="1" fill="#fef9c3" opacity="0.4"/>
            <rect x="54" y="48" width="20" height="12" rx="1" fill="#e0e7ff" opacity="0.5"/>
          </svg>

          {/* Percentage / sale tag — bottom right */}
          <svg className="absolute bottom-[10%] right-[4%] opacity-[0.07] rotate-[10deg]" width="80" height="80" viewBox="0 0 64 64" fill="none">
            <rect x="2" y="2" width="60" height="60" rx="12" fill="#D8232A" opacity="0.15" stroke="#D8232A" strokeWidth="2"/>
            <circle cx="20" cy="20" r="8" stroke="#D8232A" strokeWidth="3" fill="none"/>
            <circle cx="44" cy="44" r="8" stroke="#D8232A" strokeWidth="3" fill="none"/>
            <line x1="14" y1="50" x2="50" y2="14" stroke="#D8232A" strokeWidth="3" strokeLinecap="round"/>
          </svg>

          {/* Small house cluster — mid right */}
          <svg className="absolute top-[58%] right-[5%] opacity-[0.06] rotate-[-5deg]" width="110" height="70" viewBox="0 0 96 56" fill="none">
            <path d="M2 26L20 4L38 26V56H2V26Z" fill="#1e3a5f"/>
            <rect x="10" y="38" width="8" height="18" rx="1" fill="#3b82f6" opacity="0.5"/>
            <rect x="22" y="32" width="8" height="8" rx="1" fill="#93c5fd" opacity="0.6"/>
            <path d="M36 30L58 8L80 30V56H36V30Z" fill="#D8232A" opacity="0.8"/>
            <rect x="48" y="40" width="10" height="16" rx="1" fill="#fca5a5" opacity="0.5"/>
            <rect x="62" y="34" width="8" height="8" rx="1" fill="#fca5a5" opacity="0.6"/>
            <path d="M70 34L88 14L96 22V56H70V34Z" fill="#b45309" opacity="0.6"/>
          </svg>

          {/* Ruler / measuring tool — top area mid */}
          <svg className="absolute top-[18%] left-[22%] opacity-[0.05] rotate-[30deg]" width="120" height="30" viewBox="0 0 100 24" fill="none">
            <rect x="0" y="6" width="100" height="12" rx="3" fill="#1e3a5f" stroke="#1e3a5f" strokeWidth="1"/>
            {[0,10,20,30,40,50,60,70,80,90,100].map((x,i) => (
              <line key={i} x1={x} y1="6" x2={x} y2={i%5===0 ? "0" : "4"} stroke="white" strokeWidth="1" opacity="0.8"/>
            ))}
          </svg>

          {/* Pin cluster — bottom center */}
          <svg className="absolute bottom-[18%] left-[38%] opacity-[0.06]" width="40" height="50" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C9.373 0 4 5.373 4 12C4 20 16 40 16 40C16 40 28 20 28 12C28 5.373 22.627 0 16 0Z" fill="#b45309"/>
            <circle cx="16" cy="12" r="5" fill="white"/>
          </svg>

          {/* City skyline silhouette — very bottom, spanning full width */}
          <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.04]" viewBox="0 0 800 120" preserveAspectRatio="none" fill="none">
            <path d="M0 120 L0 80 L40 80 L40 50 L60 50 L60 30 L80 30 L80 50 L100 50 L100 80
                     L130 80 L130 40 L145 40 L145 20 L160 20 L160 40 L175 40 L175 80
                     L200 80 L200 55 L215 55 L215 35 L225 35 L225 55 L240 55 L240 80
                     L270 80 L270 45 L285 45 L285 10 L295 10 L295 0 L305 0 L305 10 L315 10 L315 45 L330 45 L330 80
                     L360 80 L360 50 L375 50 L375 60 L390 60 L390 80
                     L420 80 L420 35 L435 35 L435 15 L445 15 L445 35 L460 35 L460 80
                     L490 80 L490 55 L505 55 L505 40 L515 40 L515 55 L530 55 L530 80
                     L555 80 L555 45 L570 45 L570 25 L582 25 L582 45 L595 45 L595 80
                     L625 80 L625 60 L640 60 L640 80
                     L665 80 L665 40 L680 40 L680 20 L692 20 L692 40 L705 40 L705 80
                     L730 80 L730 55 L745 55 L745 80
                     L770 80 L770 45 L785 45 L785 80
                     L800 80 L800 120 Z" fill="#1e3a5f"/>
          </svg>

          {/* Subtle dot grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#1e3a5f"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)"/>
          </svg>

        </div>
        )}
        {/* ── end illustration pattern ── */}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative w-full max-w-[480px] sm:max-w-lg rounded-[24px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-9 my-auto"
        >
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo to="/" size={160} src="/2.png" />
          </div>

          {step === 'mobile' && isAdminContext && (
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-red-600 shadow-sm">
                <Lock className="h-3.5 w-3.5" /> Admin Portal
              </span>
            </div>
          )}

          {step === 'mobile' && !isAdminContext && (
            <div className="relative mb-6 flex sm:grid sm:grid-cols-4 gap-1 rounded-2xl bg-navy-100/70 p-1.5 overflow-x-auto no-scrollbar snap-x">
              {SEGMENTS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectSegment(id)}
                  className="relative flex-1 min-w-[78px] sm:min-w-0 rounded-xl py-2 px-1 text-[11px] font-bold transition-colors shrink-0 snap-center"
                >
                  {segment === id && (
                    <motion.span
                      layoutId="segment-pill"
                      className="absolute inset-0 rounded-xl shadow"
                      style={{ backgroundColor: PRIMARY_RED }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex flex-col items-center gap-1 text-center whitespace-nowrap',
                      segment === id ? 'text-white' : 'text-navy-500',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[80px] sm:max-w-none">{label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'mobile' ? (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                {segment === 'partner' && !partnerShowSignIn ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="h-14 w-14 rounded-2xl bg-red-50 grid place-items-center">
                      <Handshake className="h-7 w-7 text-red-600" />
                    </div>
                    <h1 className="mt-4 font-display text-2xl font-bold text-navy-900">Partner with RealtyNow</h1>
                    <p className="mt-2 text-sm leading-relaxed text-navy-500">
                      Grow your business with RealtyNow. Join our partner network and unlock new real-estate
                      business opportunities.
                    </p>
                    <div className="mt-7 space-y-3">
                      <Link to="/partner/register" className={cn(primaryBtnClass, 'no-underline')}>
                        Register as a Partner
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPartnerShowSignIn(true)}
                        className="w-full rounded-2xl border-2 border-navy-150 bg-white py-3.5 text-sm font-bold text-navy-700 transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        Already a Partner? Sign in with Mobile
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                {segment === 'partner' && (
                  <button
                    type="button"
                    onClick={() => setPartnerShowSignIn(false)}
                    className="mb-4 flex items-center gap-1 text-sm font-semibold text-navy-500 hover:text-navy-800"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                <h1 className="font-display text-2xl font-bold text-navy-900">
                  {isAdminContext ? t('auth.administratorSignIn', 'Administrator Sign In') : t('common.login', 'Sign in')}
                </h1>
                <p className="mt-1.5 text-sm text-navy-500">
                  {isAdminContext
                    ? t('auth.adminOtpDesc', "Sign in with your registered administrator mobile number.")
                    : tab === 'agent' || tab === 'builder' || tab === 'partner'
                      ? t('auth.otpDescAgent', "Sign in with your registered mobile number.")
                      : t('auth.otpDesc', "We'll send a one-time code to verify your mobile number.")}
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendOtp();
                  }}
                  className="mt-7 space-y-5"
                >
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center gap-2.5 rounded-2xl border-2 bg-white px-4 pb-2.5 pt-5 transition-all duration-200',
                        mobileError
                          ? 'border-error-400 ring-4 ring-error-100'
                          : mobileFocused
                            ? 'border-red-400 ring-4 ring-red-400/10'
                            : 'border-navy-150',
                      )}
                    >
                      <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-navy-700">
                        <span className="text-base leading-none">🇮🇳</span> +91
                      </span>
                      <span className="h-5 w-px shrink-0 bg-navy-150" />
                      <input
                        id="mobile-input"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        onFocus={() => setMobileFocused(true)}
                        onBlur={() => setMobileFocused(false)}
                        autoFocus
                        inputMode="tel"
                        maxLength={10}
                        className="w-full bg-transparent text-sm font-semibold text-navy-900 outline-none"
                      />
                    </div>
                    <label
                      htmlFor="mobile-input"
                      className={cn(
                        'pointer-events-none absolute left-[4.9rem] transition-all duration-200',
                        mobileFocused || mobile
                          ? 'top-2 text-[10px] font-bold uppercase tracking-wide text-red-500'
                          : 'top-1/2 -translate-y-1/2 text-sm text-navy-400',
                      )}
                    >
                      {t('auth.mobileNumber', 'Mobile Number')}
                    </label>
                    {mobileError && (
                      <p className="mt-1.5 text-xs font-semibold text-error-600">{mobileError}</p>
                    )}
                  </div>

                  {/* Hidden background container for MSG91 SDK */}
                  <div id={MSG91_CAPTCHA_CONTAINER_ID} className="hidden" />

                  {/* ── Terms & Privacy Policy Consent Checkbox ── */}
                  <label
                    htmlFor="terms-checkbox"
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/60 px-3.5 py-3 transition-colors hover:bg-red-50/40 hover:border-red-200"
                  >
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        id="terms-checkbox"
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="peer sr-only"
                      />
                      {/* Custom styled checkbox */}
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200',
                          agreedToTerms
                            ? 'border-red-600 bg-red-600'
                            : 'border-navy-300 bg-white',
                        )}
                      >
                        {agreedToTerms && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] leading-relaxed text-navy-600">
                      {t('auth.termsConsent', 'I accept the')}{' '}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-red-600 underline underline-offset-2 hover:text-red-700"
                      >
                        {t('auth.privacyPolicy', 'Privacy Policy')}
                      </a>
                      {' & '}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-red-600 underline underline-offset-2 hover:text-red-700"
                      >
                        {t('auth.termsConditions', 'Terms and Conditions')}
                      </a>
                    </span>
                  </label>

                  {(() => {
                    const isSendOtpEnabled =
                      agreedToTerms &&
                      mobile.replace(/\D/g, '').length === 10 &&
                      !sending;

                    return (
                      <button
                        type="submit"
                        disabled={!isSendOtpEnabled}
                        className={cn(
                          'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-bold transition-all duration-300',
                          isSendOtpEnabled
                            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 bg-[length:200%_100%] text-white shadow-lg shadow-red-600/25 hover:bg-[position:100%_0] hover:shadow-xl hover:shadow-red-600/35 active:scale-[0.98] cursor-pointer'
                            : 'bg-navy-100 text-navy-400 cursor-not-allowed opacity-60 pointer-events-none shadow-none',
                        )}
                      >
                        {sending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> {t('auth.sendingOtp', 'Sending OTP…')}
                          </>
                        ) : (
                          <>
                            {t('auth.sendOtp', 'Send OTP')}
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>
                    );
                  })()}
                </form>

                
                <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-navy-400">
                  <Lock className="h-3 w-3" />
                  {t('auth.privacyNote', 'Protected by industry-standard encryption.')}
                </p>

                {segment === 'agent' && (
                  <div className="mt-6 text-center text-sm text-navy-600">
                    Don't have an Agent account?{' '}
                    <Link to="/agent/register" className="font-semibold text-red-600 hover:underline">
                      Register
                    </Link>
                  </div>
                )}
                {segment === 'builder' && (
                  <div className="mt-6 text-center text-sm text-navy-600">
                    Don't have a Builder account?{' '}
                    <Link to="/builder/register" className="font-semibold text-red-600 hover:underline">
                      Register
                    </Link>
                  </div>
                )}
                {segment === 'partner' && (
                  <div className="mt-6 text-center text-sm text-navy-600">
                    Not a partner yet?{' '}
                    <Link to="/partner/register" className="font-semibold text-red-600 hover:underline">
                      Register as a Partner
                    </Link>
                  </div>
                )}
                  </>
                )}

              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => {
                    setStep('mobile');
                    setStatusCode(null);
                    setStatusActualRole(null);
                    setRequestId(null);
                    setRequestName('');
                    setRequestSubmitted(false);
                  }}
                  className="mb-4 flex items-center gap-1 text-sm font-semibold text-navy-500 hover:text-navy-800"
                >
                  <ArrowLeft className="h-4 w-4" /> {t('auth.changeNumber', 'Change number')}
                </button>

                {statusCode && !(statusCode === 'NOT_FOUND' && (tab === 'agent' || tab === 'builder')) ? (
                  <StatusPanel
                    code={statusCode}
                    tab={tab}
                    actualRole={statusActualRole}
                    onSwitchToRole={(role) => selectSegment(segmentForRole(role))}
                  />
                ) : statusCode === 'NOT_FOUND' && (tab === 'agent' || tab === 'builder') ? (
                  requestSubmitted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-navy-100 bg-navy-50/70 p-5 text-center shadow-sm"
                    >
                      <ShieldCheck className="mx-auto h-8 w-8 text-success-600" />
                      <p className="mt-2 font-bold text-navy-900">Request submitted</p>
                      <p className="mt-1 text-sm text-navy-500">
                        An administrator will review your request and create your account shortly.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-navy-100 bg-navy-50/70 p-5 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-error-600">
                        Your account has not been created yet. Please contact the administrator.
                      </p>
                      <p className="mt-1 text-sm text-navy-500">
                        Or submit your name below and an admin will set up your account.
                      </p>
                      <div className="mt-4 space-y-3">
                        <Input
                          label="Full name"
                          value={requestName}
                          onChange={(e) => setRequestName(e.target.value)}
                          placeholder="Your full name"
                        />
                        <button
                          onClick={submitAgentRequest}
                          disabled={requestSubmitting || !requestName.trim()}
                          className={primaryBtnClass}
                        >
                          {requestSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Request account access'
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )
                ) : (
                  <>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.verifyOtp', 'Verify OTP')}</h1>
                    <p className="mt-1.5 text-sm text-navy-500">
                      {t('auth.otpSentTo', `Enter the ${OTP_LENGTH}-digit code sent to`)}{' '}
                      <span className="font-semibold text-navy-700">{formatIndianMobileForDisplay(mobile)}</span>
                    </p>

                    <div className="mt-7 flex justify-center gap-3">
                      {otp.map((digit, i) => (
                        <motion.input
                          key={i}
                          ref={(el) => {
                            inputRefs.current[i] = el;
                          }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste}
                          disabled={verifying || expirySeconds <= 0}
                          className={cn(
                            'h-14 w-14 rounded-2xl border-2 bg-white text-center text-2xl font-bold text-navy-900 outline-none transition-all duration-200',
                            digit
                              ? 'border-red-400 shadow-[0_0_0_4px_rgba(214,38,52,0.08)]'
                              : 'border-navy-150 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(214,38,52,0.08)]',
                            'disabled:bg-navy-50',
                          )}
                        />
                      ))}
                    </div>

                    {otpError && <p className="mt-3 text-center text-sm text-error-600">{otpError}</p>}
                    {expirySeconds <= 0 && !otpError && (
                      <p className="mt-3 text-center text-sm text-error-600">
                        {t('auth.otpExpired', 'OTP expired. Please resend.')}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className="text-navy-500">
                        {expirySeconds > 0 ? `${t('auth.expiresIn', 'Expires in')} ${formatTimer(expirySeconds)}` : null}
                      </span>
                      <button
                        onClick={resendOtp}
                        disabled={resendCooldown > 0 || resending}
                        className="flex items-center gap-1 font-semibold text-red-600 disabled:text-navy-400"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                        {resendCooldown > 0
                          ? `${t('auth.resendIn', 'Resend in')} ${resendCooldown}s`
                          : t('auth.resendOtp', 'Resend OTP')}
                      </button>
                    </div>

                    {verifying && (
                      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-navy-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('auth.verifying', 'Verifying…')}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
