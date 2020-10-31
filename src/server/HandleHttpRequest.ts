import * as url from 'url';
import * as pump from 'pump'
import * as fsSync from 'fs';
import * as http from "http";
import {IApi} from "./Api";
import {SerialData} from "./TypeDefs";
import { lookup } from 'mime-types'
const torrentStream = require('torrent-stream');
const {timeout} = require('klesun-node-tools/src/Lang.js');

const fs = fsSync.promises;

const Rej = require('klesun-node-tools/src/Rej.js');
const {getMimeByExt, removeDots, setCorsHeaders} = require('klesun-node-tools/src/Utils/HttpUtil.js');

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

const serveTorrentStream = async (infoHash: string, params: HandleHttpParams) => {
    const {rq, rs, api} = params;
    const engine = await api.prepareTorrentStream(infoHash);
    const file = engine.files[0];
    rs.setHeader('Content-Disposition', `inline; filename=` + JSON.stringify(file.name));
    rs.setHeader('Content-Type', lookup(file.name) || 'application/octet-stream');

    rs.setHeader('Accept-Ranges', 'bytes');
    rq.connection.setTimeout(3600000);

    const rangeStr = rq.headers.range || null;
    if (!rangeStr) {
        rs.setHeader('Content-Length', file.length - 1);
        if (rq.method === 'HEAD') {
            return rs.end();
        }
        const stream = file.createReadStream()
            .on('open', () => stream.pipe(rs))
            .on('error', err => {
                console.error('huj err ', err);
                rs.end(err);
            });
        // return;
        return pump(file.createReadStream(), rs);
    }

    let [_, start, end] = rangeStr.match(/^bytes=(\d+)-(\d*)/).map(n => +n);
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

type Action = (rq: http.IncomingMessage) => Promise<SerialData> | SerialData;
type ActionForApi = (api: IApi) => Action;

const apiController: Record<string, ActionForApi> = {
    '/api/checkInfoHashMeta': api => api.checkInfoHashMeta,
    '/api/checkInfoHashPeers': api => api.checkInfoHashPeers,
    '/api/getFfmpegInfo': api => api.getFfmpegInfo,
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
        return Promise.resolve(rq)
            .then(actionForApi(api))
            .then(result => {
                rs.setHeader('Content-Type', 'application/json');
                rs.statusCode = 200;
                rs.end(JSON.stringify(result));
            });
    } else if (pathname.startsWith('/torrent-stream/')) {
        const infoHash = pathname.slice('/torrent-stream/'.length);
        // BA0B39DE2C19CEADCFB1B441D8B6D668E57458EF
        if (infoHash.length !== 40) {
            return Rej.BadRequest('Invalid infohash: ' + infoHash);
        }
        return serveTorrentStream(infoHash, params);
    } else if (pathname.startsWith('/')) {
        return serveStaticFile(pathname, params);
    } else {
        return Rej.BadRequest('Invalid path: ' + pathname);
    }
};

export default HandleHttpRequest;
