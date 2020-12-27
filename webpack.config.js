module.exports = {
  cache: false,
  entry: __dirname + '/src/common/lib/VendorsWrapper.js',
  mode: 'development',
  output: {
    path: __dirname + '/src/common/lib/',
    library: 'VendorsWrapper',
    libraryTarget: 'window',
    filename: 'VendorsWrapper.bundle.js'
  },
  resolve: {
    fallback: {
      // for node-unrar-js
      "crypto": require.resolve("crypto-browserify"),
      "buffer": require.resolve("buffer/"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "fs": false,
    }
  }
}
