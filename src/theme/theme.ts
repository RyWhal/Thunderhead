export type ThemeId = 'retro_punk_future';

export const themeTokens = {
  retro_punk_future: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    colors: {
      bgPrimary: '#050608',
      bgPanel: '#0a1014',
      neonCyan: '#56f2e9',
      neonMagenta: '#f25eea',
      warningAmber: '#ffb347',
      dangerRed: '#ff5161',
      textPrimary: '#d6ffe9',
      textMuted: '#88b9a8',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    },
    radius: {
      sm: 2,
      md: 4,
    },
    glow: {
      low: '0 0 6px rgba(86, 242, 233, 0.2)',
      medium: '0 0 10px rgba(86, 242, 233, 0.35)',
    },
  },
} as const;

export type UiPreferences = {
  highContrast: boolean;
  crtEffectsEnabled: boolean;
};

export const defaultUiPreferences: UiPreferences = {
  highContrast: false,
  crtEffectsEnabled: true,
};
