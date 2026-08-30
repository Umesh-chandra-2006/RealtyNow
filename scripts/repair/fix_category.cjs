const fs = require('fs');
const content = fs.readFileSync('src/pages/public/search.tsx', 'utf-8');

const newCategoryPage = `export function CategoryPage({ category }: { category: 'buy' | 'rent' | 'commercial' | 'plots' | 'luxury' }) {
  const { t } = useLanguageContext();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const purpose = category === 'rent' ? 'Rent' : category === 'buy' ? 'Sale' : undefined;
  const isLuxury = category === 'luxury';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  // SEO
  const seoTitle = {
    buy: t('search.forSaleTitle', 'Properties for Sale in India'),
    rent: t('search.forRentTitle', 'Properties for Rent in India'),
    commercial: t('menu.commercialSpaces', 'Commercial Properties in India'),
    plots: t('menu.plotsTitle', 'Plots & Land in India'),
    luxury: t('home.signatureCollection', 'Luxury Homes in India'),
  }[category];

  useSEO({
    title: seoTitle,
    description: \`Browse the best \${seoTitle.toLowerCase()}. Find your dream property today with RealtyNow.\`,
    schema: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      "name": seoTitle,
    }
  });

  const { data: cities } = useQuery({
    queryKey: ['cities-all'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: types } = useQuery({
    queryKey: ['ptypes-all'],
    queryFn: async () => {
      const { data } = await supabase.from('property_types').select('id, name, category').order('name');
      return data ?? [];
    },
  });

  const typeFilter = useMemo(() => {
    if (!types) return undefined;
    if (category === 'commercial') return types.filter((t2) => t2.category === 'Commercial').map((t2) => t2.id);
    if (category === 'plots') return types.filter((t2) => t2.category === 'Plot').map((t2) => t2.id);
    return undefined;
  }, [types, category]);

  const filters: PropertyFilters = useMemo(() => {
    const typeIdParam = params.get('type_id') || undefined;
    const typeNameParam = params.get('type') || undefined;
    let resolvedTypeId = typeIdParam;
    if (typeNameParam && types) {
      const found = types.find((t2) => t2.name.toLowerCase() === typeNameParam.toLowerCase());
      if (found) resolvedTypeId = found.id;
    }
    
    // Category defaults
    const defaultPurpose = category === 'rent' ? 'Rent' : category === 'buy' ? 'Sale' : undefined;
    const defaultIsLuxury = category === 'luxury' || undefined;

    return {
      q: params.get('q') || undefined,
      city_id: params.get('city') || undefined,
      purpose: params.get('purpose') || defaultPurpose,
      property_type_id: resolvedTypeId || (typeFilter && typeFilter.length === 1 ? typeFilter[0] : undefined),
      min_price: params.get('min_price') ? Number(params.get('min_price')) : undefined,
      max_price: params.get('max_price') ? Number(params.get('max_price')) : undefined,
      bedrooms: params.get('bedrooms') ? Number(params.get('bedrooms')) : undefined,
      bathrooms: params.get('bathrooms') ? Number(params.get('bathrooms')) : undefined,
      min_area: params.get('min_area') ? Number(params.get('min_area')) : undefined,
      max_area: params.get('max_area') ? Number(params.get('max_area')) : undefined,
      furnishing: params.get('furnishing') || undefined,
      facing: params.get('facing') || undefined,
      is_luxury: params.get('luxury') === '1' || defaultIsLuxury,
    };
  }, [params, types, category, typeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['category', category, filters, page],
    queryFn: async () => {
      let q = supabase
        .from('properties')
        .select('*, cities!inner(name), localities(name), property_types(name)', { count: 'estimated' })
        .eq('status', 'published');
      
      if (filters.purpose) q = q.eq('purpose', filters.purpose);
      if (filters.city_id) q = q.eq('city_id', filters.city_id);
      
      if (filters.property_type_id) {
        q = q.eq('property_type_id', filters.property_type_id);
      } else if (typeFilter && typeFilter.length > 0) {
        q = q.in('property_type_id', typeFilter);
      }
      
      if (filters.min_price != null) q = q.gte('price', filters.min_price);
      if (filters.max_price != null) q = q.lte('price', filters.max_price);
      if (filters.bedrooms != null) q = q.eq('bedrooms', filters.bedrooms);
      if (filters.bathrooms != null) q = q.eq('bathrooms', filters.bathrooms);
      if (filters.min_area != null) q = q.gte('built_up_area', filters.min_area);
      if (filters.max_area != null) q = q.lte('built_up_area', filters.max_area);
      if (filters.furnishing) q = q.eq('furnishing', filters.furnishing);
      if (filters.facing) q = q.eq('facing', filters.facing);
      if (filters.is_luxury) q = q.eq('is_luxury', true);
      if (filters.q) q = q.or(\`title.ilike.%\${filters.q}%,description.ilike.%\${filters.q}%,address.ilike.%\${filters.q}%\`);
      
      q = q
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      
      const { data, error, count } = await q;
      if (error) throw error;
      const mapped = (data ?? []).map((p) => {
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
      return { data: mapped, count: count ?? mapped.length };
    },
  });

  const totalPages = data?.count ? Math.ceil(data.count / PAGE_SIZE) : 1;

  const title = {
    buy: t('search.forSaleTitle', 'Properties for Sale'),
    rent: t('search.forRentTitle', 'Properties for Rent'),
    commercial: t('menu.commercialSpaces', 'Commercial Properties'),
    plots: t('menu.plotsTitle', 'Plots & Land'),
    luxury: t('home.signatureCollection', 'Luxury Homes'),
  }[category];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container-page py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-bold text-slate-800">{formatNumber(data?.count ?? 0)}</span>{' '}
              {t('property.propertiesCount', 'properties')}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="lg:hidden flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
          >
            <Filter className="h-4 w-4" /> {t('search.filters', 'Filters')}
          </button>
        </div>
        
        <ListingPromoBanner />

        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Sidebar */}
          <aside className={cn('shrink-0 w-72', showFilters ? 'block' : 'hidden lg:block')}>
            <div className="sticky top-[88px]">
              <AdvancedFilters
                cities={cities ?? []}
                filters={filters}
                onFilterChange={(newFilters) => {
                  const updated = { ...filters, ...newFilters };
                  const newParams = new URLSearchParams(params);
                  
                  newParams.delete('page');

                  const syncParam = (key: string, value: any) => {
                    if (value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
                      newParams.set(key, Array.isArray(value) ? value.join(',') : value.toString());
                    } else {
                      newParams.delete(key);
                    }
                  };

                  syncParam('purpose', updated.purpose);
                  syncParam('city_id', updated.city_id);
                  syncParam('locality_id', updated.locality_id);
                  syncParam('type', updated.property_type_id);
                  syncParam('min_price', updated.min_price);
                  syncParam('max_price', updated.max_price);
                  syncParam('bedrooms', updated.bedrooms);
                  syncParam('bathrooms', updated.bathrooms);
                  syncParam('min_area', updated.min_area);
                  syncParam('max_area', updated.max_area);
                  syncParam('possession_status', updated.possession_status);
                  syncParam('amenities', updated.amenities);

                  setParams(newParams);
                }}
                onCloseMobile={() => setShowFilters(false)}
              />
            </div>
          </aside>

          {/* Main Listings Column */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListSkeleton key={i} />
                ))}
              </div>
            ) : data && data.data.length > 0 ? (
              <div className="space-y-4">
                {data.data.map((p, index) => (
                  <div key={p.id} className="contents">
                    <HorizontalCard property={p as any} />
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(page - 1));
                        setParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="h-4 w-4" /> {t('common.back', 'Prev')}
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      const pg = i + 1;
                      return (
                        <button
                          key={pg}
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('page', String(pg));
                            setParams(next);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={cn(
                            'h-9 w-9 rounded-xl text-sm font-bold border transition',
                            page === pg
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-red-300',
                          )}
                        >
                          {pg}
                        </button>
                      );
                    })}
                    {totalPages > 7 && <span className="px-2 text-slate-400 font-bold">…</span>}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(page + 1));
                        setParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {t('common.next', 'Next')} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 gap-4">
                <Home className="h-12 w-12 text-slate-300" />
                <p className="font-bold text-slate-700">
                  {t('search.noCategoryTitle', 'No properties in this category yet')}
                </p>
                <p className="text-sm text-slate-500">
                  {t('search.noCategoryDesc', 'Check back soon or browse all properties.')}
                </p>
                <Link to="/search" className="rounded-xl bg-red-600 text-white px-5 py-2 text-sm font-bold">
                  {t('search.browseAll', 'Browse All')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Floating CTA */}
      <div className="fixed bottom-6 right-6 lg:hidden z-40">
        <Link
          to="/portal/list-property"
          className="flex h-14 items-center justify-center rounded-full bg-red-600 px-6 font-bold text-white shadow-xl hover:bg-red-700 transition"
        >
          Post Property FREE
        </Link>
      </div>
    </div>
  );
}`;

const replacedContent = content.replace(/export function CategoryPage.*?^}/ms, newCategoryPage);
fs.writeFileSync('src/pages/public/search.tsx', replacedContent, 'utf-8');
console.log('Successfully updated CategoryPage in search.tsx');
