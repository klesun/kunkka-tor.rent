import * as url from 'url';
import * as pump from 'pump';
import * as fsSync from 'fs';
import * as http from "http";
import {IApi} from "./Api";
import {SerialData} from "./TypeDefs";
import { lookup } from 'mime-types'
import {HTTP_PORT} from "./Constants";
import { Writable } from "stream";
import * as EventEmitter from "events";
import {ReadStream} from "fs";
import ServeInfoPage from "./actions/ServeInfoPage";
import {BadRequest, NotFound} from "@curveball/http-errors";
import {readPost} from "./utils/Http";
import ScrapeTrackersSeedInfo, {trackerRecords} from "./actions/ScrapeTrackersSeedInfo";
const {spawn} = require('child_process');
const unzip = require('unzip-stream');
const srt2vtt = require('srt-to-vtt');
const fs = fsSync.promises;

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

/**
 * @param path = '/entry/midiana/../../secret/ololo.pem'
 * @return {String} '/secret/ololo.pem'
 */
const removeDots = (path: string) => {
    const parts = path.split('/');
    const resultParts = [];
    for (const part of parts) {
        if (part === '..' && resultParts.slice(-1)[0] !== '..') {
            while (resultParts.slice(-1)[0] === '.') resultParts.pop();
            if (resultParts.length > 0) {
                resultParts.pop();
            } else {
                resultParts.push('..');
            }
        } else if (part !== '.') {
            resultParts.push(part);
        }
    }
    return resultParts.join('/');
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
        throw new BadRequest('Malformed "range" header: ' + range);
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

const serveStaticFile = async (pathname: string, params: HandleHttpParams) => {
    const {rq, rs, rootPath} = params;
    pathname = decodeURIComponent(pathname);
    let absPath = rootPath + pathname;
    if (absPath.endsWith('/')) {
        absPath += 'index.html';
    }
    if (!(await checkFileExists(absPath))) {
        throw new NotFound('File ' + pathname + ' does not exist or not accessible');
    }
    if ((await fs.lstat(absPath)).isDirectory()) {
        return redirect(rs, pathname + '/');
    }
    const mime = lookup(absPath);
    if (mime) rs.setHeader('Content-Type', mime);

    if (mime && ['video/x-matroska', 'video/mp4'].includes(mime)) {
        await serveMkv(absPath, params);
    } else {
        fsSync.createReadStream(absPath).pipe(rs);
    }
};

function assertValidInfoHash(infoHash: string) {
    if (!infoHash || infoHash.length !== 40 && !infoHash.match(/^[a-zA-Z2-7]{32}$/)) {
        throw new BadRequest('Invalid infoHash, must be a 40 characters long hex string or a 32 characters long base32 string');
    }
}

const getFileInTorrent = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath, ...restParams} = <Record<string, string>>url.parse(<string>rq.url, true).query;

    assertValidInfoHash(infoHash);
    if (!filePath) {
        throw new BadRequest('filePath parameter is mandatory');
    }

    const engine = await api.prepareTorrentStream(infoHash, trackerRecords.map(t => t.url));
    const file = engine.files.find(f => f.path === filePath);
    if (!file) {
        throw new BadRequest('filePath not found in this torrent, possible options: ' + engine.files.map(f => f.path));
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
        throw new BadRequest('Malformed "range" header: ' + rangeStr);
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
        '-c:v', 'hevc_cuvid',
        '-i', streamUrl,
        '-c:v', 'h264_nvenc',
        '-pix_fmt', 'yuv420p', // "10 bit encode not supported"
        '-loglevel', 'verbose',
        '-f', 'matroska', '-',
    ];
    console.log('ffmpeg', args.map(a => '"' + a + '"').join(' '));
    const spawned = spawn('ffmpeg', args);
    rs.setHeader('content-type', 'video/x-matroska');
    rs.setHeader('connection', 'keep-alive');
    let errHeaderIndex = 0;
    spawned.stderr.on('data', (buf: Buffer) => {
        if (rs.headersSent) {
            console.log('hevc stderr', buf.toString('utf8'));
        } else {
            const message = buf.toString('utf8');
            if (!message.startsWith('configuration: ') && !message.startsWith('ffmpeg version ')) {
                const headerName = 'ffmpeg-stderr' + String(errHeaderIndex++).padStart(4, '0');
                rs.setHeader(headerName, message.replace(/[^ -~]/g, '?'));
            }
        }
    });
    rs.on('close', () => spawned.kill());
    spawned.stdout.pipe(rs);
    spawned.on('exit', (code: number) => {
        console.log('ololo hevc conversion exited with ' + code);
        rs.end();
    });
    rq.on('close', () => {
        spawned.kill();
        console.log('ololo hevc convert request closed');
    });
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
            console.log('subs stderr', buf.toString('utf8').replace(/\n.*/s, '...'));
        } else {
            rs.setHeader('ffmpeg-stderr', buf.toString('utf8').replace(/[^ -~]/g, '?'));
        }
    });
    rs.on('close', () => spawned.kill());
    spawned.stdout.pipe(rs);
};

const serveTorrentStreamExtractAudio = async (params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const {infoHash, filePath, streamIndex, codecName} = <Record<string, string>>url.parse(<string>rq.url, true).query;
    rq.connection.setTimeout(3600000);
    await api.prepareTorrentStream(infoHash);
    const streamUrl = 'http://localhost:' + HTTP_PORT + '/torrent-stream?infoHash=' +
        infoHash + '&filePath=' + encodeURIComponent(filePath);
    const args = [
        '-i', streamUrl, '-map', '0:' + streamIndex,
        '-codec:a', 'aac',
        '-f', 'matroska', '-',
    ];
    const ffmpeg = spawn('ffmpeg', args);
    rs.on('close', () => ffmpeg.kill());
    ffmpeg.stderr.on('data', (buf: Buffer) => {
        if (rs.headersSent) {
            console.log('audio stderr', buf.toString('utf8'));
        } else {
            rs.setHeader('ffmpeg-stderr', buf.toString('utf8').replace(/[^ -~]/g, '?'));
        }
    });
    rs.setHeader('Accept-Ranges', 'bytes');
    rs.setHeader('Content-Disposition', `inline; filename=` + JSON.stringify(filePath.replace(/^.*\//, '')).replace(/[^ -~]/g, '?'));
    rs.setHeader('Content-Type', 'video/x-matroska');
    const range = params.rq.headers.range || null;
    if (!range) {
        // requested to download full file rather than stream a part of it. Sure, why not
        ffmpeg.stdout.pipe(rs);
        return;
    }
    const match = range.match(/^bytes=(\d+)-(\d*)/);
    if (!match) {
        throw new BadRequest('Malformed "range" header: ' + range);
    }
    let [_, start, rqEnd] = match.map(n => +n);

    let chunkSize = 517299744;
    if (rqEnd) {
        chunkSize = Math.min(chunkSize, rqEnd - start + 1);
    }
    rs.statusCode = 206;
    // apparently, to make timeline navigation work you have to specify range max value even if it is a stream without known length, so, as a workaround, I just put 10 GiB as the range size, by the time client reaches the end of streamed audio, he will either just receive an EOF or will just disregard this request as he is already done watching the video
    rs.setHeader('Content-Range', 'bytes ' + start + '-9999999998/9999999999');
    rs.setHeader('Connection', 'keep-alive');

    const tail = spawn('tail', ['-c', `+${start}`]);
    const head = spawn('head', ['-c', `${chunkSize}`]);
    rs.on('close', () => tail.kill());
    rs.on('close', () => head.kill());
    ffmpeg.stdout.pipe(tail.stdin);
    tail.stdout.pipe(head.stdin);
    head.stdout.pipe(rs);
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

const serveStreamedApiResponse = async <TItem>(
    res: http.ServerResponse,
    itemsIter: AsyncGenerator<TItem>,
) => {
    let started = false;
    const startMs = Date.now();
    try {
        for await (const item of itemsIter) {
            if (!started) {
                res.setHeader('content-type', 'application/json');
                res.statusCode = 200;
                res.write('[\n');
                started = true;
            }
            res.write(JSON.stringify({type: 'item', item}) + ',\n');
        }
    } catch (error: unknown) {
        if (started) {
            res.write(JSON.stringify({
                type: 'end',
                processingTimeMs: Date.now() - startMs,
                error: String(error),
            }) + '\n');
            res.write(']')
        } else {
            throw error;
        }
    }
    if (started) {
        // because don't want to mess with comas
        res.write(JSON.stringify({type: 'end', processingTimeMs: Date.now() - startMs}) + '\n');
        res.write(']')
    } else {
        res.statusCode = 424;
    }
    res.end();
};

type ZipItem = {path: string, size: number} | null;

const serveZipReader = async (params: HandleHttpParams) => {
    // set timeout to 10 minutes instead of 2 minutes, maybe could make
    // it even more and abort manually if torrent actually hangs...
    params.rq.connection.setTimeout(10 * 60 * 1000);
    const {file} = await getFileInTorrent(params);
    const readStream = file.createReadStream();

    const itemsIter = async function*() {
        const emitter: EventEmitter.EventEmitter = readStream.pipe(unzip.Parse());

        let resolve: (item: ZipItem) => void;
        let promise = new Promise<ZipItem>(r => resolve = r);

        emitter
            .on('entry', (entry: UnzipEntry) => {
                const {path, size, isDirectory} = entry;
                if (!isDirectory) {
                    resolve({path, size});
                    promise = new Promise(r => resolve = r);
                    entry.autodrain();
                }
            })
            .on('close', () => resolve(null));

        for (let item; item = await promise;) {
            yield item;
        }
    }();
    return serveStreamedApiResponse(params.rs, itemsIter);
};

const serveListDirectory = async (params: HandleHttpParams) => {
    const {rq, rs} = params;
    const {path} = <Record<string, string>>url.parse(<string>rq.url, true).query;
    const dir = await fs.opendir(path);
    const itemsIter = async function*() {
        for await (const dirent of dir) {
            let isDirectory;
            if (dirent.isDirectory()) {
                isDirectory = true;
            } else if (dirent.isFile()) {
                isDirectory = false;
            } else {
                continue; // symlinks and stuff
            }
            yield {
                isDirectory,
                name: dirent.name,
            };
        }
    }();
    return serveStreamedApiResponse(rs, itemsIter);
};

const scrapeTrackersSeedInfo = async (params: HandleHttpParams) => {
    const postStr = await readPost(params.rq);
    const {torrents}: {torrents: {infohash: string}[]} = JSON.parse(postStr);
    /** should probably cache retrieved seeds data eventually */
    const itemsIter = ScrapeTrackersSeedInfo(torrents.map(t => t.infohash));
    return serveStreamedApiResponse(params.rs, itemsIter);
};

const serveZipReaderFile = async (params: HandleHttpParams) => {
    const {rs} = params;
    const {file, restParams: {zippedFilePath}} = await getFileInTorrent(params);
    const readStream = file.createReadStream();

    readStream.pipe(unzip.Parse()).on('entry', (entry: UnzipEntry) => {
        //const {_readableState, _events, _writableState, _transformState, isDirectory, _maxListeners, _eventsCount, readable, writable, allowHalfOpen, type, ...rest} = entry;
        if (entry.path === zippedFilePath) {
            const mime = lookup(zippedFilePath);
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

const apiRouter: Record<string, ActionForApi> = {
    '/api/checkInfoHashMeta': api => api.checkInfoHashMeta,
    '/api/checkInfoHashPeers': api => api.checkInfoHashPeers,
    '/api/getFfmpegInfo': api => api.getFfmpegInfo,
    '/api/connectToSwarm': api => api.connectToSwarm,
    '/api/getSwarmInfo': api => api.getSwarmInfo,
    '/api/printDetailedSwarmInfo': api => api.printDetailedSwarmInfo,
    '/api/downloadTorrentFile': api => api.downloadTorrentFile,
    '/api/findTorrentsInLocalDb': api => api.findTorrentsInLocalDb,
    '/api/qbtv2/search/start': api => api.qbtv2.search.start,
    '/api/qbtv2/search/results': api => api.qbtv2.search.results,
};

const HandleHttpRequest = async (params: HandleHttpParams) => {
    const {rq, rs, rootPath, api} = params;
    const parsedUrl = url.parse(<string>rq.url);
    if (!parsedUrl.pathname) {
        throw new BadRequest("Missing pathname in requested URL");
    }
    const pathname: string = <string>removeDots(parsedUrl.pathname);

    const actionForApi = apiRouter[pathname];

    setCorsHeaders(rs);

    let match;
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
    } else if (pathname === '/api/scrapeTrackersSeedInfo') {
        return scrapeTrackersSeedInfo(params);
    } else if (pathname === '/api/prepareZipReader') {
        return serveZipReader(params);
    } else if (pathname === '/ftp/zipReaderFile') {
        return serveZipReaderFile(params);
    } else if (pathname === '/api/listDirectory') {
        return serveListDirectory(params);
    } else if (match = (
        pathname.match(/^\/views\/infoPage\/([a-fA-F0-9]{40})$/) ?? // hex
        pathname.match(/^\/views\/infoPage\/([a-zA-Z2-7]{32})$/) // base32
    )) {
        const infoHash = match[1];
        return ServeInfoPage(params, infoHash);
    } else {
        return serveStaticFile(pathname, params);
    }
};

export default HandleHttpRequest;
