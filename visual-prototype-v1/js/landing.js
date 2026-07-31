document.addEventListener('DOMContentLoaded', () => {
  // --- Header Scroll State ---
  const header = document.querySelector('.landing-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  // --- Mobile Menu ---
  const mobToggle = document.getElementById('landingMobToggle');
  const mobMenu = document.getElementById('landingMobMenu');
  if (mobToggle && mobMenu) {
    mobToggle.addEventListener('click', () => {
      mobMenu.classList.toggle('is-open');
      const isOpen = mobMenu.classList.contains('is-open');
      mobToggle.setAttribute('aria-expanded', isOpen);
      
      // Animate hamburger to X
      const spans = mobToggle.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'translateY(6px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-6px) rotate(-45deg)';
        mobMenu.querySelector('a')?.focus();
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
        mobToggle.focus();
      }
    });
  }

  // --- FAQ Accordion ---
  const faqButtons = document.querySelectorAll('.faq-button');
  faqButtons.forEach(button => {
    button.addEventListener('click', () => {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      
      // Close all others
      faqButtons.forEach(btn => {
        btn.setAttribute('aria-expanded', 'false');
        btn.nextElementSibling.style.height = '0px';
      });

      // Toggle current
      if (!isExpanded) {
        button.setAttribute('aria-expanded', 'true');
        const content = button.nextElementSibling;
        const inner = content.querySelector('.faq-content-inner');
        content.style.height = `${inner.getBoundingClientRect().height}px`;
      }
    });
  });

  // --- Scroll Reveals ---
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && !window.IS_SCREENSHOT) {
    const reveals = document.querySelectorAll('.rv');
    // Initially hide them
    reveals.forEach(r => {
      r.style.opacity = '0';
      r.style.transform = 'translateY(20px)';
      r.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, i * 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(r => observer.observe(r));
  }
});
