import * as url from 'url';
import * as pump from 'pump'
import * as fsSync from 'fs';
import * as http from "http";
import {IApi} from "./Api";
import {SerialData} from "./TypeDefs";
import { lookup } from 'mime-types'
import Exc from "klesun-node-tools/src/ts/Exc";
import {HTTP_PORT} from "./Constants";
import { Writable } from "stream";
import * as EventEmitter from "events";
import {ReadStream} from "fs";
const {spawn} = require('child_process');
const unzip = require('unzip-stream');
const srt2vtt = require('srt-to-vtt');
const fs = fsSync.promises;

const Rej = require('klesun-node-tools/src/Rej.js');
const {getMimeByExt, removeDots} = require('klesun-node-tools/src/Utils/HttpUtil.js');

export interface HandleHttpParams {
    rq: http.IncomingMessage,
    rs: http.ServerResponse,
    rootPath: string,
    api: IApi,
}

const redirect = (rs: http.ServerResponse, url: string) => {
    rs.writeHead(302, {
        'Location': url,
    });
    rs.end();
};

const setCorsHeaders = (rs: http.ServerResponse) => {
    rs.setHeader('Access-Control-Allow-Origin', '*');
    rs.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    rs.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,pragma,cache-control');
    rs.setHeader('Access-Control-Allow-Credentials', 'true');
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
    const match = range.match(/^bytes=(\d+)-(\d*)/);
    if (!match) {
        throw Exc.BadRequest('Malformed "range" header: ' + range);
    }
    let [_, start, rqEnd] = match.map(n => +n);
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
    const stream: ReadStream = fsSync.createReadStream(absPath, {start, end})
        .on('open', () => stream.pipe(params.rs))
        .on('error', err => {
            console.error('Error while streaming mkv file\n' + absPath + '\n', err);
            params.rs.end(err);
        });
};

async function checkFileExists(path: string) {
    return fs.access(path, fsSync.constants.F_OK)
        .then(() => true)
        .catch(() => false)
}

const getMimeByName = (filePath: string) => {
    const ext = filePath.replace(/^.*\./, '');
    const mime = getMimeByExt(ext);
    if (mime) {
        return mime;
    } else if (ext === 'mp4') {
        return 'video/mp4';
    } else if (ext === 'mkv') {
        return 'video/x-matroska';
    } else if (ext === 'vtt') {
        // rs.setHeader('Content-Type', 'TextTrack');
        return  'text/vtt';
    }
};

const serveStaticFile = async (pathname: string, params: HandleHttpParams) => {
    const {rq, rs, rootPath} = params;
    pathname = decodeURIComponent(pathname);
    let absPath = rootPath + pathname;
    if (absPath.endsWith('/')) {
        absPath += 'index.html';
    }
    if (!(await checkFileExists(absPath))) {
        return Rej.NotFound('File ' + pathname + ' does not exist or not accessible');
    }
    if ((await fs.lstat(absPath)).isDirectory()) {
        return redirect(rs, pathname + '/');
    }
    const mime = getMimeByName(absPath);
    if (mime) rs.setHeader('Content-Type', mime);

    if (['video/x-matroska', 'video/mp4'].includes(mime)) {
        await serveMkv(absPath, params);
    } else {
        fsSync.createReadStream(absPath).pipe(rs);
    }
};

const getFileInTorrent = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath, ...restParams} = <Record<string, string>>url.parse(<string>rq.url, true).query;

    if (!infoHash || infoHash.length !== 40) {
        throw Exc.BadRequest('Invalid infoHash, must be a 40 characters long hex string');
    } else if (!filePath) {
        throw Exc.BadRequest('filePath parameter is mandatory');
    }

    const engine = await api.prepareTorrentStream(infoHash);
    const file = engine.files.find(f => f.path === filePath);
    if (!file) {
        throw Exc.BadRequest('filePath not found in this torrent, possible options: ' + engine.files.map(f => f.path));
    }
    return {file, restParams};
};

const serveTorrentStream = async (params: HandleHttpParams) => {
    const {rq, rs} = params;
    const {file} = await getFileInTorrent(params);

    rs.setHeader('Content-Disposition', `inline; filename=` + JSON.stringify(file.name).replace(/[^ -~]/g, '?'));
    rs.setHeader('Content-Type', lookup(file.name) || 'application/octet-stream');

    rs.setHeader('Accept-Ranges', 'bytes');
    rq.connection.setTimeout(3600000);

    const rangeStr = rq.headers.range || null;
    if (!rangeStr) {
        rs.setHeader('Content-Length', file.length);
        if (rq.method === 'HEAD') {
            return rs.end();
        }
        const stream = file.createReadStream()
            .on('open', () => stream.pipe(rs))
            .on('error', (err: Error) => {
                console.error('Error while reading torrent stream', err);
                rs.end(err + '');
            });
        // mmm, pipeing two times, wth?
        // return;
        return pump(file.createReadStream(), rs);
    }

    const match = rangeStr.match(/^bytes=(\d+)-(\d*)/);
    if (!match) {
        throw Exc.BadRequest('Malformed "range" header: ' + rangeStr);
    }
    let [_, start, end] = match.map(n => +n);
    end = end || file.length - 1;
    rs.statusCode = 206;
    rs.setHeader('Content-Length', end - start + 1);
    rs.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + file.length);
    rs.setHeader('Connection', 'keep-alive');

    if (rq.method === 'HEAD') {
        return rs.end();
    }

    pump(file.createReadStream({start, end}), rs)
};

const serveTorrentStreamEnsureVtt = async (params: HandleHttpParams) => {
    const {rs} = params;
    const {file} = await getFileInTorrent(params);

    rs.setHeader('Content-Length', file.length);
    rs.setHeader('Content-Type', 'text/vtt');
    file.createReadStream()
        .pipe(srt2vtt())
        .pipe(rs);
};

const serveTorrentStreamCodeInH264 = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath} = <Record<string, string>>url.parse(<string>rq.url, true).query;
    await api.prepareTorrentStream(infoHash);
    const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
        infoHash + '&filePath=' + encodeURIComponent(filePath);
    const args = [
        '-i', streamUrl, '-c:v', 'libx264',
        // it's really a big waste to watch high quality videos this way, as both ultrafast and scale
        // affect image quality badly, but rendering in initial quality even for just single user
        // has speed of 0.6 on my pc, and with ffmpeg.js on client side it's 10 times slower
        // maybe should consider integrating with vlc browser extension
         '-preset', 'ultrafast',
        '-vf', 'scale=960:-2,setsar=1:1',
        '-f', 'matroska', '-',
    ];
    console.log('ffmpeg', args.map(a => '"' + a + '"').join(' '));
    const spawned = spawn('ffmpeg', args);
    rs.setHeader('content-type', 'video/x-matroska');
    rs.setHeader('connection', 'keep-alive');
    spawned.stderr.on('data', (buf: Buffer) => {
        if (rs.headersSent) {
            console.log('hevc stderr', buf.toString('utf8'));
        } else {
            rs.setHeader('ffmpeg-stderr', buf.toString('utf8').replace(/[^ -~]/g, '?'));
        }
    });
    rs.on('close', () => spawned.kill());
    spawned.stdout.pipe(rs);
};

const serveTorrentStreamExtractSubs = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath, subsIndex} = <Record<string, string>>url.parse(<string>rq.url, true).query;
    await api.prepareTorrentStream(infoHash);
    const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
        infoHash + '&filePath=' + encodeURIComponent(filePath);
    const args = [
        '-y', '-i', streamUrl, '-map',
        '0:s:' + subsIndex, '-f', 'webvtt', '-',
    ];
    const spawned = spawn('ffmpeg', args);
    spawned.stderr.on('data', (buf: Buffer) => {
        if (rs.headersSent) {
            console.log('subs stderr', buf.toString('utf8'));
        } else {
            rs.setHeader('ffmpeg-stderr', buf.toString('utf8').replace(/[^ -~]/g, '?'));
        }
    });
    rs.on('close', () => spawned.kill());
    spawned.stdout.pipe(rs);
};

const serveTorrentStreamExtractAudio = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath, streamIndex} = <Record<string, string>>url.parse(<string>rq.url, true).query;
    await api.prepareTorrentStream(infoHash);
    const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
        infoHash + '&filePath=' + encodeURIComponent(filePath);
    const args = [
        '-i', streamUrl, '-map', '0:' + streamIndex,
        '-codec:a', 'aac', '-f', 'matroska', '-',
    ];
    const spawned = spawn('ffmpeg', args);
    spawned.stderr.on('data', (buf: Buffer) => {
        if (rs.headersSent) {
            console.log('audio stderr', buf.toString('utf8'));
        } else {
            rs.setHeader('ffmpeg-stderr', buf.toString('utf8').replace(/[^ -~]/g, '?'));
        }
    });
    rs.on('close', () => spawned.kill());
    spawned.stdout.pipe(rs);
};

type UnzipEntry = {
    path: string,
    size: number,
    isDirectory: boolean,
    readable: boolean,
    writable: boolean,
    allowHalfOpen: boolean,
    type: 'File' | 'Directory',

    pipe: (destination: Writable) => EventEmitter.EventEmitter,
    autodrain: () => void,

    _readableState: unknown,
    _events: unknown,
    _writableState: unknown,
    _transformState: unknown,
    _maxListeners: unknown,
    _eventsCount: unknown,
}

const serveZipReader = async (params: HandleHttpParams) => {
    // set timeout to 10 minutes instead of 2 minutes, maybe could make
    // it even more and abort manually if torrent actually hangs...
    params.rq.connection.setTimeout(10 * 60 * 1000);
    const {rs} = params;
    const {file} = await getFileInTorrent(params);
    const readStream = file.createReadStream();

    let started = false;
    const startMs = Date.now();
    rs.setHeader('content-type', 'application/json');
    readStream.pipe(unzip.Parse()).on('entry', (entry: UnzipEntry) => {
        if (!started) {
            rs.statusCode = 200;
            rs.write('[\n');
            started = true;
        }
        const {path, size, isDirectory} = entry;
        if (!isDirectory) {
            rs.write(JSON.stringify({type: 'item', item: {path, size}}) + ',\n');
        }
    }).on('close', () => {
        if (started) {
            // because don't want to mess with comas
            rs.write(JSON.stringify({type: 'end', processingTimeMs: Date.now() - startMs}) + '\n');
            rs.write(']')
        } else {
            rs.statusCode = 424;
        }
        rs.end();
    });
};

const serveZipReaderFile = async (params: HandleHttpParams) => {
    const {rs} = params;
    const {file, restParams: {zippedFilePath}} = await getFileInTorrent(params);
    const readStream = file.createReadStream();

    readStream.pipe(unzip.Parse()).on('entry', (entry: UnzipEntry) => {
        //const {_readableState, _events, _writableState, _transformState, isDirectory, _maxListeners, _eventsCount, readable, writable, allowHalfOpen, type, ...rest} = entry;
        if (entry.path === zippedFilePath) {
            const mime = getMimeByName(zippedFilePath);
            if (mime) rs.setHeader('Content-Type', mime);

            entry.pipe(rs).on('close', () => rs.end());
        } else {
            entry.autodrain();
        }
    }).on('close', () => {
        rs.statusCode = 424;
        rs.end();
    });
};

type Action = (rq: http.IncomingMessage, rs: http.ServerResponse) => Promise<SerialData> | SerialData;
type ActionForApi = (api: IApi) => Action;

const apiController: Record<string, ActionForApi> = {
    '/api/checkInfoHashMeta': api => api.checkInfoHashMeta,
    '/api/checkInfoHashPeers': api => api.checkInfoHashPeers,
    '/api/getFfmpegInfo': api => api.getFfmpegInfo,
    '/api/connectToSwarm': api => api.connectToSwarm,
    '/api/getSwarmInfo': api => api.getSwarmInfo,
    '/api/downloadTorrentFile': api => api.downloadTorrentFile,
    '/api/qbtv2/search/start': api => api.qbtv2.search.start,
    '/api/qbtv2/search/results': api => api.qbtv2.search.results,
};

const HandleHttpRequest = async (params: HandleHttpParams) => {
    const {rq, rs, rootPath, api} = params;
    const parsedUrl = url.parse(<string>rq.url);
    const pathname: string = <string>removeDots(parsedUrl.pathname);

    const actionForApi = apiController[pathname];

    setCorsHeaders(rs);

    if (rq.method === 'OPTIONS') {
        rs.write('CORS ok');
        rs.end();
    } else if (actionForApi) {
        return Promise.resolve()
            .then(() => actionForApi(api)(rq, rs))
            .then(result => {
                rs.setHeader('Content-Type', 'application/json');
                rs.statusCode = 200;
                rs.end(JSON.stringify(result));
            });
    } else if (pathname === '/torrent-stream') {
        return serveTorrentStream(params);
    } else if (pathname === '/torrent-stream-subs-ensure-vtt') {
        return serveTorrentStreamEnsureVtt(params);
    } else if (pathname === '/torrent-stream-code-in-h264') {
        return serveTorrentStreamCodeInH264(params);
    } else if (pathname === '/torrent-stream-extract-subs') {
        return serveTorrentStreamExtractSubs(params);
    } else if (pathname === '/torrent-stream-extract-audio') {
        return serveTorrentStreamExtractAudio(params);
    } else if (pathname === '/api/prepareZipReader') {
        return serveZipReader(params);
    } else if (pathname === '/ftp/zipReaderFile') {
        return serveZipReaderFile(params);
    } else if (pathname.startsWith('/')) {
        return serveStaticFile(pathname, params);
    } else {
        return Rej.BadRequest('Invalid path: ' + pathname);
    }
};

export default HandleHttpRequest;
