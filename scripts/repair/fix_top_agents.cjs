const fs = require('fs');
const path = require('path');
const file = 'e:\\Realtynow_new\\src\\pages\\public\\home.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const startIndex = 1717; // 0-indexed for 1718
const endIndex = 1782; // 0-indexed for 1783

const replacement = `function TopAgents() {
  const { t } = useLanguageContext();
  const { data: agents } = useQuery({
    queryKey: ['home-agents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, bio, company, specialization')
        .eq('role', 'agent')
        .eq('status', 'active')
        .limit(8);
      return data ?? [];
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [agents]);

  if (!agents || agents.length === 0) return null;

  return (
    <section className="py-16 bg-white overflow-hidden" id="agents">
      <div className="container-wide relative">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                {t('home.topAgents', 'Top Agents')}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 border border-red-100">
                <ShieldCheck className="h-4 w-4" />
                Verified Real Estate Experts
              </span>
            </div>
            <p className="text-slate-500 max-w-2xl text-sm sm:text-base">
              {t('home.connectExperts', 'Connect with trusted agents to find the perfect property')}
            </p>
          </div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            View All Agents <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative group -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => scroll('left')}
            className={"hidden sm:grid absolute -left-5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-slate-100 hover:text-red-600 transition-all hover:scale-110 " + (!showLeft && 'opacity-0 pointer-events-none')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-8 pt-4 hide-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {agents.map((a, i) => {
              const badges = ['TOP RATED', 'RISING STAR', 'EXPERT', 'TOP PERFORMER'];
              const badge = badges[i % badges.length];
              const badgeColors = {
                'TOP RATED': 'text-red-600 bg-red-50 border-red-100',
                'RISING STAR': 'text-blue-600 bg-blue-50 border-blue-100',
                'EXPERT': 'text-emerald-600 bg-emerald-50 border-emerald-100',
                'TOP PERFORMER': 'text-gold-600 bg-gold-50 border-gold-100',
              };

              const bgStyles = [
                { background: 'radial-gradient(circle at top left, #fee2e2 0%, #fff1f2 100%)' },
                { background: 'radial-gradient(circle at top right, #dbeafe 0%, #eff6ff 100%)' },
                { background: 'radial-gradient(circle at top left, #d1fae5 0%, #ecfdf5 100%)' },
                { background: 'radial-gradient(circle at top right, #fef3c7 0%, #fffbeb 100%)' },
              ];
              const bgStyle = bgStyles[i % bgStyles.length];

              return (
                <div
                  key={a.id}
                  className="snap-start shrink-0 w-[300px] sm:w-[320px] rounded-[32px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden transition-all hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 flex flex-col"
                >
                  <div
                    className="h-28 w-[120%] absolute top-0 -left-[10%] rounded-b-[50%]"
                    style={bgStyle}
                  />

                  <div className="relative z-10 p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-8 h-8"></div>
                      <span
                        className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border uppercase tracking-wider " + badgeColors[badge]}
                      >
                        {badge === 'TOP RATED' && <Star className="h-3 w-3" />}
                        {badge === 'RISING STAR' && <TrendingUp className="h-3 w-3" />}
                        {badge === 'EXPERT' && <ShieldCheck className="h-3 w-3" />}
                        {badge === 'TOP PERFORMER' && <Award className="h-3 w-3" />}
                        {badge}
                      </span>
                    </div>

                    <div className="mx-auto relative mb-3">
                      {a.avatar_url ? (
                        <img
                          src={a.avatar_url}
                          alt={(a.first_name ?? '') + ' ' + (a.last_name ?? '')}
                          className="h-20 w-20 rounded-full object-cover border-[3px] border-white shadow-md bg-white"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-full border-[3px] border-white shadow-md bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center text-3xl font-bold">
                          {a.first_name?.[0] ?? 'A'}
                        </div>
                      )}
                    </div>

                    <div className="text-center mb-6">
                      <h3 className="font-display font-bold text-xl text-slate-900 leading-tight">
                        {a.first_name} {a.last_name}
                      </h3>
                      <p className="text-[13px] text-slate-500 mt-1">{a.company || 'Real Estate Agent'}</p>

                      <div className="flex items-center justify-center gap-1 mt-2.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="h-4 w-4 fill-red-600 text-red-600" />
                        ))}
                        <span className="text-xs font-bold text-slate-600 ml-1">
                          ({(4.5 + (i % 5) * 0.1).toFixed(1)})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 leading-none mb-1">
                            {100 + i * 15}+
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">Deals Closed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
                          <Award className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 leading-none mb-1">
                            {5 + i}+
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">Years Exp.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-center gap-4 mb-4">
                        <a
                          href={"tel:" + (a.phone ?? '')}
                          className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <Phone className="h-[18px] w-[18px]" />
                        </a>
                        <a
                          href={"https://wa.me/" + (a.phone ?? '')}
                          className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          <MessageCircle className="h-[18px] w-[18px]" />
                        </a>
                        <Link
                          to={"/agents/" + a.id}
                          className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                        >
                          <Calendar className="h-[18px] w-[18px]" />
                        </Link>
                      </div>

                      <Link
                        to={"/agents/" + a.id}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        View Full Profile
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => scroll('right')}
            className={"hidden sm:grid absolute -right-5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-slate-100 hover:text-red-600 transition-all hover:scale-110 " + (!showRight && 'opacity-0 pointer-events-none')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="flex justify-center gap-2 mt-2">
            <div className="h-1.5 w-4 rounded-full bg-red-600"></div>
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
          </div>
        </div>
      </div>
    </section>
  );
}`;

lines.splice(startIndex, endIndex - startIndex + 1, replacement);
fs.writeFileSync(file, lines.join('\n'));
console.log('Successfully replaced TopAgents');
