/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
           'poppins': ['Poppins'],
      },
      fontSize: {
      'pageheader': ['28px', {
        lineHeight: '42px',
        letterSpacing: '0px',
        fontWeight: '600',
      }],
      },
      colors: {
        'dark-gray': '#333333',
        'medium-gray': '#666666',
        'light-gray': '#999999',
        'custom-green': '#2ECC71',
        'custom-red': '#E53935',
        'light-emerald': '#E8F8F0'
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
}

