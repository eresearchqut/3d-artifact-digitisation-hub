// Webpack config for building the NestJS Lambda handler.
// Used instead of esbuild (CDK NodejsFunction) because esbuild does not support
// TypeScript's emitDecoratorMetadata, which NestJS DI requires.
// ts-loader respects tsconfig.build.json and emits the __metadata() calls correctly.

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/lambda.ts',
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.build.json',
            transpileOnly: false,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'lambda.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
  },
  optimization: {
    minimize: false,
    // Disable automatic code splitting
    splitChunks: false,
    runtimeChunk: false,
  },
  plugins: [
    // Force all dynamic import() chunks to be merged into lambda.js.
    // NestJS uses dynamic imports for optional modules; without this, webpack
    // emits numbered chunk files that aren't included in the Lambda package.
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  // NestJS wraps these in optionalRequire() so they are safe to leave absent at runtime
  externals: {
    '@nestjs/websockets': 'commonjs @nestjs/websockets',
    '@nestjs/websockets/socket-module': 'commonjs @nestjs/websockets/socket-module',
    '@nestjs/microservices': 'commonjs @nestjs/microservices',
    '@nestjs/microservices/microservices-module': 'commonjs @nestjs/microservices/microservices-module',
  },
};
