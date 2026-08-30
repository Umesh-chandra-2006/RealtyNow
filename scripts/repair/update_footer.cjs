const fs = require('fs');
const content = fs.readFileSync('src/components/public-layout.tsx', 'utf-8');

const newFooter = `      {/* ── Footer ── */}
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
            <Link
              to="/portal/list-property"
              className="relative z-10 flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all hover:scale-105"
            >
              Post Property FREE
              <ArrowRight className="h-4 w-4" />
            </Link>
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
                    <Link to={link.path} className="group flex items-center gap-2 hover:text-white transition-colors">
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
                  { label: t('footer.propsJubileeHills', 'Properties in Jubilee Hills'), path: '/search?q=Jubilee+Hills' },
                  { label: t('footer.propsBanjaraHills', 'Properties in Banjara Hills'), path: '/search?q=Banjara+Hills' },
                  { label: t('footer.propsHitecCity', 'Properties in HITEC City'), path: '/search?q=HITEC+City' },
                  { label: t('footer.propsGachibowli', 'Properties in Gachibowli'), path: '/search?q=Gachibowli' },
                  { label: t('footer.propsKondapur', 'Properties in Kondapur'), path: '/search?q=Kondapur' },
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

            {/* Column 4 */}
            <div className="lg:col-span-2">
              <h4 className="font-display text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                {t('footer.company', 'Company')}
              </h4>
              <ul className="mt-6 space-y-4 text-sm text-white/50">
                {[
                  { label: t('common.aboutUs', 'About Us'), path: '/about' },
                  { label: t('common.blog', 'Blog & News'), path: '/blogs' },
                  { label: t('common.contactUs', 'Contact Us'), path: '/contact' },
                  { label: t('common.terms', 'Terms of Service'), path: '/terms' },
                  { label: t('common.privacy', 'Privacy Policy'), path: '/privacy' },
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
            <p>
              &copy; {new Date().getFullYear()} Realtynow Properties Private limited. {t('footer.rightsReserved', 'All rights reserved.')}
            </p>
            
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
}`;

let newContent = content;
if (!newContent.includes('ArrowRight')) {
  newContent = newContent.replace('ArrowDown,', 'ArrowDown, ArrowRight,');
}

newContent = newContent.replace(/\{\/\* ── Footer ── \*\/\}.*?^}\s*$/ms, newFooter);

fs.writeFileSync('src/components/public-layout.tsx', newContent, 'utf-8');
console.log('Successfully updated cinematic footer');
