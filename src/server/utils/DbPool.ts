import * as sqlite3 from 'sqlite3';
import * as sqlite from 'sqlite';
import { Database } from "sqlite/build/Database";
import ParallelActionsQueue from "./ParallelActionsQueue";

type FsPath = string;

/** @see https://stackoverflow.com/questions/7106016/too-many-sql-variables-error-in-django-with-sqlite3 */
export const SQLITE_MAX_VARIABLE_NUMBER = 32766;

const DbPool = ({ filename, maxConnections = 1 }: {
    filename: ':memory:' | FsPath, maxConnections?: number,
}) => {
    const dbActionQueue = ParallelActionsQueue(maxConnections);
    const connectionsPool = new Set<Database>();

    const openNewDbConnection = (): Promise<Database> => {
        return sqlite.open({
            filename: filename,
            driver: sqlite3.Database,
        });
    };

    const withDbNoLimit = async <T>(
        action: (c: Database) => Promise<T>
    ): Promise<T> => {
        let dbConn: Database;
        if (connectionsPool.size > 0) {
            dbConn = connectionsPool.values().next().value;
            connectionsPool.delete(dbConn);
        } else {
            dbConn = await openNewDbConnection();
        }
        return Promise.resolve(dbConn)
            .then(action)
            .finally(() => {
                connectionsPool.add(dbConn);
            });
    };

    const withDb = <T>(
        action: (c: Database) => Promise<T>
    ): Promise<T> => {
        return dbActionQueue.enqueue(() => withDbNoLimit(action));
    };

    const transactional = async <T>(
        action: (db: Database) => Promise<T>
    ): Promise<T> => {
        return withDb(dbConn => {
            return dbConn.run('BEGIN TRANSACTION;')
                .then(() => action(dbConn))
                .then(async (result) => {
                    await dbConn.run('COMMIT TRANSACTION;');
                    return result;
                })
                .catch(async exc => {
                    await dbConn.run('ROLLBACK TRANSACTION;');
                    throw exc;
                });
        });
    };

    return {
        withDb,
        transactional,
    };
};

type DbPool = ReturnType<typeof DbPool>;

export default DbPool;
