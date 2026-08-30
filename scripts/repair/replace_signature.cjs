const fs = require('fs');

const file = 'src/pages/public/home.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Embla imports if missing
if (!code.includes('useEmblaCarousel')) {
  const importStatement = `import useEmblaCarousel from 'embla-carousel-react';\nimport Autoplay from 'embla-carousel-autoplay';\n`;
  // Add right after react imports
  const reactImportIdx = code.indexOf('import {');
  code = code.slice(0, reactImportIdx) + importStatement + code.slice(reactImportIdx);
}
// Add Heart, ChevronLeft, ChevronRight icons import if missing
const iconsToAdd = ['Heart', 'ChevronLeft', 'ChevronRight'];
iconsToAdd.forEach(icon => {
  if (!code.includes(icon + ',') && !code.includes(', ' + icon)) {
    code = code.replace('import { ', 'import { ' + icon + ', ');
  }
});

// 2. Extract and replace SignatureCollection
const lines = code.split('\n');
const startIdx = lines.findIndex(l => l.includes('function SignatureCollection() {'));

let endIdx = startIdx;
let braceCount = 0;
let hasOpened = false;

while (endIdx < lines.length) {
  const line = lines[endIdx];
  if (line.includes('{')) {
    braceCount += (line.match(/{/g) || []).length;
    hasOpened = true;
  }
  if (line.includes('}')) {
    braceCount -= (line.match(/}/g) || []).length;
  }
  
  if (hasOpened && braceCount === 0) {
    break;
  }
  endIdx++;
}

// We need to also replace the SectionShell with our custom section as per instructions:
// Top Margin 80px, Bottom Margin 100px, Background #F8FAFC, Max width 1440px
// Section Header: Left "Signature Collection", Subtitle, Right "Explore All ->"

const newComponent = `function SignatureCollection() {
  const { t } = useLanguageContext();
  const { data } = useQuery({
    queryKey: ['home-luxury'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('*, cities(name), localities(name), property_types(name)')
        .eq('status', 'published')
        .eq('is_luxury', true)
        .order('price', { ascending: false })
        .limit(9);
      return (data ?? []).map((p) => {
        const r = p as unknown as {
          cities?: { name: string };
          localities?: { name: string };
          property_types?: { name: string };
        };
        return {
          ...p,
          city_name: r.cities?.name ?? null,
          locality_name: r.localities?.name ?? null,
          property_type_name: r.property_types?.name ?? null,
        };
      });
    },
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: 'start', loop: true, containScroll: 'trimSnaps' },
    [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-[80px] mb-[100px] w-full bg-[#F8FAFC] py-16 lg:py-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-[#F8FAFC] opacity-80 pointer-events-none" />
      
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              Signature Collection
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-600 font-medium">
              Ultra Luxury Homes for the Discerning Buyer
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link 
              to="/search?is_luxury=true" 
              className="group flex items-center gap-2 text-base font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Explore All 
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        {/* Carousel Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          {/* Embla Viewport */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-[28px]">
              {data.map((p, i) => (
                <motion.div 
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 + 0.3, duration: 0.5 }}
                  className="relative min-w-0 flex-[0_0_100%] sm:flex-[0_0_calc(50%-14px)] lg:flex-[0_0_calc(33.333%-18.66px)] max-w-[420px]"
                >
                  <Link 
                    to={\`/property/\${p.id}\`}
                    className="group block h-[480px] lg:h-[520px] w-full rounded-[24px] bg-white border border-[#ECECEC] shadow-[0_15px_45px_rgba(0,0,0,0.12)] overflow-hidden transition-all duration-500 hover:-translate-y-[10px] hover:shadow-[0_25px_60px_rgba(0,0,0,0.18)]"
                  >
                    
                    {/* Top Image Box */}
                    <div className="relative h-[280px] w-full overflow-hidden bg-slate-100 rounded-t-[24px]">
                      <img
                        src={p.images?.[0] ?? 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                      />
                      
                      {/* Signature Badge */}
                      <div className="absolute top-4 left-4 z-10 transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.6)] rounded-full">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                          <Sparkles className="h-3 w-3" /> SIGNATURE
                        </span>
                      </div>

                      {/* Wishlist Glass Icon */}
                      <button 
                        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white transition-all hover:bg-white/40 hover:scale-110 active:scale-95 focus:outline-none"
                        onClick={(e) => { e.preventDefault(); /* Wishlist handler logic */ }}
                      >
                        <Heart className="h-5 w-5" />
                      </button>

                      {/* Image Bottom Overlay Fade */}
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
                    </div>

                    {/* Bottom Details Content */}
                    <div className="relative flex flex-col justify-between h-[calc(100%-280px)] p-6 bg-gradient-to-b from-white to-[#FAFAFA]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {p.property_type_name || 'Ultra Luxury'}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {p.builder_name || 'Premium Builder'}
                          </span>
                        </div>
                        
                        <h3 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 line-clamp-1 group-hover:text-red-600 transition-colors">
                          {p.title}
                        </h3>
                        
                        <div className="mt-2 flex items-center gap-1.5 text-slate-500">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="text-sm font-medium line-clamp-1">
                            {p.locality_name}, {p.city_name}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
                        <p className="font-display text-2xl font-black text-slate-900 tracking-tight">
                          {formatCompactPrice(p.price)}
                        </p>
                        <span className="flex items-center gap-1 text-sm font-bold text-red-600 group-hover:gap-2 transition-all">
                          View Details <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>

                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          {data.length > 3 && (
            <>
              <button
                onClick={scrollPrev}
                className="absolute left-[-24px] top-[240px] -translate-y-1/2 z-20 hidden lg:flex h-14 w-14 items-center justify-center rounded-full bg-white border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] text-slate-700 transition-all hover:bg-slate-50 hover:text-red-600 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-slate-100"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <button
                onClick={scrollNext}
                className="absolute right-[-24px] top-[240px] -translate-y-1/2 z-20 hidden lg:flex h-14 w-14 items-center justify-center rounded-full bg-white border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] text-slate-700 transition-all hover:bg-slate-50 hover:text-red-600 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-slate-100"
                aria-label="Next slide"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Pagination Dots */}
          <div className="mt-8 flex items-center justify-center gap-2">
            {data.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi && emblaApi.scrollTo(i)}
                className={\`h-2 transition-all duration-300 rounded-full \${i === selectedIndex ? 'w-8 bg-red-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}\`}
                aria-label={\`Go to slide \${i + 1}\`}
              />
            ))}
          </div>

        </motion.div>
      </div>
    </section>
  );
}`;

lines.splice(startIdx, endIdx - startIdx + 1, newComponent);

fs.writeFileSync(file, lines.join('\n'));
console.log('SignatureCollection rewritten successfully!');
