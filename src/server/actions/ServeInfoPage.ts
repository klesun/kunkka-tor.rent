
import * as Papaparse from 'papaparse';
import * as fsSync from 'fs';
import Exc from "klesun-node-tools/src/ts/Exc";
import {HandleHttpParams} from "../HandleHttpRequest";

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
        throw Exc.InternalServerError('torrents.csv is empty');
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

const ServeInfoPage = async (params: HandleHttpParams, infoHash: string) => {
    const csvRecord = await getInfohashRecord(infoHash);
    const pageTitle = csvRecord ? csvRecord.name + ' - torrent download' : '🧲 ' + infoHash;
    const htmlRoot = Xml('html', {}, [
        Xml('head', {}, [
            Xml('title', {}, pageTitle),
            Xml('meta', {'charset': 'utf-8'}),
        ]),
        Xml('body', {}, [
            Xml('h2', {}, pageTitle),
            ...!csvRecord ? [] : [
                Xml('div', {}, 'Created At: ' + new Date(+csvRecord.created_unix * 1000).toISOString()),
                Xml('div', {}, 'Scraped At: ' + new Date(+csvRecord.scraped_date * 1000).toISOString()),
            ],
        ]),
    ]);
    params.rs.setHeader('content-type', 'text/html');
    params.rs.write(htmlRoot.toString());
    params.rs.end();
};

export default ServeInfoPage;