import DbPool from "../src/server/utils/DbPool";
import * as SqlUtil from 'klesun-node-tools/src/Utils/SqlUtil.js';
import {InfohashDbRow} from "../src/server/typing/InfohashDbRow";
import TorrentNamesFts from "../src/server/repositories/TorrentNamesFts";

/** @see https://stackoverflow.com/questions/7106016/too-many-sql-variables-error-in-django-with-sqlite3 */
const SQLITE_MAX_VARIABLE_NUMBER = 32766;

const main = async () => {
    const table_Infohashes = 'Infohashes';
    const dbPool_Infohashes = DbPool({
        // make sure it's on ext4 ssd, or write will take several times longer
        filename: __dirname + '/../data/db/' + table_Infohashes + '.sqlite',
    });
    const selectQuery = SqlUtil.makeSelectQuery({table: table_Infohashes});
    const srcRows = await dbPool_Infohashes.withDb(db => {
        return db.all<InfohashDbRow[]>(
            selectQuery.sql, selectQuery.placedValues
        );
    });

    const rows = srcRows.map(r => ({
        infohash: r.infohash,
        name: r.name,
    }));
    const repo = TorrentNamesFts();
    await repo.delete({});
    await repo.insert(rows);
};

main().then(() => process.exit(0)).catch(error => {
    console.error('Main script failed', error);
    process.exit(1);
});
