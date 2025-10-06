import DbPool from "../src/server/utils/DbPool";
import * as SqlUtil from 'klesun-node-tools/src/Utils/SqlUtil.js';
import {InfohashDbRow} from "../src/server/typing/InfohashDbRow";
import TorrentNamesFts from "../src/server/repositories/TorrentNamesFts";
import Infohashes from "../src/server/repositories/Infohashes";
import * as console from "node:console";

const main = async () => {
    const repo = TorrentNamesFts();
    console.log("Deleting old indexes");
    await repo.delete({});
    let i = 0;
    for await (const chunk of Infohashes().selectChunks()) {
        console.log("Chunk #" + i++);
        await repo.insert(chunk.map(r => ({
            infohash: r.infohash,
            name: r.name,
        })));
    }
};

main().then(() => process.exit(0)).catch(error => {
    console.error('Main script failed', error);
    process.exit(1);
});
