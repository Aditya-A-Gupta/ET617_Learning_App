// Applies and toggles the light/dark theme. The actual initial application
// happens via an inline snippet in <head> (to avoid a flash of the wrong
// theme); this file wires up the toggle button once the DOM is ready.
const ThemeToggle = {
  get() {
    return localStorage.getItem('ls_theme') || 'light';
  },
  set(theme) {
    localStorage.setItem('ls_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  },
  init(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const sync = () => {
      const theme = ThemeToggle.get();
      btn.textContent = theme === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    };
    sync();
    btn.addEventListener('click', () => {
      const next = ThemeToggle.get() === 'dark' ? 'light' : 'dark';
      ThemeToggle.set(next);
      sync();
      if (window.Tracker) {
        Tracker.send('theme_toggled', {
          event_context: 'System',
          description: `The user switched the interface theme to '${next}' mode.`,
        });
      }
    });
  },
};
