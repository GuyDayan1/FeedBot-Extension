// webpack.config.js

const path = require('path');

module.exports = {
    entry: './js/content.js', // Specify the entry point of your content script
    output: {
        filename: 'bundle.js', // Specify the output file name
        path: path.resolve(__dirname, 'dist'), // Specify the output file path
    },
    mode: 'production', // Set the mode to 'production' or 'development' based on your needs
};
