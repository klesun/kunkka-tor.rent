
type InfohashDbRowBase = {
    infohash: string, // 40 hex chars
    name: string,
    updatedDt: string, // new Date().toISOString(),
    length: number,
    source: string,
    occurrences: number,
    filesCount: number,
}

export type NoFilesInfoSource = 'tpb_dump_2019' | 'rutracker_dump_2020' | 'torrents_csv';

export type InfohashDbRow = InfohashDbRowBase & ({
    source: 'dht_crawler',
    filesCount: number,
} | {
    source: NoFilesInfoSource,
});
