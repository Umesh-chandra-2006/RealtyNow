document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile navigation menu toggle
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');

  if (navToggle && mobileNav) {
    mobileNav.setAttribute('aria-hidden', 'true');
    navToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen);
      mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      navToggle.textContent = isOpen ? '✕' : '☰'; // Change hamburger icon to close mark
      
      // Toggle body scroll locking
      document.body.classList.toggle('no-scroll', isOpen);
      
      if (isOpen) {
        const firstLink = mobileNav.querySelector('a, button');
        if (firstLink) firstLink.focus();
      }
    });

    // Close mobile nav when links inside are clicked
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.textContent = '☰';
        document.body.classList.remove('no-scroll');
      });
    });
  }

  // 2. Search Tabs Tablist switcher (Buy / Rent / PG / Commercial)
  const searchTabs = document.getElementById('searchTabs');
  if (searchTabs) {
    const tabs = Array.from(searchTabs.querySelectorAll('button'));
    
    // Set initial tabindex state for WAI-ARIA compliance
    tabs.forEach((tab, index) => {
      tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    const activateTab = (tabButton) => {
      tabs.forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
      });

      tabButton.classList.add('active');
      tabButton.setAttribute('aria-selected', 'true');
      tabButton.setAttribute('tabindex', '0');
      tabButton.focus();

      // Change input placeholder dynamically
      const cityInput = document.getElementById('cityInput');
      if (cityInput) {
        const type = tabButton.getAttribute('data-type');
        if (type === 'commercial') {
          cityInput.placeholder = 'Search office, retail park or building — e.g. Gachibowli';
        } else if (type === 'pg') {
          cityInput.placeholder = 'Search student hostings, co-living hubs — e.g. Baner';
        } else {
          cityInput.placeholder = 'Search city, locality or project — e.g. Mumbai';
        }
      }
    };

    searchTabs.addEventListener('click', (event) => {
      const tabButton = event.target.closest('button');
      if (!tabButton) return;
      activateTab(tabButton);
    });

    searchTabs.addEventListener('keydown', (event) => {
      const currentTab = document.activeElement;
      if (!tabs.includes(currentTab)) return;

      const index = tabs.indexOf(currentTab);
      let nextIndex = index;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (index + 1) % tabs.length;
        event.preventDefault();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        event.preventDefault();
      } else if (event.key === 'Home') {
        nextIndex = 0;
        event.preventDefault();
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
        event.preventDefault();
      }

      if (nextIndex !== index) {
        activateTab(tabs[nextIndex]);
      }
    });
  }

  // 3. Trending city tags - fill locality input on click
  const cityInput = document.getElementById('cityInput');
  const tagButtons = document.querySelectorAll('.popular-tags button');
  if (cityInput && tagButtons.length > 0) {
    tagButtons.forEach((tag) => {
      tag.addEventListener('click', () => {
        cityInput.value = tag.textContent;
        // Focus the input to give instant visual indication
        cityInput.focus();
      });
    });
  }

  // 4. Scroll Reveal Animations using IntersectionObserver
  const scrollElements = document.querySelectorAll('.reveal-scroll');
  if ('IntersectionObserver' in window && scrollElements.length > 0) {
    const scrollObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Once animated, stop observing this element
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null, // default viewport
      rootMargin: '0px 0px -60px 0px', // trigger slightly before entering viewport
      threshold: 0.1 // 10% visible
    });

    scrollElements.forEach((el) => scrollObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver is not supported
    scrollElements.forEach((el) => el.classList.add('is-visible'));
  }

  // 5. Tactile press feedback on property card hearts
  const heartButtons = document.querySelectorAll('.project-card__heart');
  heartButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isActive = btn.classList.toggle('active');
      btn.textContent = isActive ? '♥' : '♡';
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.setAttribute('aria-label', isActive ? 'Remove from favorites' : 'Add to favorites');
    });
  });

  // 6. Search form submission handling
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cityInput = document.getElementById('cityInput');
      const city = cityInput?.value.trim() || '';
      const cityInputContainer = cityInput?.closest('.search-field');

      // Search Form Input Validation Check
      if (!city) {
        if (cityInputContainer) {
          cityInputContainer.classList.add('has-error');
          cityInput.focus();

          // Remove validation error on user input typing
          cityInput.addEventListener('input', function onInput() {
            cityInputContainer.classList.remove('has-error');
            cityInput.removeEventListener('input', onInput);
          });
        }
        return;
      }

      const bhk = document.getElementById('bhkInput')?.value || '';
      const budget = document.getElementById('budgetInput')?.value || '';
      const activeTab = searchTabs ? searchTabs.querySelector('button.active') : null;
      const searchType = activeTab ? activeTab.getAttribute('data-type') : 'buy';
      
      alert(`Search Query Submitted!\n\nType: ${searchType.toUpperCase()}\nCity/Locality: ${city || 'Any'}\nConfiguration: ${bhk || 'Any'}\nBudget: ${budget || 'Any'}`);
    });
  }
});
