const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    entry: {
        content: './js/content.js',
        background: './js/background.js',

    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production',
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
};
