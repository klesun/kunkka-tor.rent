import { neverNull } from "../../node_modules/@mhc/utils/src/typing.ts";
import type { AppInfohash } from "../server/repositories/Infohashes";
import type { JsonStringified, JsonValue, Pathname } from "@mhc/utils/types/utility";
import type { IApi_connectToSwarm_rs, IApi_getSwarmInfo_rs } from "../server/Api.ts";
import type { QbtSearchResult } from "./QbtSearch";
import type { FfprobeOutput } from "./FfprobeOutput";
import { get, makeGetUrl, postWwwForm } from "./ApiUntyped";

export type api_findTorrentsInLocalDb_DbRow = AppInfohash;

type GetParams = Record<string, string | number | string[] | number[]>;

type IterItem<T extends JsonValue> = { type: "item", item: T };

const extractFromByteArray = <T extends JsonValue>(byteArray: Uint8Array) => {
    const lines = new TextDecoder("utf-8").decode(byteArray).split("\n");
    const remainderStr = lines.pop(); // incomplete or ending "]"
    const items = lines.flatMap(line => {
        // allow rubbish in between the lines, also covers starting "[" and ending "]"
        // I'd love to make it more strict, but I'm too lazy
        const match = line.match(/^\s*({.*}),$/);
        return match ? [match[1] as JsonStringified<IterItem<T>>] : [];
    }).map(entryJson => JSON.parse<IterItem<T>>(entryJson)).flatMap(entry => {
        // other types are reserved for meta info, like how much more
        // data left if known, some header information about the list, etc...
        return entry.type === "item" ? [entry.item] : [];
    });
    const remainder = new TextEncoder().encode(remainderStr);
    return { items, remainder };
};

const extractCompleteItems = function*<T extends JsonValue>(parts: Uint8Array[]) {
    let prefix = new Uint8Array(0);
    let part;
    while (part = parts.shift()) {
        const joined = new Uint8Array(prefix.length + part.length);
        joined.set(prefix);
        joined.set(part, prefix.length);
        const { items, remainder } = extractFromByteArray<T>(joined);
        for (const item of items) {
            yield item;
        }
        prefix = remainder;
    }
    if (prefix.length > 0) {
        parts.unshift(prefix);
    }
};

const parseAsyncIterResponse = async function*<T extends JsonValue>(rs: Response) {
    const body = rs.body ?? neverNull("missing body field in response");
    const reader = body.getReader();
    /** @type {Uint8Array[]} */
    const parts = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        parts.push(value);
        for (const item of extractCompleteItems<T>(parts)) {
            yield item;
        }
    }
};

const getAsyncIter = <T extends JsonValue>(
    route: Pathname, params: GetParams | null = null
): Promise<AsyncGenerator<T>> => {
    const url = makeGetUrl(route, params);
    return fetch(url)
        .then(parseAsyncIterResponse<T>);
};

const postAsyncIter = <T extends JsonValue>(
    route: Pathname, params: JsonValue | null = null
): Promise<AsyncGenerator<T>> => {
    const url = makeGetUrl(route);
    return fetch(url, {
        method: "POST",
        body: JSON.stringify(params),
    }).then(parseAsyncIterResponse<T>);
};

const Api = () => {
    return {
        listDirectory: (params: GetParams) => getAsyncIter("/api/listDirectory", params),
        getFfmpegInfo: (params: { infoHash: string, filePath: string }) => get<FfprobeOutput>("/api/getFfmpegInfo", params),
        /**
         * tr is list of tracker web addresses
         */
        connectToSwarm: (params: { infoHash: string, tr: string[] }) => get<IApi_connectToSwarm_rs>("/api/connectToSwarm", params),
        getSwarmInfo: (params: { infoHash: string }) => get<IApi_getSwarmInfo_rs>("/api/getSwarmInfo", params),
        /**
         * retrieves torrent file by link from a private resource that requires my credentials
         */
        downloadTorrentFile: (params: { fileUrl: string }) => get<{ infoHash: string, announce: string[] }>("/api/downloadTorrentFile", params),
        prepareZipReader: (params: { infoHash: string, filePath: string }) => getAsyncIter<{ path: string, size: number }>("/api/prepareZipReader", params),
        scrapeTrackersSeedInfo: (params: { torrents: { infohash: string }[] }) => postAsyncIter<{
            seeders: number,
            completed: number,
            leechers: number,
            infohash: string,
            trackerUrl: string,
        }>("/api/scrapeTrackersSeedInfo", params),

        /** @see https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-torrent-list */
        qbtv2: {
            search: {
                /**
                 * @see https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-search-results
                 */
                results: (params: {
                    id: number,
                    limit: number,
                    offset: number,
                }) => postWwwForm<QbtSearchResult>("/api/qbtv2/search/results", params),
            },
        },
    };
};

export default Api;
