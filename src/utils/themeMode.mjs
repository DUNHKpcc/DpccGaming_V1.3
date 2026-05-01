export const THEME_MODES = ['system', 'light', 'dark'];

export const normalizeThemeMode = (value) => (
  THEME_MODES.includes(value) ? value : 'system'
);

export const getNextThemeMode = (currentMode) => {
  const normalized = normalizeThemeMode(currentMode);
  const currentIndex = THEME_MODES.indexOf(normalized);
  return THEME_MODES[(currentIndex + 1) % THEME_MODES.length];
};

export const getEffectiveTheme = (themeMode, systemPrefersDark = false) => {
  const normalized = normalizeThemeMode(themeMode);
  if (normalized === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return normalized;
};
