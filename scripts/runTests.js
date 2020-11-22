const tsNode = require('ts-node');
const RunTests = require('klesun-node-tools/src/Transpiled/RunTests.js');

require('klesun-node-tools/scripts/polyfills.js');

tsNode.register({
    transpileOnly: true,
    // otherwise it ignores ts files imported from node_modules
    // add here any other npm libs with source .ts files you are going to import
    ignore: [/node_modules\/(?!klesun-node-tools\/)/],
});

console.log('Starting kunkka-torrent unit tests');

// TODO: migrate to mocha or something
RunTests({rootPath: __dirname + '/../tests/'});
