import * as url from 'url';
import {shortenTorrentInfo, TorrentInfo} from "./actions/ScanInfoHashStatus";
import * as http from "http";
import {HTTP_PORT} from "./Constants";
import Exc from "klesun-node-tools/src/ts/Exc";
import Swarm = TorrentStream.Swarm;
import TorrentEngine = TorrentStream.TorrentEngine;
import Qbtv2 from "./Qbtv2";
const torrentStream = require('torrent-stream');
const {timeout} = require('klesun-node-tools/src/Lang.js');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

interface NowadaysSwarm extends Swarm {
    wires: {
        isSeeder: boolean,
    }[],
    _peers: unknown[],
}

interface NowadaysEngine extends TorrentEngine {
    swarm: NowadaysSwarm;
}

const makeSwarmSummary = (swarm: NowadaysSwarm) => {
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
    return timeout(5, whenMeta)
        .then(meta => {
            console.log('ololo meta in ' + ((Date.now() - startedMs) / 1000).toFixed(3) + ' seconds - ' + meta.name);
            return meta;
        })
        .finally(() => engine.destroy());
};

const checkInfoHashPeers = async (rq: http.IncomingMessage) => {
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
    const infoHashToWhenEngine: Record<string, Promise<NowadaysEngine>> = {};

    const prepareTorrentStream = async (infoHash: string): Promise<NowadaysEngine> => {
        if (!infoHash || infoHash.length !== 40) {
            throw new Error('Invalid infoHash, must be a 40 characters long hex string');
        }
        if (!infoHashToWhenEngine[infoHash]) {
            // TODO: clear when no ping for 30 seconds or something
            infoHashToWhenEngine[infoHash] = Promise.resolve().then(async () => {
                const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
                await new Promise(
                    resolve => engine.on('ready', resolve)
                );
                return engine;
            });
        }
        return infoHashToWhenEngine[infoHash];
    };

    const getFfmpegInfo = async (rq: http.IncomingMessage) => {
        const {infoHash, filePath} = <Record<string, string>>url.parse(rq.url, true).query;
        if (!infoHash || infoHash.length !== 40) {
            throw Exc.BadRequest('Invalid infoHash, must be a 40 characters long hex string');
        } else if (!filePath) {
            throw Exc.BadRequest('filePath parameter is mandatory');
        }
        await prepareTorrentStream(infoHash);
        const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
            infoHash + '&filePath=' + encodeURIComponent(filePath);
        const execResult = await execFile('ffprobe', ['-v' ,'quiet', '-print_format', 'json', '-show_format', '-show_streams', streamUrl]);
        const {stdout, stderr} = execResult;
        return JSON.parse(stdout);
    };

    const getSwarmInfo = async (rq: http.IncomingMessage) => {
        const {infoHash} = <Record<string, string>>url.parse(rq.url, true).query;
        if (!infoHash || infoHash.length !== 40) {
            throw Exc.BadRequest('Invalid infoHash, must be a 40 characters long hex string');
        }
        const engine = await prepareTorrentStream(infoHash);
        return makeSwarmSummary(engine.swarm);
    };

    return {
        checkInfoHashMeta: checkInfoHashMeta,
        checkInfoHashPeers: checkInfoHashPeers,
        getFfmpegInfo: getFfmpegInfo,
        getSwarmInfo: getSwarmInfo,

        qbtv2: Qbtv2(),

        // following not serializable - for internal use only
        prepareTorrentStream: prepareTorrentStream,
        getPreparingStream: infoHash => infoHashToWhenEngine[infoHash],
    };
};

export default Api;

export type IApi = ReturnType<typeof Api>;