/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: (theme) => ({
        flashBorder: {
          '0%, 20%': { borderColor: theme('colors.white') },
          '100%': { borderColor: theme('colors.gray.700') },
        },
      }),
      animation: {
        flashBorder: 'flashBorder 0.5s cubic-bezier(0, 0, 0.2, 1) 1',
      },
    },
  },
  plugins: ['@tailwindcss/forms'],
}
