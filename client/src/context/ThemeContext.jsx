import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'co-theme';

// Concrete colours for SVG charts (SVG attributes cannot read CSS variables).
const CHART = {
  dark: { grid: 'rgba(255,255,255,0.06)', axis: '#5A5F73', text: '#8B90A3', surface: '#141722', fg: '#ECEEF5', empty: 'rgba(255,255,255,0.04)' },
  light: { grid: 'rgba(15,23,42,0.07)', axis: '#8A90A3', text: '#52586C', surface: '#FFFFFF', fg: '#0F121E', empty: 'rgba(15,23,42,0.05)' },
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07080C' : '#F4F5FA');
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, setTheme, toggle, chart: CHART[theme] }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
