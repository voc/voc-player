const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = [
// Generate HTML for iframe-embed
{
  entry: path.resolve(__dirname, "src/embed.js"),
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "embed"),
  },
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
      template: "src/embed.html",
      cache: false,
    }),
  ],
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: ["babel-loader"]
    }, {
      test: /\.s[ac]ss$/i,
      use: [
        "style-loader",
        "css-loader",
        "sass-loader",
      ],
      include: path.resolve(__dirname, 'src'),
    }]
  },
},
// Generate player library for js consumption
{
  entry: path.resolve(__dirname, "src/player.js"),
  devtool: "source-map",
  output: {
    filename: "player.js",
    path: path.resolve(__dirname, "dist"),
    library: "VOCPlayer",
    libraryTarget: "umd"
  },
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
      use: ["babel-loader"]
    }, {
      test: /\.s[ac]ss$/i,
      use: [
        "style-loader",
        "css-loader",
        "sass-loader",
      ],
      include: path.resolve(__dirname, 'src'),
    }]
  },
}];
