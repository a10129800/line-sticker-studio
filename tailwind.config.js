/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        line: {
          green: '#06C755',
          darkgreen: '#05B04B',
          lightgreen: '#E8F8EE',
          gray: '#F5F6F7',
          border: '#E2E5E8'
        }
      }
    },
  },
  plugins: [],
}
