
import * as Papaparse from 'papaparse';
import * as fsSync from 'fs';
import {HandleHttpParams} from "../HandleHttpRequest";
import {InternalServerError} from "@curveball/http-errors";
import Infohashes from "../repositories/Infohashes";
import {InfohashDbRow} from "../typing/InfohashDbRow";

const fs = fsSync.promises;
const Xml = require('klesun-node-tools/src/Utils/Xml.js');

type TorrentsCsvRecord = {
    name: string;
    size_bytes: string;
    created_unix: string;
    seeders: string;
    leechers: string;
    completed: string;
    scraped_date: string;
}

type TorrentsCsvRecordFull = TorrentsCsvRecord & {
    infohash: string;
};

// I have 28 GiB of RAM, so I don't mind keeping whole CSV here... for now at least
const torrentsCsvPath = __dirname + '/../../../node_modules/torrents-csv-data/torrents.csv';
const whenInfoHashToRecord = fs.readFile(torrentsCsvPath, 'utf-8').then(csvText => {
    const parsed = Papaparse.parse(csvText.trim(), {delimiter: ';'});
    const rows = <string[][]>parsed.data;
    const columns = rows.shift();
    if (!columns) {
        throw new InternalServerError('torrents.csv is empty');
    }
    const infohashToRecord: Map<string, TorrentsCsvRecord> = new Map();
    for (const row of rows) {
        const record: TorrentsCsvRecordFull = Object.fromEntries(
            columns.map((col, i: keyof typeof columns) => {
                return [columns[i], row[i]];
            }),
        );
        const {infohash, ...rest} = record;
        infohashToRecord.set(infohash, rest);
    }
    return infohashToRecord;
});
const getInfohashRecord = (infoHash: string) => whenInfoHashToRecord.then(infoHashToRecord => {
    if (infoHashToRecord.has(infoHash)) {
        return infoHashToRecord.get(infoHash);
    } else {
        return undefined;
    }
});

const formatSize = (bytes: number) => {
    const sizeMib = bytes / 1024 / 1024;
    if (sizeMib >= 1024) {
        return (sizeMib / 1024).toFixed(1) + 'GiB';
    } else {
        return sizeMib.toFixed(1) + 'MiB';
    }
};

const escapeHtmlContent = (unsafe: string) => {
    return unsafe
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
};

type NormalizedRecord = {
    name: string,
    updatedDt: string,
    length: number,
    source: string,
    description: string,
};

function normalizeCsvRecord(csvRecord: TorrentsCsvRecord): NormalizedRecord {
    return {
        name: csvRecord.name,
        updatedDt: new Date(+csvRecord.scraped_date * 1000).toISOString(),
        length: Number(csvRecord.size_bytes),
        source: "torrents-csv",
        description: `${formatSize(+csvRecord.size_bytes)} | ${csvRecord.seeders} seeds | ${csvRecord.leechers} leechers | ` + 'Created At: ' + new Date(+csvRecord.created_unix * 1000).toISOString(),
    };
}

function normalizeLocalDbRecord(localDbRecord: InfohashDbRow): NormalizedRecord {
    return {
        name: localDbRecord.name,
        updatedDt: localDbRecord.updatedDt,
        length: localDbRecord.length,
        source: localDbRecord.source,
        description: `Files: ${localDbRecord.filesCount} | DHT Occurrences: ${localDbRecord.occurrences}`,
    };
}

const ServeInfoPage = async (params: HandleHttpParams, infoHash: string) => {
    const whenCsvRecord = getInfohashRecord(infoHash);
    const whenLocalDbRecord = Infohashes().select(infoHash);
    const csvRecord = await whenCsvRecord;
    const localDbRecord = await whenLocalDbRecord;

    const normalized =
        localDbRecord ? normalizeLocalDbRecord(localDbRecord) :
        csvRecord ? normalizeCsvRecord(csvRecord) :
        null;

    const htmlRoot = Xml('html', {}, [
        Xml('head', {}, [
            Xml('title', {}, (normalized ? normalized.name + ' - torrent download/browse | ' : '') +  '🧲 ' + infoHash),
            Xml('meta', {'charset': 'utf-8'}),
            ...!normalized ? [] : [
                Xml('meta', {name: 'description', content: normalized.description}),
                Xml('meta', {property: 'og:description', content: normalized.description}),
            ],
            Xml('link', { rel: 'stylesheet', src: '../infoPage/index.css' }),
        ]),
        Xml('body', {}, [
            Xml('h1', {}, [
                ...!normalized ? [] : [Xml('div', {}, normalized.name)],
                Xml('div', {}, '🧲 ' + infoHash),
            ]),
            ...!normalized ? [] : [
                Xml('div', {}, normalized.description),
                Xml('div', {}, 'Updated At: ' + normalized.updatedDt),
                Xml('div', {}, 'Source: ' + normalized.source),
            ],
            Xml('div', { id: 'react-app-root-container' }),
            `<script id="ssr-data-from-server" type="application/json">
                ${escapeHtmlContent(JSON.stringify({ infoHash }))}
            </script>`,
            Xml('script', { id: 'ssr-data-from-server', type: 'application/json' }, JSON.stringify({ infoHash })),
            Xml('script', { type: 'module', src: '../infoPage/index.js' }),
            Xml('script', { src: 'https://unpkg.com/react@18/umd/react.development.js' }),
            Xml('script', { src: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js' }),
        ]),
    ]);
    params.rs.setHeader('content-type', 'text/html');
    params.rs.write(htmlRoot.toString());
    params.rs.end();
};

export default ServeInfoPage;
