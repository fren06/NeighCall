// Raw colour values for places that can't use Tailwind classes (e.g. navigator
// options). Keep in sync with the tokens in global.css.
export const palette = {
  light: {
    brand: 'rgb(5, 150, 105)',
    background: 'rgb(255, 255, 255)',
    border: 'rgb(229, 229, 229)',
    mutedForeground: 'rgb(115, 115, 115)',
  },
  dark: {
    brand: 'rgb(52, 211, 153)',
    background: 'rgb(10, 10, 10)',
    border: 'rgb(46, 46, 46)',
    mutedForeground: 'rgb(161, 161, 161)',
  },
} as const;
