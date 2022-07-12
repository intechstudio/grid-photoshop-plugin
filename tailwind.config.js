module.exports = {
  mode: 'jit',
  purge: [
    './src/**/*.js',
    './src/**/*.svelte'
  ],
  media: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
}