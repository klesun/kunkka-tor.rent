import DbPool, {SQLITE_MAX_VARIABLE_NUMBER} from "../utils/DbPool";
import {InfohashDbRow} from "../typing/InfohashDbRow";
import * as SqlUtil from 'klesun-node-tools/src/Utils/SqlUtil.js';

const Infohashes = () => {
    const table = 'Infohashes';
    const dbPool = DbPool({
        filename: __dirname + '/../../../data/db/' + table + '.sqlite',
    });
    return {
        insert: async (rows: InfohashDbRow[]) => {
            const rowsPerBatch = Math.floor(
                SQLITE_MAX_VARIABLE_NUMBER /
                Object.keys(rows[0]).length
            );

            await dbPool.withDb(async db => {
                for (let i = 0; i < rows.length; i += rowsPerBatch) {
                    console.log('Inserting hashes batch from: ' + i);
                    const insertQuery = SqlUtil.makeInsertQuery({
                        table, insertType: 'replace', rows: rows.slice(i, i + rowsPerBatch),
                    });
                    await db.run(insertQuery.sql, ...insertQuery.placedValues);
                }
            });
        },
        select: async (infohash: string) => {
            // language=sqlite
            const sql = `SELECT * FROM Infohashes WHERE infohash = ?`;
            const placedValues = [infohash];
            return dbPool.withDb<InfohashDbRow | undefined>(
                db => db.get<InfohashDbRow>(sql, ...placedValues)
            );
        },
    };
};

export default Infohashes;