document.addEventListener('DOMContentLoaded', () => {
  // --- Mobile Sidebar Toggle ---
  const sidebar = document.getElementById('sidebar');
  const mobToggle = document.getElementById('mobToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  if (sidebar && mobToggle && sidebarClose) {
    function openSidebar() {
      sidebar.classList.add('is-open');
      mobToggle.setAttribute('aria-expanded', 'true');
      
      // Focus management (trap)
      const firstFocusable = sidebar.querySelector('a, button');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    function closeSidebar() {
      sidebar.classList.remove('is-open');
      mobToggle.setAttribute('aria-expanded', 'false');
      mobToggle.focus(); // Return focus
    }

    mobToggle.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeSidebar();
      }
    });
  }
});
