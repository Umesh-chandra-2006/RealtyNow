const fs = require('fs');

const code = fs.readFileSync('src/pages/public/home.tsx', 'utf8');
const lines = code.split('\n');

const startIdx = lines.findIndex(l => l.includes('function HeroSection() {'));
let endIdx = startIdx;
while (endIdx < lines.length && !lines[endIdx].includes('function TrustSection() {')) {
  endIdx++;
}
while (endIdx > 0 && !lines[endIdx - 1].includes('=========================')) {
  endIdx--;
}
endIdx--; 

const exactOriginalCode = `/* ============================================================
   Hero Section
============================================================ */
function HeroSection() {
  const { t } = useLanguageContext();
  return (
    <section className="relative overflow-hidden bg-slate-50/60 pt-6 pb-12 lg:pt-8 lg:pb-14">
      {/* Background image & gradient mesh overlays */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-bg.png"
          alt="RealtyNow Hero Backdrop"
          className="h-full w-full object-cover object-right opacity-95"
        />
        {/* Soft sunrise and left white gradient blur */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent w-full lg:w-2/3" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-slate-50/30" />
        
        {/* Ambient radial glows */}
        <div className="absolute top-1/4 left-10 h-80 w-80 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      </div>

      <div className="container-wide relative z-10">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          
          {/* LEFT SIDE CONTENT (7 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 text-left"
          >
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50/90 px-3.5 py-1 shadow-sm backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-red-600 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">✨ AI-Powered Real Estate Platform</span>
            </div>

            {/* Main Heading - Compact, lower font size */}
            <h1 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Find Your <span className="bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">Dream Property</span> with Power of AI
            </h1>

            {/* Sub Heading - Smaller, tighter spacing */}
            <p className="mt-2.5 text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              Discover verified properties, AI price predictions, ROI insights, smart investment recommendations, and connect instantly with trusted agents.
            </p>

            {/* CTA Buttons */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/search"
                className="group rounded-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <span>Explore Properties</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
                className="group rounded-full border border-slate-200/90 bg-white/90 hover:bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2 backdrop-blur-md"
              >
                <Bot className="h-4.5 w-4.5 text-red-600 transition-transform group-hover:scale-110" />
                <span>Talk to AI Assistant</span>
              </button>
            </div>
          </motion.div>
          
          <div className="hidden lg:block lg:col-span-5 relative h-full"></div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   AI Smart Search
============================================================ */
const SEARCH_TABS = ['Buy', 'Rent', 'Commercial', 'Plots', 'Projects'] as const;

function AISmartSearch() {
  const { t } = useLanguageContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof SEARCH_TABS)[number]>('Buy');
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  const examples = [
    '3BHK under 80 Lakhs in Hyderabad',
    'Luxury Villa in Hyderabad',
    'Commercial Office Near Metro',
    'Best Investment Property under 50L',
    'Ready To Move',
    'New Projects',
  ];

  const handleVoice = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; stop: () => void; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: () => void; onend: () => void; lang: string; continuous: boolean; interimResults: boolean } }).webkitSpeechRecognition;
    if (!SR) { setQuery('Voice search not supported in this browser'); return; }
    setListening(true);
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => { setQuery(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleAISearch = async () => {
    if (!query.trim()) return;
    setAiThinking(true);
    try {
      const purpose = tab === 'Rent' ? 'Rent' : 'Sale';
      navigate(\`/search?q=\${encodeURIComponent(query)}&purpose=\${purpose}\`);
    } catch {
      navigate(\`/search?q=\${encodeURIComponent(query)}\`);
    } finally {
      setAiThinking(false);
    }
  };

  return (
    <div className="container-wide relative z-30 -mt-6 sm:-mt-8">
      <div className="relative flex items-end gap-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full max-w-4xl rounded-[2rem] border border-slate-200/90 bg-white/95 p-3 sm:p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl"
        >
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 pb-2.5 border-b border-slate-100 px-1">
            {SEARCH_TABS.map((tItem) => (
              <button
                key={tItem}
                onClick={() => setTab(tItem)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200',
                  tab === tItem
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                )}
              >
                {tItem === 'Buy' && <Home className="h-4 w-4" />}
                {tItem === 'Rent' && <KeyRound className="h-4 w-4" />}
                {tItem === 'Commercial' && <Building2 className="h-4 w-4" />}
                {tItem === 'Plots' && <LandPlot className="h-4 w-4" />}
                {tItem === 'Projects' && <Layers className="h-4 w-4" />}
                {tItem}
              </button>
            ))}
          </div>

          {/* Main Search Input & Actions */}
          <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2.5">
            <div className="relative w-full flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                placeholder={\`Search \${tab.toLowerCase()} — try "3BHK under 80L in Hyderabad"\`}
                className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 py-3.5 pl-12 pr-32 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1">
                <button
                  onClick={handleVoice}
                  className={cn('grid h-8 w-8 place-items-center rounded-xl transition-all', listening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-500 hover:bg-slate-200/60')}
                  title="Voice Search"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/search')}
                  className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition-all hover:bg-slate-200/60"
                  title="Image Search"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={handleAISearch}
              disabled={aiThinking}
              className="w-full md:w-auto rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Sparkles className={cn("h-4 w-4", aiThinking && "animate-spin")} />
              <span>{aiThinking ? 'AI Analyzing…' : 'AI Search'}</span>
            </button>
          </div>

          {/* AI Suggestion Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1 pt-1 border-t border-slate-100/60">
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> POPULAR SEARCHES:
            </span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-0.5 text-xs font-medium text-slate-700 transition-all hover:border-red-300 hover:bg-red-50/80 hover:text-red-700"
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.div>

        {/* AI Robot */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden lg:flex items-end justify-center shrink-0 self-end -mb-2 ml-2"
        >
          <img
            src="/robot.png"
            alt="AI Assistant Robot"
            className="h-52 xl:h-60 w-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform cursor-pointer mix-blend-multiply"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
            title="Chat with AI Assistant"
          />
        </motion.div>
      </div>
    </div>
  );
}

`;

lines.splice(startIdx - 3, endIdx - (startIdx - 3), exactOriginalCode);

// Add AISmartSearch back into HomePage
const homePageStart = lines.findIndex(l => l.includes('export function HomePage() {'));
if (homePageStart !== -1) {
  const heroIndex = lines.findIndex((l, i) => i > homePageStart && l.includes('<HeroSection />'));
  if (heroIndex !== -1) {
    if (!lines[heroIndex + 1].includes('<AISmartSearch />')) {
      lines.splice(heroIndex + 1, 0, '      <AISmartSearch />');
    }
  }
}

fs.writeFileSync('src/pages/public/home.tsx', lines.join('\n'));
console.log('Successfully rolled back to the EXACT original HeroSection + AISmartSearch.');
