
const parseResponse = rs => rs.status !== 200
    ? Promise.reject(rs.statusText)
    : rs.json();

const get = (route, params = null) => {
    const queryPart = !params ? '' :
        '?' + new URLSearchParams(params);
    return fetch(route + queryPart)
        .then(parseResponse);
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
         * @param {{infoHash: string}} params
         * @return {IApi_getSwarmInfo_rs}
         */
        getSwarmInfo: params => get('/api/getSwarmInfo', params),
        /**
         * retrieves torrent file by link from a private resource that requires my credentials
         * @param {{fileUrl: string}} params
         * @return {Promise<{infoHash: string}>}
         */
        downloadTorrentFile: params => get('/api/downloadTorrentFile', params),

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