/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4a86e8'
        }
      }
    }
  },
  plugins: []
};
