
import * as fsSync from 'fs';
import * as readline from 'readline';
import {InfohashDbRow} from "../src/server/typing/InfohashDbRow";
import Infohashes from "../src/server/repositories/Infohashes";

type RecordBase = {
    infohash: string,
    name: string,
};

type SingeFileRecord = RecordBase & {
    length: number,
};

type ManyFilesRecord = RecordBase & {
    files: {
        path: string,
        length: number,
    }[],
};

type DhtRecord = (SingeFileRecord | ManyFilesRecord) & {
    occurrences: number,
};

const saveToArchiveDb = async (records: DhtRecord[]) => {
    const rows = records.map((r): InfohashDbRow => ({
        infohash: r.infohash,
        name: r.name,
        updatedDt: new Date().toISOString(),
        length: 'length' in r ? r.length :
            r.files.map(r => r.length).reduce((a, b) => a + b),
        source: 'dht_crawler',
        occurrences: r.occurrences,
        filesCount: 'files' in r ? r.files.length : 1,
    }));
    await Infohashes().insert(rows);
};

/** @see https://github.com/shiyanhui/dht */
const main = async () => {
    const dhtOutPath = __dirname + '/../kunkka_host/handmaide/random/kunkka_big_data/shiyanhui_dht_out.txt';
    const fileStream = fsSync.createReadStream(dhtOutPath);

    const linesStream = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const infohashToOccurrences = new Map<string, number>();
    let infohashToRecord = new Map<string, DhtRecord>();
    let i = 0;
    for await (const line of linesStream) {
        if (!line.trim()) {
            continue;
        }
        ++i;
        if (i % 10000 === 0) {
            console.log(i, line);
            const records = [...infohashToRecord.values()];
            await saveToArchiveDb(records);
            infohashToRecord = new Map();
        }
        const record: DhtRecord | DhtRecord[] = JSON.parse(line);
        const records: DhtRecord[] = Array.isArray(record) ? record : [record];
        for (const record of records) {
		  if (!record.length && !record.files) {
			console.log('Parasha at ' + i + ' - ' + line);
			continue;
		  }
          const occurrences = (infohashToOccurrences.get(record.infohash) ?? 0) + 1;
		  infohashToOccurrences.set(record.infohash, occurrences);
		  record.occurrences = occurrences;
          infohashToRecord.set(record.infohash, record);
        }
    }
    console.log('total hashes: ' + i);
};

main().then(() => process.exit(0)).catch(error => {
    console.error('Main script failed', error);
    process.exit(1);
});

