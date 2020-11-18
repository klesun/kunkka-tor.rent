
const parseResponse = rs => rs.status !== 200
    ? Promise.reject(rs.statusText)
    : rs.json();

/** @param {Uint8Array} byteArray */
const extractFromByteArray = (byteArray) => {
    const lines = new TextDecoder("utf-8").decode(byteArray).split('\n');
    const remainderStr = lines.pop(); // incomplete or ending "]"
    const items = lines.flatMap(line => {
        // allow rubbish in between the lines, also covers starting "[" and ending "]"
        // I'd love to make it more strict, but I'm too lazy
        const match = line.match(/^\s*({.*}),$/);
        return match ? [match[1]] : [];
    }).map(entryJson => JSON.parse(entryJson)).flatMap(entry => {
        // other types are reserved for meta info, like how much more
        // data left if known, some header information about the list, etc...
        return entry.type === 'item' ? [entry.item] : [];
    });
    const remainder = new TextEncoder("utf-8").encode(remainderStr);
    return {items, remainder};
};

/** @param {Uint8Array[]} parts */
const extractCompleteItems = function*(parts) {
    let prefix = new Uint8Array(0);
    let part;
    while (part = parts.shift()) {
        const joined = new Uint8Array(prefix.length + part.length);
        joined.set(prefix);
        joined.set(part, prefix.length);
        const {items, remainder} = extractFromByteArray(joined);
        for (const item of items) {
            yield item;
        }
        prefix = remainder;
    }
    if (prefix.length > 0) {
        parts.unshift(prefix);
    }
};

/** @param {Response} rs */
const parseAsyncIterResponse = async function*(rs) {
    const reader = rs.body.getReader();
    /** @type {Uint8Array[]} */
    const parts = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        parts.push(value);
        for (const item of extractCompleteItems(parts)) {
            yield item;
        }
    }
};

const makeGetUrl = (route, params = null) => {
    const entries = !params ? [] : Object.entries(params)
        .flatMap(
            ([k,v]) => !Array.isArray(v)
                ? [[k, v]]
                : v.map(subV => [k, subV])
        );
    const queryPart = !params ? '' :
        '?' + new URLSearchParams(entries);
    return route + queryPart;
};

const get = (route, params = null) => {
    const url = makeGetUrl(route, params);
    return fetch(url)
        .then(parseResponse);
};

const getAsyncIter = (route, params = null) => {
    const url = makeGetUrl(route, params);
    return fetch(url)
        .then(parseAsyncIterResponse);
};

const post = (route, params) => {
    return fetch(route, {
        method: 'POST',
        body: JSON.stringify(params),
    }).then(parseResponse);
};

const postWwwForm = (route, params) => {
    return fetch(route, {
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        'body': new URLSearchParams(params).toString(),
        'method': 'POST',
    }).then(parseResponse);
};

const Api = () => {
    return {
        /**
         * @param {{infoHash: string, filePath: string}} params
         * @return {Promise<FfprobeOutput>}
         */
        getFfmpegInfo: params => get('/api/getFfmpegInfo', params),
        /**
         * tr is list of tracker web addresses
         * @param {{infoHash: string, tr: string[]}} params
         * @return {IApi_getSwarmInfo_rs}
         */
        getSwarmInfo: params => get('/api/getSwarmInfo', params),
        /**
         * retrieves torrent file by link from a private resource that requires my credentials
         * @param {{fileUrl: string}} params
         * @return {Promise<{infoHash: string, announce: string[]}>}
         */
        downloadTorrentFile: params => get('/api/downloadTorrentFile', params),

        /**
         * @param {{infoHash: string, filePath: string}} params
         * @return {Promise<AsyncGenerator<{path: string, size: number}>>}
         */
        prepareZipReader: params => getAsyncIter('/api/prepareZipReader', params),

        /** @see https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-torrent-list */
        qbtv2: {
            search: {
                /**
                 * @see https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#start-search
                 * @param {{
                 *     pattern: string,
                 *     plugins: 'all' | string,
                 *     category: 'all' | string,
                 * }} params
                 * @return {Promise<{id: number}>}
                 */
                start: params => postWwwForm('/api/qbtv2/search/start', params),
                /**
                 * @see https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-search-results
                 * @param {{
                 *     id: number,
                 *     limit: number,
                 *     offset: number,
                 * }} params
                 * @return {Promise<QbtSearchResult>}
                 */
                results: params => postWwwForm('/api/qbtv2/search/results', params),
            },
        },
    };
};

export default Api;