import DbPool, { SQLITE_MAX_VARIABLE_NUMBER } from "../utils/DbPool";
import type { InfohashDbRow } from "../typing/InfohashDbRow";
import * as SqlUtil from "klesun-node-tools/src/Utils/SqlUtil.js";
import type { Database } from "sqlite";
import type { ParsedNyaaSiPage } from "../../../scripts/parse_nyaa_si_scrapes";

function neverNull(): never {
    throw new Error("Unexpected null value");
}

const ENDED = Symbol("ENDED");
type ENDED = typeof ENDED;

function initExecState<TRow>(): {
    bufferedResults: TRow[],
    bufferOffset: number,
    error: unknown,
    status: "RUNNING" | "DONE" | "ERROR",
} {
    return {
        bufferedResults: [],
        bufferOffset: 0,
        status: "RUNNING",
        error: undefined,
    };
}

type State<TRow> = ReturnType<typeof initExecState<TRow>>;

const tryResolve = <TRow>(state: State<TRow>): Promise<IteratorResult<TRow>> | null => {
    if (state.bufferOffset < state.bufferedResults.length) {
        return Promise.resolve({
            done: false,
            value: state.bufferedResults[state.bufferOffset++],
        });
    }
    switch (state.status) {
        case "ERROR": return Promise.reject(state.error);
        case "DONE": return Promise.resolve({
            done: true,
            value: undefined,
        });
        case "RUNNING": return null;
    }
};

export class ExecSqlError extends Error {
    constructor(public cause: Error | unknown, public sql: string, public parameters: unknown[]) {
        super("SQL execution failed: " + String(cause), { cause });
    }
}

const selectMany = async function<TRow>(db: Database, selectSql: string, placedValues: unknown[]) {
    const state = initExecState<TRow>();
    let updateListener: null | ((value?: unknown) => void) = null;

    let resolveDone: (result: { rowCount: number }) => void;
    let rejectDone: (error: unknown) => void;
    const whenDone = new Promise<{ rowCount: number }>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
    });
    // preventing unhandled promise rejection if an error takes place (like connection getting closed),
    // but iteration is interrupted prematurely (like if you did return or break after the first row)
    whenDone.catch(() => {});

    db.each<TRow>(selectSql, ...placedValues, (err: unknown, row: TRow) => {
        if (err) {
            state.status = "ERROR";
            state.error = new ExecSqlError(err, selectSql, placedValues);
            rejectDone(state.error);
            return;
        }
        state.bufferedResults.push(row);
        if (updateListener) {
            updateListener();
        }
    }).then(rowCount => resolveDone({ rowCount }), rejectDone).finally(() => {
        if (updateListener) {
            updateListener();
        }
    });

    const rowsIterator: AsyncIterator<TRow> & AsyncIterable<TRow> = {
        async next(): Promise<IteratorResult<TRow>> {
            if (updateListener) {
                throw new Error("Tried to iterate over an iterator that was already iterating");
            }
            const resolved = tryResolve<TRow>(state);
            if (resolved) {
                return resolved;
            }
            await new Promise((resolve) => updateListener = resolve);
            updateListener = null;
            return tryResolve(state) ?? await Promise.reject(new Error(
                "Unexpected state: updateListener was invoked, but no update took place"
            ));
        },
        [Symbol.asyncIterator]() {
            return rowsIterator;
        },
    };
    const rowsGenerator: AsyncGenerator<TRow> = (async function*(rowsIterator) {
        yield * rowsIterator;
    })(rowsIterator);

    return rowsGenerator;
};

type TrackerData = Partial<ParsedNyaaSiPage["fields"]>;

function deserialize(dbRow: InfohashDbRow) {
    const { trackerData_json, ...scalar } = dbRow;
    const trackerData: TrackerData | null = !trackerData_json ? null : JSON.parse(trackerData_json);
    return { ...scalar, trackerData };
}

export type AppInfohash = ReturnType<typeof deserialize>;

const Infohashes = () => {
    const table = "Infohashes";
    const dbPool = DbPool({
        filename: __dirname + "/../../../data/db/" + table + ".sqlite",
    });

    return {
        insert: async (rows: InfohashDbRow[]) => {
            if (rows.length === 0) {
                return;
            }
            const rowsPerBatch = Math.floor(
                SQLITE_MAX_VARIABLE_NUMBER /
                Object.keys(rows[0]).length
            );

            await dbPool.withDb(async db => {
                for (let i = 0; i < rows.length; i += rowsPerBatch) {
                    const insertQuery = SqlUtil.makeInsertQuery({
                        table, insertType: "replace", rows: rows.slice(i, i + rowsPerBatch),
                    });
                    await db.run(insertQuery.sql, ...insertQuery.placedValues);
                }
            });
        },
        selectOne: async (infohash: string) => {
            // language=sqlite
            const sql = `SELECT * FROM Infohashes WHERE infohash = ?`;
            const placedValues = [infohash];
            const dbRow = await dbPool.withDb<InfohashDbRow | undefined>(
                db => db.get<InfohashDbRow>(sql, ...placedValues)
            );
            if (!dbRow) {
                return undefined;
            } else {
                return deserialize(dbRow);
            }
        },
        selectIn: async (infohashes: string[]): Promise<InfohashDbRow[]> => {
            if (infohashes.length === 0) {
                return [];
            }
            const sql = `
                SELECT * FROM Infohashes 
                WHERE infohash IN (${infohashes.map(_ => "?").join(",")})
            `;
            const dbRows = await dbPool.withDb(
                db => db.all<InfohashDbRow[]>(sql, ...infohashes)
            );
            return dbRows.map(deserialize);
        },
        selectChunks: async function*() {
            const CHUNK_SIZE = 200000;
            // language=sqlite
            const selectSql = `SELECT *, rowid FROM Infohashes WHERE rowid > ? ORDER BY rowid LIMIT ?`;
            let lastId = 0;
            while (true) {
                // const generator = await dbPool.withDb(async (db) => {
                //     return selectMany(db, selectSql, [lastId, CHUNK_SIZE]);
                // });
                const chunk = await dbPool.withDb(async (db) => {
                    return db.all(selectSql, [lastId, CHUNK_SIZE]);
                });
                if (chunk.length > 0) {
                    yield chunk.map(deserialize);
                    lastId = chunk[chunk.length - 1].rowid;
                } else {
                    break;
                }
            }
        },
    };
};

export default Infohashes;