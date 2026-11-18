const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Two entry points: dashboard (index.html) and guide (guide.html) share the same design tokens and base modules
module.exports = {
  entry: {
    app: './js/main.js',
    guide: './js/guide.js',
  },

  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
        ],
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].bundle.css',
    }),
  ],

  optimization: {
    minimize: true,
  },
};
