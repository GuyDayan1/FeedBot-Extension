const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    entry: './js/content.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production',
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
};
