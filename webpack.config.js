const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = [
// Generate HTML for iframe-embed
{
  entry: path.resolve(__dirname, "src/embed.js"),
  devtool: "source-map",
  resolve: {
    extensions: [".js"],
    modules: [
      path.resolve(__dirname, "src"),
      path.join(__dirname, "node_modules")
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      title: "C3VOC Player",
      template: "src/embed.html"
    }),
  ],
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader"
      }
    }]
  },
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "embed"),
  },
},
// Generate player library for js consumption
{
  entry: path.resolve(__dirname, "src/player.js"),
  devtool: "source-map",
  resolve: {
    extensions: [".js"],
    modules: [
      path.resolve(__dirname, "src"),
      path.join(__dirname, "node_modules")
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader"
      }
    }]
  },
  output: {
    filename: "player.js",
    path: path.resolve(__dirname, "dist"),
    library: "VOCPlayer",
    libraryTarget: "umd"
  },
}];
