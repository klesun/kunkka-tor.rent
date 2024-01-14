
const tsNode = require('ts-node');

tsNode.register({
    swc: true,
    transpileOnly: true,
    // otherwise it ignores ts files imported from node_modules
    // add here any other npm libs with source .ts files you are going to import
    ignore: [/node_modules\/(?!klesun-node-tools\/)/],
});

const Server = require('./src/server/Server').default;

Server(__dirname).catch(exc => {
    console.error('Failed to start kunkka-torrent server', exc);
    process.exit(1);
});
