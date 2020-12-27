import {IApi} from "../Api";
import TorrentFile = TorrentStream.TorrentFile;

const torrentStream = require('torrent-stream');
const {timeout} = require('klesun-node-tools/src/Lang.js');

type BaseItemStatus = {
    infoHash: string,
    status: string,
    msWaited: number,
};

export type ItemStatus = BaseItemStatus & ({
    status: 'ERROR',
    message: string,
} | {
    status: 'META_AVAILABLE',
    metaInfo: TorrentInfo,
} | {
    status: 'SWARM_UPDATE',
    swarmInfo: {
        seederWires: number,
        otherWires: number,
        peers: number,
    },
} | {
    status: 'TIMEOUT',
});

export const shortenFileInfo = (f: TorrentFile): ShortTorrentFileInfo => ({
    path: f.path, length: f.length,
});

export type TorrentMainInfo = {
    name: string,
    length: number,
    files: TorrentFile[],
}

export const shortenTorrentInfo = (torrent: TorrentMainInfo) => ({
    name: torrent.name,
    length: torrent.length,
    files: torrent.files.map(shortenFileInfo),
});

export type TorrentInfo = ReturnType<typeof shortenTorrentInfo>;
type ShortTorrentFileInfo = {
    path: string,
    length: number,
};

const MAX_META_WAIT_SECONDS = 45;

const ScanInfoHashStatus = ({infoHashes, itemCallback, api}: {
    infoHashes: string[],
    itemCallback: (status: ItemStatus) => void,
    api: IApi,
}) => {
    for (const infoHash of infoHashes) {
        if (!infoHash.match(/^[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid info hash format - ' + infoHash);
        }
    }

    // TODO: chunk, network starts queueing them when
    //  you schedule real big amount, like 600 at once
    for (const infoHash of infoHashes) {
        const startedMs = Date.now();
        // const whenEngine = api.getPreparingStream(infoHash);
        // if (whenEngine) {
        //     whenEngine.then(engine => {
        //         const metaInfo = shortenTorrentInfo({
        //             name: 'huj',
        //             length: engine.files.map(f => f.length).reduce((a, b) => a + b, 0),
        //             files: engine.files,
        //         });
        //         itemCallback({
        //             infoHash: infoHash,
        //             status: 'META_AVAILABLE',
        //             msWaited: (Date.now() - startedMs),
        //             metaInfo: metaInfo,
        //         });
        //     });
        //     continue;
        // }

        const engine = torrentStream('magnet:?xt=urn:btih:' + infoHash);
        const whenMeta = new Promise<TorrentInfo>(resolve => {
            engine.on('torrent', async (torrent: TorrentMainInfo) => {
                resolve(shortenTorrentInfo(torrent));
            });
        });
        timeout(MAX_META_WAIT_SECONDS, whenMeta)
            .then((metaInfo: TorrentInfo) => {
                itemCallback({
                    infoHash: infoHash,
                    status: 'META_AVAILABLE',
                    msWaited: (Date.now() - startedMs),
                    metaInfo: metaInfo,
                });
            })
            .catch((exc: {httpStatusCode: number}|object|string|number|undefined|boolean|null) => {
                if (exc && typeof exc === 'object' && 'httpStatusCode' in exc && exc.httpStatusCode === 408) {
                    itemCallback({
                        infoHash: infoHash,
                        status: 'TIMEOUT',
                        msWaited: (Date.now() - startedMs),
                    });
                } else {
                    itemCallback({
                        infoHash: infoHash,
                        status: 'ERROR',
                        msWaited: (Date.now() - startedMs),
                        message: exc + '',
                    });
                }
            })
            .finally(() => engine.destroy());
    }
};

export default ScanInfoHashStatus;