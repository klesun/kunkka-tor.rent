
import * as fs from "fs/promises";
import * as console from "node:console";
import { JSDOM } from "jsdom";
import { Stats } from "fs";
import Infohashes from "../src/server/repositories/Infohashes";
import {InfohashDbRow} from "../src/server/typing/InfohashDbRow";

const ROOT_FOLDER_PATH = __dirname + "/../data/nyaa_si_scrapes";

function neverNull(message?: string): never {
    throw new Error("Unexpected null value: " + message);
}

type Fields = {
    "Category": "Anime - Raw",
    "Date": "2008-06-23 03:24 UTC",
    "Submitter": "NyaaTorrents",
    "Seeders": "0",
    "Information": "irc://irc.irchighway.net/maximumt",
    "Leechers": "1",
    "File size": "700.0 MiB",
    "Completed": "0",
    "Info hash": "b9119799b668cc175816c765bb249a18fdac9ff1"
};

function parseRows(rows: Element[]) {
    const fields: Record<string, string> = {};
    for (const row of rows) {
        const cells = [...row.children];
        for (let i = 0; i < cells.length; i += 2) {
            const [k, v] = cells.slice(i);
            const key = k.textContent?.trim().replace(/:$/, "") ?? neverNull("key");
            const value = v.textContent?.trim() ?? neverNull("value");
            fields[key] = value;
        }
    }
    const typed = fields as Fields;
    return {
        category: typed.Category || neverNull("Seeders"),
        createdDt: typed.Date || neverNull("Seeders"),
        submitter: typed.Submitter || neverNull("Seeders"),
        seeders: Number(typed.Seeders || neverNull("Seeders")),
        leechers: Number(typed.Leechers || neverNull("Leechers")),
        fileSize: typed["File size"],
        downloads: Number(typed.Completed || neverNull("Completed")),
    };
}

function parseNyaaSiPage(document: Document) {
    const anchors = [...document.querySelectorAll("a[href]")];
    let infoHash: string | null = null;
    for (const anchor of anchors) {
        const href = anchor.getAttribute("href") ?? neverNull("href");
        const match = href.match(/^magnet:\?(.+)$/);
        if (match) {
            const searchParams = new URLSearchParams(match[1]);
            const xt = searchParams.get("xt") ?? neverNull("xt");
            const xtMatch = xt.match(/^urn:btih:([0-9a-f]{40})$/) ?? neverNull("urn:btih:");
            infoHash = xtMatch[1];
            break;
        }
    }
    const description = document.getElementById("torrent-description")?.textContent?.trim() ?? neverNull("torrent-description");
    const rows = document.querySelectorAll(".panel-body > .row");
    return {
        infoHash: infoHash ?? neverNull("infoHash"),
        name: document.querySelector("h3.panel-title")?.textContent?.trim() ?? neverNull("panel-title"),
        description: description,
        fields: parseRows([...rows]),
    };
}

type ParsedNyaaSiPage = ReturnType<typeof parseNyaaSiPage>;

const chunkFolderNames = await fs.readdir(ROOT_FOLDER_PATH);
const chunkFolders = chunkFolderNames
    .map(folderName => {
        const [startId, endId] = folderName.split("_").map(id => Number(id));
        return { folderName, startId, endId };
    })
    .sort((a,b) => a.startId - b.startId);

const infohashes = Infohashes();

/** @param fileSize = "589.1 TiB" | "589.1 MiB" | "2.4 GiB" | "0 Bytes" | "123 KiB" */
function parseFileSize(fileSize: string) {
    const [, number, magnitude] = fileSize.match(/^(\d*\.?\d+)\s*(MiB|KiB|GiB|TiB|Bytes)$/) ?? neverNull(fileSize);
    const multiplier = {
        "Bytes": 1,
        "KiB": 1024,
        "MiB": 1024 * 1024,
        "GiB": 1024 * 1024 * 1024,
        "TiB": 1024 * 1024 * 1024 * 1024,
    }[magnitude] ?? neverNull(magnitude);

    return Math.round(Number(number) * multiplier);
}

function prepareRow(parsed: ParsedNyaaSiPage, stats: Stats, nyaaId: number): InfohashDbRow {
    return {
        infohash: parsed.infoHash,
        name: parsed.name,
        length: parseFileSize(parsed.fields.fileSize),
        occurrences: 1,
        source: "nyaa_si",
        updatedDt: stats.birthtime.toISOString(),
        filesCount: null,
        trackerData_json: JSON.stringify({
            ...parsed.fields,
            descrLink: "https://nyaa.si/view/" + nyaaId,
            description: parsed.description,
        }),
    };
}

function is404(document: Document) {
    return document.querySelector("h1")?.textContent?.trim() === "404 Not Found";
}

const NEXT_ID = 590092;

let i = 0;
let unflushedRows: InfohashDbRow[] = [];

for (const { folderName, startId, endId } of chunkFolders) {
    if (endId < NEXT_ID) {
        continue;
    }
    const folderPath = ROOT_FOLDER_PATH + "/" + folderName;
    const htmlFileNames = await fs.readdir(folderPath);
    for (const htmlFileName of htmlFileNames) {
        const filePath = folderPath + "/" + htmlFileName;
        const nyaaId = Number(htmlFileName.replace(/\.html$/, ""));
        if (nyaaId < NEXT_ID) {
            continue;
        }
        if (i++ % 50 === 0) {
            console.log("Processing #" + i + ": " + filePath);
        }
        if (i % 1000 === 0) {
            console.log("Flushing at " + nyaaId);
            await infohashes.insert(unflushedRows);
            unflushedRows = [];
        }
        try {
            const stats = await fs.stat(filePath);
            const fileContent = await fs.readFile(filePath, "utf-8");
            const dom = new JSDOM(fileContent);
            if (is404(dom.window.document)) {
                console.info("Skipping 404 at " + nyaaId);
                continue;
            }
            const parsed = parseNyaaSiPage(dom.window.document);
            unflushedRows.push(prepareRow(parsed, stats, nyaaId));
        } catch (error) {
            console.error("Error at " + nyaaId);
            throw error;
        }
    }
}
await infohashes.insert(unflushedRows);

console.log(chunkFolders);