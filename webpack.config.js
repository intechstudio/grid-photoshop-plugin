const path = require('path');
const sveltePreprocess = require("svelte-preprocess");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  resolve: {
    alias: {
      svelte: path.dirname(require.resolve('svelte/package.json')),
    },
    extensions: ['.mjs', '.js', '.svelte'],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'index.js',
  },
  externals: {
    uxp: 'commonjs2 uxp',
    photoshop: "commonjs2 photoshop",
    os: "commonjs2 os",
  },
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            emitCss: false,
            preprocess: sveltePreprocess({        
              postcss: true,      
            }),
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader", 
          "postcss-loader"
        ]
      },
      {
        // Prevents errors from Svelte on Webpack 5+
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: ['plugin'],
    }),
    new MiniCssExtractPlugin({
      filename: 'global.css'
    }),
  ]
};