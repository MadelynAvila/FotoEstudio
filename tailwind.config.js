/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        umber: '#443A35',
        dune: '#E4DDCC',
        sand: '#faf8f4',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,.06)'
      },
      borderRadius: {
        xl2: '16px'
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['Poppins', 'ui-sans-serif', 'system-ui']
      }
    },
  },
  plugins: [],
}
