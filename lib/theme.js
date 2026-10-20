// Preferência de tema guardada em cookie para o servidor já renderizar na cor certa (sem "piscar").
export const THEME_COOKIE = 'fin_theme';
export const THEMES = ['dark', 'light', 'auto'];
export const DEFAULT_THEME = 'dark';
export const THEME_COLORS = { dark: '#0b1120', light: '#1f9d63' };

export const parseTheme = (value) => (THEMES.includes(value) ? value : DEFAULT_THEME);
