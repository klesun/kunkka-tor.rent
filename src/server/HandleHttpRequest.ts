import * as url from 'url';
import * as fsSync from 'fs';
import * as http from "http";
import * as parseTorrent from 'parse-torrent';

const fs = fsSync.promises;
const torrentStream = require('torrent-stream');

const Rej = require('klesun-node-tools/src/Rej.js');
const {getMimeByExt, removeDots, setCorsHeaders} = require('klesun-node-tools/src/Utils/HttpUtil.js');

export interface HandleHttpParams {
    rq: http.IncomingMessage,
    rs: http.ServerResponse,
    rootPath: string,
}

const redirect = (rs: http.ServerResponse, url: string) => {
    rs.writeHead(302, {
        'Location': url,
    });
    rs.end();
};

/** see https://stackoverflow.com/a/24977085/2750743 */
const serveMkv = async (absPath: string, params: HandleHttpParams) => {
    // probably only needed on the first request
    const stats = await fs.stat(absPath);
    const range = params.rq.headers.range || null;
    if (!range) {
        // requested to download full file rather than stream a part of it. Sure, why not
        fsSync.createReadStream(absPath).pipe(params.rs);
        return;
    }
    let [_, start, rqEnd] = range.match(/^bytes=(\d+)-(\d*)/).map(n => +n);
    const total = stats.size;
    rqEnd = rqEnd || total - 1;
    // I take it that this works as a buffering size...
    const chunkSize = Math.min(rqEnd - start + 1, 4 * 1024 * 1024);
    const end = start + chunkSize - 1;
    params.rs.writeHead(206, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
    });
    const stream = fsSync.createReadStream(absPath, {start, end})
        .on('open', () => stream.pipe(params.rs))
        .on('error', err => {
            console.error('huj err ', err);
            params.rs.end(err);
        });
};

const serveStaticFile = async (pathname: string, params: HandleHttpParams) => {
    const {rq, rs, rootPath} = params;
    pathname = decodeURIComponent(pathname);
    let absPath = rootPath + pathname;
    if (absPath.endsWith('/')) {
        absPath += 'index.html';
    }
    if (!fsSync.existsSync(absPath)) {
        return Rej.NotFound('File ' + pathname + ' does not exist');
    }
    if ((await fs.lstat(absPath)).isDirectory()) {
        return redirect(rs, pathname + '/');
    }
    const ext = absPath.replace(/^.*\./, '');
    const mime = getMimeByExt(ext);
    if (mime) {
        rs.setHeader('Content-Type', mime);
    } else if (ext === 'mp4') {
        rs.setHeader('Content-Type', 'video/mp4');
    } else if (ext === 'mkv') {
        rs.setHeader('Content-Type', 'video/x-matroska');
    } else if (ext === 'vtt') {
        // rs.setHeader('Content-Type', 'TextTrack');
        rs.setHeader('Content-Type', 'text/vtt');
    }
    if (['mkv', 'mp4'].includes(ext)) {
        await serveMkv(absPath, params);
    } else {
        fsSync.createReadStream(absPath).pipe(rs);
    }
};

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

const Api = {
    routes: {
        '/api/testTorrentInfo': async rq => {
            const magnetLink = 'magnet:?xt=urn:btih:241fa42d67355718c9dd71e6f0b5b2459d77361e&dn=Steven.Universe.The.Movie.2019.720p.WEBRip.NewStation.mkv&tr=http%3A%2F%2Fbt01.nnm-club.cc%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce&tr=http%3A%2F%2Fbt01.nnm-club.info%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce&tr=http%3A%2F%2Fretracker.local%2Fannounce.php%3Fsize%3D1515809210%26comment%3Dhttp%253A%252F%252Fnnmclub.to%252Fforum%252Fviewtopic.php%253Fp%253D10413891%26name%3D%25C2%25F1%25E5%25EB%25E5%25ED%25ED%25E0%25FF%2B%25D1%25F2%25E8%25E2%25E5%25ED%25E0%253A%2B%25D4%25E8%25EB%25FC%25EC%2B%252F%2BSteven%2BUniverse%253A%2BThe%2BMovie%2B%25282019%2529%2BWEBRip%2B%2B%255BH.264%252F720p-LQ%255D%2B%2528MVO%2529&tr=http%3A%2F%2F%5B2001%3A470%3A25%3A482%3A%3A2%5D%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce';
            return parseTorrent(magnetLink);
        },
        '/api/testTorrentStream': async rq => {
        },
        '/api/checkInfoHashMeta': async rq => {
            const {infoHash} = url.parse(rq.url, true).query;
            if (!infoHash || infoHash.length !== 40) {
                throw new Error('Invalid infoHash, must be a 40 characters long hex string');
            }

            const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
            const whenMeta = new Promise(resolve => {
                engine.on('torrent', async (torrent) => {
                    resolve({
                        name: torrent.name,
                        length: torrent.length,
                        files: torrent.files.map(f => ({
                            path: f.path, length: f.length,
                        })),
                    });
                });
            });

            const startedMs = Date.now();
            return limitTime(5, whenMeta)
                .then(meta => {
                    console.log('ololo meta in ' + ((Date.now() - startedMs) / 1000).toFixed(3) + ' seconds - ' + meta.name);
                    return meta;
                })
                .finally(() => engine.destroy());
        },
        '/api/checkInfoHashPeers': async rq => {
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
        },
    },
};

const HandleHttpRequest = async (params: HandleHttpParams) => {
    const {rq, rs, rootPath} = params;
    const parsedUrl = url.parse(<string>rq.url);
    const pathname: string = removeDots(parsedUrl.pathname);

    const apiAction = Api.routes[pathname];

    setCorsHeaders(rs);

    if (rq.method === 'OPTIONS') {
        rs.write('CORS ok');
        rs.end();
    } else if (apiAction) {
        return Promise.resolve(rq)
            .then(apiAction)
            .then(result => {
                rs.setHeader('Content-Type', 'application/json');
                rs.statusCode = 200;
                rs.end(JSON.stringify(result));
            });
    } else if (pathname.startsWith('/')) {
        return serveStaticFile(pathname, params);
    } else {
        return Rej.BadRequest('Invalid path: ' + pathname);
    }
};

export default HandleHttpRequest;
