/**
 * @typedef {import("./Api").GetParams} GetParams
 * @typedef {import("@mhc/utils/types/utility").Pathname} Pathname
 * @typedef {import("@mhc/utils/types/utility").JsonValue} JsonValue
 */

export const BACKEND_BASE_URL = "";
// export const BACKEND_BASE_URL = "https://torrent.klesun.net";

/**
 * @template {JsonValue<undefined>} T
 * @param {Response} rs
 * @return {Promise<T>}
 */
export const parseResponse = async function(rs) {
    if (rs.status !== 200) {
        throw new Error(rs.statusText);
    } else {
        /** @type {T} */
        const data = await rs.json();
        return data;
    }
}

/**
 * @param {GetParams} params
 * @return {URLSearchParams}
 */
export const buildUrlSearchParams = (params) => {
    const entries = !params ? [] : Object.entries(params)
        .flatMap(
            ([k,v]) => !Array.isArray(v)
                ? [[k, String(v)]]
                : v.map((subV) => [k, String(subV)])
        );
    return new URLSearchParams(entries);
};

/**
 * @param {Pathname} route
 * @param {GetParams | null} params
 * @return {string}
 */
export const makeGetUrl = (route, params = null) => {
    const queryPart = !params ? "" :
        "?" + buildUrlSearchParams(params);
    return BACKEND_BASE_URL + route + queryPart;
};

/**
 * @template {JsonValue<undefined>} T
 * @param {Pathname} route
 * @param {GetParams | null} params
 * @return {Promise<T>}
 */
export const get = (route, params = null) => {
    const url = makeGetUrl(route, params);
    return fetch(url)
        .then(parseResponse);
};

/**
 * @template {JsonValue} T
 * @param {Pathname} route
 * @param {GetParams} params
 * @return {T}
 */
export const postWwwForm = (route, params) => {
    return fetch(BACKEND_BASE_URL + route, {
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        // I think if we remove this toString() then content-type header won't be necessary - need to test
        "body": buildUrlSearchParams(params).toString(),
        "method": "POST",
    }).then(parseResponse);
};

const ApiUntyped = () => {
    return {
        /**
         * @param {{userInput: string}} params
         * @return {Promise<api_findTorrentsInLocalDb_DbRow[]>}
         */
        findTorrentsInLocalDb: params => get('/api/findTorrentsInLocalDb', params),

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
            },
        },
    };
};

export default ApiUntyped;