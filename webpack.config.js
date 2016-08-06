module.exports = {
  entry: ['./src/main.ts'],
  output: {
    path: 'dist',
    filename: 'kanbandown.js'
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