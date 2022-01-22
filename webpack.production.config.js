const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require('path');

module.exports = {
  entry: {
    popup: [
      path.resolve(__dirname, 'popup/index.js'),
      path.resolve(__dirname, 'popup/styles/main.sass'),
    ],
    background: path.resolve(__dirname, 'background/background.js'),
    content: path.resolve(__dirname, 'background/content.js'),
  },

  output: {
    publicPath: '',
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
  },

  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.s[ac]ss$/,          
        use: [ 
          MiniCssExtractPlugin.loader, 
          {
            loader:'css-loader',
            options: { url: false },
          }, 
          'sass-loader'
        ],
      },
      {
        test: /\.(png|svg|woff2|ttf)$/,
        use: 'file-loader',
      },
    ],
  },

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
      __DEV__: false,
      __CHROME__: JSON.stringify(JSON.parse(process.env.BUILD_CHROME || true)),
      __FIREFOX__: JSON.stringify(JSON.parse(process.env.BUILD_FF || false)),
    }),
    
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
  ],

  resolve: {
    extensions: ['.js', '.sass', '.scss'],
  },
};
