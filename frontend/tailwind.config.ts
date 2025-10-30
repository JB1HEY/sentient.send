import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      colors: {
        primary: '#ffffff',
        secondary: '#cccccc',
        dark: {
          bg: '#000000',
          card: '#1a1a1a',
          border: '#333333',
          text: '#ffffff',
          muted: '#999999',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
      },
    },
  },
  plugins: [],
}
export default config