import * as url from 'url';
import * as fsSync from 'fs';
import * as http from "http";
import * as parseTorrent from 'parse-torrent';

const fs = fsSync.promises;

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

const Api = {
    routes: {
        '/api/testTorrentInfo': async rq => {
            const magnetLink = 'magnet:?xt=urn:btih:241fa42d67355718c9dd71e6f0b5b2459d77361e&dn=Steven.Universe.The.Movie.2019.720p.WEBRip.NewStation.mkv&tr=http%3A%2F%2Fbt01.nnm-club.cc%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce&tr=http%3A%2F%2Fbt01.nnm-club.info%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce&tr=http%3A%2F%2Fretracker.local%2Fannounce.php%3Fsize%3D1515809210%26comment%3Dhttp%253A%252F%252Fnnmclub.to%252Fforum%252Fviewtopic.php%253Fp%253D10413891%26name%3D%25C2%25F1%25E5%25EB%25E5%25ED%25ED%25E0%25FF%2B%25D1%25F2%25E8%25E2%25E5%25ED%25E0%253A%2B%25D4%25E8%25EB%25FC%25EC%2B%252F%2BSteven%2BUniverse%253A%2BThe%2BMovie%2B%25282019%2529%2BWEBRip%2B%2B%255BH.264%252F720p-LQ%255D%2B%2528MVO%2529&tr=http%3A%2F%2F%5B2001%3A470%3A25%3A482%3A%3A2%5D%3A2710%2Fffffffffd18150cb8e66c02d6822c1f0%2Fannounce';
            return parseTorrent(magnetLink);
        },
        '/api/testTorrentStream': async rq => {

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
