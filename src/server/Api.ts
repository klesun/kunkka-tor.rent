import * as url from 'url';
import * as parseTorrent from 'parse-torrent';
const torrentStream = require('torrent-stream');
const Rej = require('klesun-node-tools/src/Rej.js');

const limitTime = <T>(maxSeconds: number, promise: Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let rejected = false;
        promise.then(result => {
            if (!rejected) {
                resolved = true;
                resolve(result);
            }
        });
        setTimeout(() => {
            if (!resolved) {
                rejected = true;
                const msg = 'Promise timed out after ' + maxSeconds + ' seconds';
                reject(Rej.GatewayTimeout.makeExc(msg, {isOk: true}));
            }
        }, maxSeconds * 1000);
    });
};

const makeSwarmSummary = (swarm) => {
    let seederWires = 0;
    let otherWires = 0;
    for (const wire of swarm.wires) {
        if (wire.isSeeder) {
            ++seederWires;
        } else {
            ++otherWires;
        }
    }
    return {
        seederWires: seederWires,
        otherWires: otherWires,
        peers: Object.keys(swarm._peers).length,
    };
};

const shortenTorrentInfo = (torrent: any) => ({
    name: torrent.name,
    length: torrent.length,
    files: torrent.files.map(f => ({
        path: f.path, length: f.length,
    })),
});

type TorrentInfo = ReturnType<typeof shortenTorrentInfo>;

const checkInfoHashMeta = async rq => {
    const {infoHash} = url.parse(rq.url, true).query;
    if (!infoHash || infoHash.length !== 40) {
        throw new Error('Invalid infoHash, must be a 40 characters long hex string');
    }

    const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
    const whenMeta = new Promise<TorrentInfo>(resolve => {
        engine.on('torrent', async (torrent) => {
            resolve(shortenTorrentInfo(torrent));
        });
    });

    const startedMs = Date.now();
    return limitTime(5, whenMeta)
        .then(meta => {
            console.log('ololo meta in ' + ((Date.now() - startedMs) / 1000).toFixed(3) + ' seconds - ' + meta.name);
            return meta;
        })
        .finally(() => engine.destroy());
};

const checkInfoHashPeers = async rq => {
    const {infoHash} = url.parse(rq.url, true).query;
    if (!infoHash || infoHash.length !== 40) {
        throw new Error('Invalid infoHash, must be a 40 characters long hex string');
    }
    const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
    // would be real cool to send response incrementally...
    engine.listen();
    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
    const summary = makeSwarmSummary(engine.swarm);
    engine.destroy();

    // {"delay":1,"summary":{"seederWires":0,"otherWires":0,"wires":0,"peers":0}},
    // {"delay":5,"summary":{"seederWires":7,"otherWires":2,"wires":9,"peers":48}},
    // {"delay":10,"summary":{"seederWires":7,"otherWires":2,"wires":9,"peers":20}},
    // {"delay":20,"summary":{"seederWires":7,"otherWires":2,"wires":9,"peers":20}},
    // {"delay":40,"summary":{"seederWires":8,"otherWires":2,"wires":10,"peers":20}}
    // const measurements = [];
    // const delays = [1, 5, 10, 20, 40];
    // for (const delay of delays) {
    //     await new Promise(resolve => setTimeout(resolve, delay * 1000));
    //     const summary = makeSwarmSummary(engine.swarm);
    //     measurements.push({delay, summary});
    // }

    engine.destroy();
    return summary;
};

const Api = () => {
    return {
        checkInfoHashMeta: checkInfoHashMeta,
        checkInfoHashPeers: checkInfoHashPeers,
    };
};

export default Api;

export type IApi = ReturnType<typeof Api>;