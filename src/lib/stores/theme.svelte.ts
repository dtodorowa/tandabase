/**
 * Theme store — persists 'light' | 'dark' in localStorage
 * and applies `data-theme` attribute to <html>.
 */

type Theme = 'light' | 'dark';

function createThemeState() {
  let current = $state<Theme>('dark');

  function apply(t: Theme) {
    current = t;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem('theme', t);
    }
  }

  function init() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      apply(saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      apply('light');
    } else {
      apply('dark');
    }
  }

  function toggle() {
    apply(current === 'dark' ? 'light' : 'dark');
  }

  return {
    get current() { return current; },
    init,
    toggle,
  };
}

export const themeState = createThemeState();
