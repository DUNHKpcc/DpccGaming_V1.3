module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6C5CE7',
        secondary: '#00B894',
        dark: '#2D3436',
        light: '#F8F9FA',
        neutral: '#636E72'
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: [],
}
