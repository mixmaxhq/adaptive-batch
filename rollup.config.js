export default {
  input: './src/index.js',
  external: (id) => !'./\0'.includes(id[0]),
  output: {
    format: 'cjs',
    file: './dist/index.js',
  },
};
