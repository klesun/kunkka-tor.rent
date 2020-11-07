
const tsNode = require('ts-node');

tsNode.register({
    transpileOnly: true,
    // otherwise it ignores ts files imported from node_modules
    ignore: [],
});

const Server = require('./src/server/Server').default;

Server(__dirname).catch(exc => {
    console.error('Failed to start kunkka-torrent server', exc);
    process.exit(1);
});
