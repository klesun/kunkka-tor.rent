
import {promises as fs} from 'fs';
import * as Papa from 'papaparse';
import {InfohashDbRow, NoFilesInfoSource} from "../src/server/typing/InfohashDbRow";
import DbPool from "../src/server/utils/DbPool";
import * as SqlUtil from 'klesun-node-tools/src/Utils/SqlUtil.js';

/** @see https://stackoverflow.com/a/39460727/2750743 */
function base64ToHex(str: string) {
    return Buffer.from(str, 'base64').toString('hex');
}

/** @see https://stackoverflow.com/questions/7106016/too-many-sql-variables-error-in-django-with-sqlite3 */
const SQLITE_MAX_VARIABLE_NUMBER = 32766;
// const SQLITE_MAX_VARIABLE_NUMBER = 999;

const addFromCsv = async (csvPath: string, source: NoFilesInfoSource) => {
    const table = 'Infohashes';
    const dbPool = DbPool({
        // make sure it's on ext4 ssd, or write will take several times longer
        filename: __dirname + '/../data/db/' + table + '.sqlite',
    });
    const csvText = await fs.readFile(csvPath, 'utf8');
    const parsed = Papa.parse<[string, string, string, string]>(csvText.trim(), {delimiter: ';'});
    const csvRows = parsed.data;
    csvRows.shift(); // #ADDED;HASH(B64);NAME;SIZE(BYTES)
    const dbRows = csvRows.map((values): InfohashDbRow => {
        const [addedDt, infohashBase64, name, size] = values;
        return {
            name: name,
            updatedDt: addedDt,
            occurrences: 1,
            infohash: base64ToHex(infohashBase64),
            length: +size,
            source: source,
        };
    });
    const rowsPerBatch = Math.floor(
        SQLITE_MAX_VARIABLE_NUMBER /
        Object.keys(dbRows[0]).length
    );

    await dbPool.withDb(async db => {
        for (let i = 0; i < dbRows.length; i += rowsPerBatch) {
            const insertQuery = SqlUtil.makeInsertQuery({
                table, insertType: 'replace', rows: dbRows.slice(i, i + rowsPerBatch),
            });
            const startMs = Date.now();
            await db.run(insertQuery.sql, ...insertQuery.placedValues);
            console.log('Inserted hashes batch from: ' + i + ' in ' + (Date.now() - startMs) + ' ms');
        }
    });
};

const main = async () => {
    const tpbCsvPaths = [
        __dirname + '/../node_modules/piratebay-db-dump/piratebay_db_dump_2004_03_25T22_03_00_to_2015_10_27T04_10_22.csv',
        __dirname + '/../node_modules/piratebay-db-dump/piratebay_db_dump_2015_10_27T04_10_50_to_2019_09_14T22_09_31.csv'
    ];
    const rutrackerCsvPaths = [
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_2.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_8.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_9.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_10.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_11.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_18.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_19.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_20.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_22.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_23.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_24.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_25.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_26.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_28.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_29.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_31.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_33.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_34.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_35.csv',
        __dirname + '/../node_modules/piratebay-db-dump/rutracker_2020_09_27/category_37.csv',
    ];
    const csvPaths = [
        // ...tpbCsvPaths.map(csvPath => ({csvPath, source: 'tpb_dump_2019' as const})),
        ...rutrackerCsvPaths.map(csvPath => ({csvPath, source: 'rutracker_dump_2020' as const})),
    ];


    for (const {csvPath, source} of csvPaths) {
        await addFromCsv(csvPath, source);
    }
};

main().then(() => process.exit(0)).catch(error => {
    console.error('Main script failed', error);
    process.exit(1);
});
