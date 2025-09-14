import * as url from 'url';
import {shortenFileInfo, shortenTorrentInfo, TorrentInfo, TorrentMainInfo} from "./actions/ScanInfoHashStatus";
import * as http from "http";
import {HTTP_PORT} from "./Constants";
import Swarm = TorrentStream.Swarm;
import TorrentEngine = TorrentStream.TorrentEngine;
import Qbtv2 from "./Qbtv2";
import {parseMagnetUrl} from "../common/Utils.js";
const torrentStream = require('torrent-stream');
const {timeout} = require('klesun-node-tools/src/Utils/Lang.js');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
import * as fs from 'fs';
import fsPromises from 'fs/promises';
import * as parseTorrent from 'parse-torrent';
import {BadGateway, BadRequest, NotImplemented, TooEarly} from "@curveball/http-errors";
import TorrentNamesFts from "./repositories/TorrentNamesFts";
import {readPost} from "./utils/Http";

type SwarmWire = {
    downloaded: number,
    /** I take it false means it's an actual seed that seeds, while true means that he is too busy or a douchebag */
    peerChoking: boolean,
    /**
     * I would consider that true means he is a leach and otherwise a seed... at least if it's true, he is
     * definitely a leach, though not sure it will ever be so, considering that we always start with 0 data
     */
    peerInterested: false,

};

interface NowadaysSwarm extends Swarm {
    /** I take it, this list holds wires of peers that we managed to start exchanging data with */
    wires: SwarmWire[],
    /** Includes everything from wires + "choking" peers, that refuse to send us data */
    _peers: Record<string, {wire: SwarmWire}>,
    downloadSpeed: () => number,
    connections: unknown,
}

interface NowadaysEngine extends TorrentEngine {
    swarm: NowadaysSwarm;
}

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key: string, value: unknown) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
};

const makeSwarmSummary = (swarm: NowadaysSwarm) => {
    const seeders = [];
    const chokers = [];
    for (const [address, peer] of Object.entries(swarm._peers)) {
        const {wire} = peer;
        if (!wire) {
            chokers.push({address, downloaded: 0});
            continue;
        }
        const {downloaded, peerChoking, peerInterested} = wire;
        const record = {downloaded, address, peerInterested: peerInterested || undefined};
        if (peerChoking) {
            chokers.push(record);
        } else {
            seeders.push(record);
        }
    }
    return {
        downloaded: swarm.downloaded,
        downloadSpeed: swarm.downloadSpeed(),
        seeders: seeders.sort((a,b) => b.downloaded - a.downloaded),
        chokers: chokers.sort((a,b) => b.downloaded - a.downloaded),
        peers: Object.keys(swarm._peers).length,
    };
};

const checkInfoHashMeta = async (rq: http.IncomingMessage) => {
    const {infoHash} = url.parse(<string>rq.url, true).query;
    if (!infoHash || infoHash.length !== 40) {
        throw new Error('Invalid infoHash, must be a 40 characters long hex string');
    }

    const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
    const whenMeta = new Promise<TorrentInfo>(resolve => {
        engine.on('torrent', async (torrent: TorrentMainInfo) => {
            resolve(shortenTorrentInfo(torrent));
        });
    });

    const startedMs = Date.now();
    return timeout(5, whenMeta)
        .then((meta: TorrentInfo) => {
            console.log('ololo meta in ' + ((Date.now() - startedMs) / 1000).toFixed(3) + ' seconds - ' + meta.name);
            return meta;
        })
        .finally(() => engine.destroy());
};

const checkInfoHashPeers = async (rq: http.IncomingMessage) => {
    const {infoHash} = url.parse(<string>rq.url, true).query;
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
    const infoHashToEngine: Record<string, NowadaysEngine> = {};
    const infoHashToWhenReadyEngine: Record<string, Promise<NowadaysEngine>> = {};
    const torrentNamesFts = TorrentNamesFts();

    const prepareTorrentStream = async (infoHash: string, trackers: string[] = []): Promise<NowadaysEngine> => {
        if (!infoHash || infoHash.length !== 40) {
            throw new Error('Invalid infoHash, must be a 40 characters long hex string');
        }
        if (!infoHashToWhenReadyEngine[infoHash]) {
            const magnetLink = 'magnet:?xt=urn:btih:' + infoHash +
                trackers.map(tr => '&tr=' + encodeURIComponent(tr)).join('');
            const engine = torrentStream(magnetLink, {
                verify: false,
                tracker: true,
                trackers: trackers,
            });
            // TODO: clear when no ping for 30 seconds or something
            infoHashToEngine[infoHash] = engine;
            infoHashToWhenReadyEngine[infoHash] = Promise.resolve().then(async () => {
                await new Promise(resolve => engine.on('ready', resolve));
                return engine;
            });
        }
        return infoHashToWhenReadyEngine[infoHash];
    };

    const getFfmpegInfo = async (rq: http.IncomingMessage) => {
        const {infoHash, filePath} = <Record<string, string>>url.parse(<string>rq.url, true).query;
        if (!infoHash || infoHash.length !== 40) {
            throw new BadRequest('Invalid infoHash, must be a 40 characters long hex string');
        } else if (!filePath) {
            throw new BadRequest('filePath parameter is mandatory');
        }
        await prepareTorrentStream(infoHash);
        const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
            infoHash + '&filePath=' + encodeURIComponent(filePath);
        const ffprobeArgs = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', streamUrl];
        let execResult;
        try {
            execResult = await execFile('ffprobe', ffprobeArgs);
        } catch (error) {
            console.error('Ffprobe failed for params:', ffprobeArgs);
            throw error;
        }
        const {stdout, stderr} = execResult;
        return JSON.parse(stdout);
    };

    const connectToSwarm = async (rq: http.IncomingMessage) => {
        const query = url.parse(<string>rq.url, true).query;

        let {infoHash, tr = []} = query;
        tr = !tr ? [] : typeof tr === 'string' ? [tr] : tr;

        if (!infoHash || infoHash.length !== 40) {
            throw new BadRequest('Invalid infoHash, must be a 40 characters long hex string');
        }
        const engine = await prepareTorrentStream(<string>infoHash, tr);
        return {
            files: engine.files.map(shortenFileInfo),
        };
    };

    const getExistingEngine = (rq: http.IncomingMessage) => {
        const query = url.parse(<string>rq.url, true).query;
        let {infoHash} = <Record<string, string>>query;
        if (!infoHash || infoHash.length !== 40) {
            throw new BadRequest('Invalid infoHash, must be a 40 characters long hex string');
        }
        const engine = infoHashToEngine[infoHash] || null;
        if (!engine) {
            throw new TooEarly('Engine must be initialized first');
        }
        return engine;
    };

    const getSwarmInfo = async (rq: http.IncomingMessage) => {
        const engine = getExistingEngine(rq);
        return makeSwarmSummary(engine.swarm);
    };

    const printDetailedSwarmInfo = async (rq: http.IncomingMessage) => {
        const engine = getExistingEngine(rq);
        const {connections, wires, _peers, ...rest} = engine.swarm;
        // change order, as circular replacer makes wires null on first level because they were referenced in connections
        const normalized = {...rest, wires, _peers, connections};
        return JSON.parse(JSON.stringify(normalized, getCircularReplacer()));
    };

    /**
     * sites like rutracker, bakabt, kinozal, etc... require login and password
     * to download torrents, so need to integrate with qbt python plugins
     */
    const downloadTorrentFile = async (rq: http.IncomingMessage) => {
        const {fileUrl} = <Record<string, string>>url.parse(<string>rq.url, true).query;
        const scriptPath = __dirname + '/../../scripts/download_torrent_file.sh';
        const args = [fileUrl];
        let result;
        try {
            result = await execFile(scriptPath, args);
        } catch (exc) {
            const msg = (exc.stderr ? 'STDERR: ' + exc.stderr.trim() + '\n' : '') +
                'Python script failed to retrieve torrent';
            throw new BadGateway(msg);
        }
        const {stdout, stderr} = result;
        const [path, effectiveUrl] = stdout.trim().split(/\s+/);
        if (!effectiveUrl.match(/^https?:\/\//)) {
            const msg = 'Unexpected response from python script,' +
                '\nSTDOUT:\n' + stdout + (stderr.trim() ? 'STDERR:\n' + stderr : '') + '\nno match:\n' +
                fileUrl + '\n' +
                effectiveUrl;
            throw new BadGateway(msg);
        }
        let infoHash;
        let announce: string[] = [];
        // TODO: return announce (tr) from magnet link
        const asMagnet = parseMagnetUrl(path);
        if (asMagnet) {
            infoHash = asMagnet.infoHash;
        } else if (path.match(/^[A-Fa-f0-9]{40}$/)) {
            infoHash = path;
        } else if (path.startsWith('/tmp/')) {
            const torrentFileBuf = await fs.promises.readFile(path);
            let torrentFileData = parseTorrent(torrentFileBuf);
            announce = torrentFileData.announce || [];
            infoHash = torrentFileData.infoHash;
        } else {
            const msg = 'Unexpected downloaded torrent file path format - ' + path;
            throw new NotImplemented(msg);
        }

        return {infoHash, announce};
    };

    const findTorrentsInLocalDb = (req: http.IncomingMessage) => {
        const {userInput} = <Record<string, string>>url.parse(<string>req.url, true).query;
        return torrentNamesFts.select(userInput);
    };

    return {
        checkInfoHashMeta: checkInfoHashMeta,
        checkInfoHashPeers: checkInfoHashPeers,
        getFfmpegInfo: getFfmpegInfo,
        connectToSwarm: connectToSwarm,
        getSwarmInfo: getSwarmInfo,
        printDetailedSwarmInfo: printDetailedSwarmInfo,
        downloadTorrentFile: downloadTorrentFile,
        findTorrentsInLocalDb: findTorrentsInLocalDb,

        qbtv2: Qbtv2(),

        // following not serializable - for internal use only
        prepareTorrentStream: prepareTorrentStream,
        getPreparingStream: (infoHash: string) => infoHashToWhenReadyEngine[infoHash],
    };
};

export default Api;

export type IApi = ReturnType<typeof Api>;

export type IApi_getSwarmInfo_rs = ReturnType<ReturnType<typeof Api>['getSwarmInfo']>;
export type IApi_connectToSwarm_rs = ReturnType<ReturnType<typeof Api>['connectToSwarm']>;
