module.exports = {
  entry: ['./example/index.ts'],
  output: {
    path: 'example',
    filename: 'index.js'
  },
  resolve: {
    extensions: ['', '.ts', '.js']
  },
  module: {
    loaders: [
      {test: /\.ts(x?)$/, loader: 'ts-loader'}
    ]
  }
};