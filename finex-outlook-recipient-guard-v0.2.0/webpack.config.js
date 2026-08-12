const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: { commands: "./src/commands.ts" },
  output: { path: path.resolve(__dirname, "dist"), clean: true },
  resolve: { extensions: [".ts", ".js"] },
  module: { rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }] },
  plugins: [
    new HtmlWebpackPlugin({ template: "./src/commands.html", filename: "commands.html", chunks: ["commands"] }),
    new CopyWebpackPlugin({ patterns: [
      { from: "config/rules.json", to: "config/rules.json" },
      { from: "assets", to: "assets" }
    ] })
  ],
  devServer: {
    server: "https",
    port: 3000,
    headers: { "Access-Control-Allow-Origin": "*" }
  }
};
