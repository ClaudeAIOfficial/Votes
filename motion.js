(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const dynamicList = document.querySelector('#currency-list');
  const revealSelector = '.hero-eyebrow, .hero h1, .hero-desc, .hero-actions, .info-stat, .section-head, .filter-row, .currency-card, .list-bottom, .callout-intro, .step, .footer-brand, .footer-links, .footer-bottom';
  let observer;

  function reveal(elements) {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    elements.forEach((element, index) => {
      if (element.dataset.revealReady === 'true') return;
      element.dataset.revealReady = 'true';
      element.classList.add('reveal');
      const stagger = element.matches('.currency-card') ? Math.min(index % 3, 2) * 90 : element.matches('.step') ? Math.min(index, 2) * 90 : 0;
      element.style.setProperty('--reveal-delay', `${stagger}ms`);
      observer.observe(element);
    });
  }

  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -25px 0px' });
    document.documentElement.classList.add('motion-ready');
    reveal([...document.querySelectorAll(revealSelector)]);
    if (dynamicList && 'MutationObserver' in window) {
      const mutationObserver = new MutationObserver(() => reveal([...dynamicList.querySelectorAll('.currency-card')]));
      mutationObserver.observe(dynamicList, { childList: true });
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      header?.classList.toggle('is-scrolled', scrollY > 18);
      if (hero && !reduceMotion.matches && scrollY < hero.offsetHeight + 160) {
        hero.style.setProperty('--hero-offset', `${Math.min(scrollY * .085, 37).toFixed(1)}px`);
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
