const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  entry: {
    popup: [
      path.resolve(__dirname, 'popup/index.js'),
      path.resolve(__dirname, 'popup/styles/main.sass'),
    ],
    changelog: path.resolve(__dirname, 'changelog/index.js'),
    background: path.resolve(__dirname, 'background/background.js'),
    content: path.resolve(__dirname, 'background/content.js'),
  },

  mode: 'development',

  output: {
    publicPath: '',
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.s(a|c)ss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.(png|svg|woff2|ttf)$/,
        use: 'file-loader',
      },
    ],
  },

  devtool: 'inline-cheap-source-map',

  plugins: [
    new CopyWebpackPlugin({ patterns: [{
      context: './static/',
      from: '**/*',
      to: './',
    }, {
      context: './assets/',
      from: '**/*',
      to: './assets',
    }]}),

    new webpack.DefinePlugin({
      __DEV__: true,
      __CHROME__: JSON.stringify(JSON.parse(process.env.BUILD_CHROME || true)),
      __FIREFOX__: JSON.stringify(JSON.parse(process.env.BUILD_FF || false)),
    }),
  ],

  resolve: {
    extensions: ['.js', '.sass', '.scss'],
  },
};
