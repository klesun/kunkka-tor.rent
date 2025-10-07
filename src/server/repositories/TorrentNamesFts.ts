import DbPool, {SQLITE_MAX_VARIABLE_NUMBER} from "../utils/DbPool";
import {UntabledQueryBase} from "klesun-node-tools/src/Utils/SqlUtil";
import * as SqlUtil from 'klesun-node-tools/src/Utils/SqlUtil.js';

export type DbRow = {
    infohash: string,
    name: string,
};

const TorrentNamesFts = () => {
    const table = 'TorrentNamesFts';
    const dbPool = DbPool({
        filename: __dirname + '/../../../data/db/' + table + '.sqlite',
    });
    return {
        delete: async (params: UntabledQueryBase) => {
            const {sql, placedValues} = SqlUtil
                .makeDeleteQuery({ ...params, table });
            return dbPool.withDb(async db => {
                return db.run(sql, placedValues);
            });
        },
        insert: async (rows: DbRow[]) => {
            const rowsPerBatch = Math.floor(
                SQLITE_MAX_VARIABLE_NUMBER /
                Object.keys(rows[0]).length
            );
            await dbPool.withDb(async db => {
                for (let i = 0; i < rows.length; i += rowsPerBatch) {
                    console.log('Inserting FTS batch from: ' + i);
                    const insertQuery = SqlUtil.makeInsertQuery({
                        table, insertType: 'insertNew', rows: rows.slice(i, i + rowsPerBatch),
                    });
                    await db.run(insertQuery.sql, ...insertQuery.placedValues);
                }
            });
        },
        select: async (userInput: string): Promise<DbRow[]> => {
            const escapedInput = userInput
                .split(' ')
                // eventually could recognize the "" in user's query as _exact match_ like in google
                .map(w => w.split('').map(c => c === '"' ? '""' : c).join(''))
                .map(w => '"' + w + '"')
                .join(' ');
            const sql = `SELECT * FROM ${table} WHERE name MATCH ? LIMIT 1000`;
            const placedValues = [escapedInput];
            return dbPool.withDb<DbRow[]>(
                db => db.all<DbRow[]>(sql, ...placedValues)
            );
        },
    };
};

export default TorrentNamesFts;
