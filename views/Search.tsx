import type { api_findTorrentsInLocalDb_DbRow } from "../src/client/Api.js";
import Api from "../src/client/Api.js";
import TorrentNameParser from "../src/common/TorrentNameParser.js";
import type {
    QbtSearchResult, QbtSearchResultItem,
    QbtSearchResultItemExtended,
    QbtSearchResultItemFromLocalDb
} from "../src/client/QbtSearch";
import { parseMagnetUrl } from "../src/common/Utils.js";

const { React } = window;
const { useEffect, useState, useMemo } = React;

/** I'd question their honesty in the claimed seed numbers */
const suspiciousSites = ["https://eztv.io", "https://1337x.to", "https://limetor.com", "https://www.limetorrents.lol", "https://torrentproject2.se"];

/** not updating seeders information for years, but at least numbers look realistic, just outdated */
const stagnantSites = ["https://bakabt.me", "https://zooqle.com", ...suspiciousSites];
/** updating seeders info constantly, I think on every request (you can easily distinguish them: the seed amounts are around 10-20, not 100-500) */
const liveSeedUpdateSites = ["https://nyaa.si", "https://rutracker.org", "https://nnmclub.to/forum/", "https://rarbg.to"];

const SIZE_RANGE_CODES = {
    "less-than-1mb": Math.pow(10, 6), // a text-only book
    "1mb-10mb": Math.pow(10, 7), // a set of books or a single mp3 song
    "10mb-100mb": Math.pow(10, 8), // a flac song
    "100mb-500mb": 5 * Math.pow(10, 8), // a soundtrack or all volumes of a medium length manga
    "500mb-2gb": 2 * Math.pow(10, 9), // unencoded anime episode
    "2gb-10gb": Math.pow(10, 10), // a season of an anime
    "10gb-100gb": Math.pow(10, 11), // an ak movie or all seasons of a long-running anime
    "more-than-100gb": Infinity,
};

const SIZE_RANGES = Object.keys(SIZE_RANGE_CODES);

const getSizeDecimalCategory = (bytes: number): keyof typeof SIZE_RANGE_CODES => {
    for (const [code, size] of Object.entries(SIZE_RANGE_CODES)) {
        if (bytes < size) {
            return code as keyof typeof SIZE_RANGE_CODES;
        }
    }
    return "more-than-100gb";
};

function neverNull(message?: string): never {
    throw new Error("Unexpected null value: " + message);
}

const api = Api();

const getInfoHashNow = (resultItem: QbtSearchResultItemExtended): { infoHash: string, tr: string[] } | null => {
    const asMagnet = resultItem.fileUrl.match(/^magnet:\?(.+)$/);
    if (asMagnet) {
        const magnetQueryPart = asMagnet[1];
        const search = new URLSearchParams(magnetQueryPart);
        const infoHash = search.get("xt")?.replace(/^urn:btih:/, "")?.toLowerCase() || neverNull();
        const tr = search.getAll("tr");
        return { infoHash, tr };
    } else if (resultItem.infoHash) {
        return { infoHash: resultItem.infoHash.toLowerCase(), tr: [] };
    } else if (resultItem.infoHash) {
        return { infoHash: resultItem.infoHash.toLowerCase(), tr: [] };
    } else {
        return null;
    }
};

const getInfoHash = async (resultItem: QbtSearchResultItemExtended): Promise<{ infoHash: string, tr: string[] }> => {
    const now = getInfoHashNow(resultItem);
    if (now) {
        return now;
    } else {
        const torrentFileData = await api.downloadTorrentFile({ fileUrl: resultItem.fileUrl });
        return {
            infoHash: torrentFileData.infoHash,
            tr: torrentFileData.announce,
        };
    }
};

/** @deprecated I guess, better use more consistent decimal grouping */
const makeSizeTd = (fileSize: number) => {
    const classes = ["torrent-size"];
    let content;
    if (fileSize <= 0) {
        content = fileSize;
        classes.push("invalid-size");
    } else {
        const sizeMb = fileSize / 1000 / 1000;
        if (sizeMb >= 1000) {
            content = (sizeMb / 1000).toFixed(1) + "GiB";
        } else {
            content = sizeMb.toFixed(1) + "MiB";
        }
    }
    return <td className={classes.join(" ")}>{content}</td>;
};

function getRowKey(record: QbtSearchResultItemExtended) {
    const infoHash = getInfoHashNow(record)?.infoHash;
    if (infoHash) {
        return "infoHash_" + infoHash;
    } else {
        return "fileUrl_" + record.fileUrl;
    }
}

function isPoorQualityRecording(resultItem: QbtSearchResultItemExtended) {
    // TS = TeleSync - camera recording from theater
    return resultItem.fileName.match(/\b(?:HD|)TS\b/);
}

function ResultRow(props: {
    record: QbtSearchResultItemExtended | QbtSearchResultItemFromLocalDb,
    scrape: Scrape | undefined,
    index: number,
}) {
    const resultItem = props.record;

    const [infoHash, setInfoHash] = useState<string>();
    const [infoHashError, setInfoHashError] = useState<Error | unknown>();

    useEffect(() => {
        getInfoHash(resultItem).then(
            ({ infoHash }) => setInfoHash(infoHash),
            setInfoHashError
        );
    }, []);

    const seedsSuspicious = stagnantSites.includes(resultItem.siteUrl);

    const openAnchor = <a
        target="_blank"
        className="open-infohash"
        href={!infoHash ? undefined : "./infoPage/" + infoHash.toLowerCase()}
        onClick={infoHash ? undefined : () => alert(
            infoHashError ? String(infoHashError) :
                "Infohash is loading. Try again in few seconds."
        )}
    >
        <button>Open</button>
    </a>;
    const downloadAnchor = <a href={resultItem.fileUrl}>
        {infoHash || resultItem.fileUrl.replace(/^https?:\/\/[^\/?]*/, "")}
    </a>;

    return <tr
        data-media-type={resultItem.mediaType}
        data-size-decimal-category={getSizeDecimalCategory(resultItem.fileSize)}
    >
        <td>{props.index}</td>
        <td>{openAnchor}</td>
        <td className={"torrent-file-name" + (isPoorQualityRecording(resultItem) ? " poor-quality-recording" : "")}>{resultItem.fileName}</td>
        <td>{resultItem.mediaType}</td>
        {makeSizeTd(resultItem.fileSize)}
        <td className="leechers-number">{resultItem.nbLeechers}</td>
        <td className={`seeders-number${seedsSuspicious ? " suspicious-seeds" : ""}`}>
            <span className="live-seeds-holder" title={!props.scrape ? undefined : JSON.stringify(props.scrape)}>{props.scrape?.seeders ?? ""}</span>
            <span className="stored-seeds-holder" title={"asLocalDbRecord" in props.record ? props.record.asLocalDbRecord.updatedDt : undefined}>
                {seedsSuspicious ? "(≖_≖)" : ""}
                {resultItem.nbSeeders}
            </span>
        </td>
        <td className="infohash">{downloadAnchor}</td>
        <td>
            <a href={resultItem.descrLink}>{resultItem.tracker}</a>
        </td>
    </tr>;
}

type Scrape = {
    seeders: string | number,
    leechers: string | number,
    completed: string | number,
};

type ComparisonObject = {
    stored: QbtSearchResultItemExtended,
    scrape?: null | Scrape,
};

const isStagnant = (object: ComparisonObject) => {
    return suspiciousSites.includes(object.stored.siteUrl);
};

const compareObjects = (a: ComparisonObject, b: ComparisonObject) => {
    if (isStagnant(a) && !isStagnant(b)) {
        return -1;
    }
    if (!isStagnant(a) && isStagnant(b)) {
        return 1;
    }
    const aSeeders = a.scrape?.seeders ?? a.stored.nbSeeders;
    const bSeeders = b.scrape?.seeders ?? b.stored.nbSeeders;
    if (+aSeeders !== +bSeeders) {
        return +aSeeders - +bSeeders;
    }
    const aLeechers = a.scrape?.leechers ?? a.stored.nbLeechers;
    const bLeechers = b.scrape?.leechers ?? b.stored.nbLeechers;
    if (+aLeechers !== +bLeechers) {
        return +aLeechers - +bLeechers;
    }
    const aCompleted = a.scrape?.completed ?? "0";
    const bCompleted = b.scrape?.completed ?? "0";
    if (+aCompleted !== +bCompleted) {
        return +aCompleted - +bCompleted;
    }
    return 0;
};

function toLowerCase<T extends string>(value: T): Lowercase<T> {
    return value.toLowerCase() as Lowercase<T>;
}

const compare = (
    a: QbtSearchResultItemExtended,
    b: QbtSearchResultItemExtended,
    infoHashToScrape: InfoHashToScrape
) => {
    const tryGetScrape = (record: QbtSearchResultItemExtended) => {
        const infoHash = getInfoHashNow(record);
        if (!infoHash) {
            return null;
        }
        return infoHashToScrape.get(toLowerCase(infoHash.infoHash));
    };
    return -compareObjects(
        { stored: a, scrape: tryGetScrape(a) },
        { stored: b, scrape: tryGetScrape(b) },
    );
};

/**
 * this wrapper isolates function body to ensure that you will not
 * forget to list some of the accessed dependencies by mistake
 */
const useMemoSafe = <const TDeps extends readonly unknown[], TResult>(
    computer: (...deps: readonly [...TDeps]) => TResult,
    dependencies: TDeps
) => {
    return React.useMemo(() => {
        return computer(...dependencies);
    }, dependencies);
};

type InfoHashToScrape = ReadonlyMap<Lowercase<string>, Scrape>;

function computeMergedRecords(
    localResults: api_findTorrentsInLocalDb_DbRow[],
    qbtvResults: QbtSearchResultItem[],
    infoHashToScrape: InfoHashToScrape,
) {
    const normalizedFromLocalDb = localResults.map((record): QbtSearchResultItemFromLocalDb => ({
        asLocalDbRecord: record,
        infoHash: record.infohash,
        descrLink: "https://torrent.klesun.net/views/infoPage/" + record.infohash,
        fileName: record.name,
        fileSize: record.length,
        fileUrl: "magnet:?xt=urn:btih:" + record.infohash,
        nbLeechers: record.trackerData?.leechers ?? 0,
        nbSeeders: record.trackerData?.seeders ?? 1,
        siteUrl:
            record.source === "nyaa_si" ? "https://nyaa.si" :
            record.source === "tpb_dump_2019" ? "https://thepiratebay.org" :
            record.source === "rutracker_dump_2020" ? "https://rutracker.org" :
            record.source === "dht_crawler" ? "https://btdig.com/" :
            "https://torrent.klesun.net",
        tracker: record.source,
        mediaType: TorrentNameParser({ name: record.name }).parts[0].mediaType,
    }));

    const normalizedFromQbtv = qbtvResults.map((r): QbtSearchResultItemExtended => {
        const tracker = r.descrLink ? new URL(r.descrLink).hostname : "";
        const mediaType = TorrentNameParser({ name: r.fileName, tracker }).parts[0].mediaType;
        const parsedMagnet: null | { infoHash: string } = parseMagnetUrl(r.fileUrl);
        return {
            ...r,
            infoHash: parsedMagnet?.infoHash ?? null,
            tracker: tracker,
            mediaType: mediaType,
        };
    });
    const occurrences = new Set<string>();
    return [...normalizedFromLocalDb, ...normalizedFromQbtv]
        .filter(record => {
            const key = getRowKey(record);
            if (occurrences.has(key)) {
                return false;
            }
            occurrences.add(key);
            return true;
        })
        .sort((a, b) => compare(a, b, infoHashToScrape));
}

function computeMediaTypeToCount(records: QbtSearchResultItemExtended[]): ReadonlyMap<string, number> {
    return records.reduce((a,b) => {
        const mediaType = b.mediaType || "unknown";
        a.set(mediaType, (a.get(mediaType) ?? 0) + 1);
        return a;
    }, new Map());
}

const REQUESTED_SCRAPES = new Set<string>();

function shouldScrape(record: QbtSearchResultItemExtended): boolean {
    // TODO: handle async info hashes
    const needForSeed = getInfoHashNow(record)
        && (!liveSeedUpdateSites.includes(record.siteUrl) || "asLocalDbRecord" in record && record.asLocalDbRecord)
        && !suspiciousSites.includes(record.siteUrl);
    return !REQUESTED_SCRAPES.has(getRowKey(record))
        && !!needForSeed;
}

export default function Search(props: {
    qbtv2SearchId: number,
    localResults: api_findTorrentsInLocalDb_DbRow[],
}) {
    const [qbtvStatus, setQbtvStatus] = useState("Loading...");
    const [qbtvResults, setQbtvResults] = useState<QbtSearchResultItem[]>([]);
    const [infoHashToScrape, setInfoHashToScrape] = useState<InfoHashToScrape>(new Map());
    const [excludedSizeRanges, setExcludedSizeRanges] = useState<
        ReadonlySet<(typeof SIZE_RANGES)[number]>
    >(new Set());
    const [excludedMediaTypes, setExcludedMediaTypes] = useState<ReadonlySet<string>>(new Set());

    const pollQbtv = async () => {
        let offset = 0;
        for (let i = 0; i < 120; ++i) {
            const resultsRs: QbtSearchResult = await api.qbtv2.search.results({
                id: props.qbtv2SearchId, limit: 500, offset: offset,
            });
            setQbtvStatus(resultsRs.status + " (" + offset +  " results found)");

            if (resultsRs.results.length > 0) {
                offset += resultsRs.results.length;
                setQbtvResults(prev => [...prev, ...resultsRs.results]);
            }

            if (resultsRs.status !== "Running" &&
                offset >= resultsRs.total
            ) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const records = useMemoSafe(
        computeMergedRecords,
        [props.localResults, qbtvResults, infoHashToScrape]
    );

    const mediaTypeToCount = useMemoSafe(computeMediaTypeToCount, [records]);

    useEffect(() => {
        pollQbtv();
    }, []);

    useEffect(() => {
        const newRecords = records.filter(shouldScrape);
        if (newRecords.length > 0) {
            const torrents = newRecords.map(r => ({
                infohash: getInfoHashNow(r)?.infoHash ?? neverNull(),
            }));
            api.scrapeTrackersSeedInfo({ torrents }).then(async (scrapes) => {
                for await (const scrape of scrapes) {
                    setInfoHashToScrape(prev => {
                        const next = new Map(prev);
                        next.set(toLowerCase(scrape.infohash), scrape);
                        return next;
                    });
                }
            });
            for (const record of newRecords) {
                REQUESTED_SCRAPES.add(getRowKey(record));
            }
        }
    }, [records]);

    return <>
        <header>
            <div className="header-text-block-space">
                <div className="header-title-with-search-form">
                    <div className="header-main-title">
                        <a href="/">
                            <span className="kunkka-color">kunkka</span>-<span className="torrent-color">torrent</span>
                        </a>
                    </div>
                    <div>
                        <form method="get" action="./search.html">
                            <input required={true} placeholder="Type file name here" name="pattern" type="text"/>
                            <select name="category" defaultValue="all">
                                <option value="all">All categories</option>
                                <option disabled={false}>──────────</option>
                                <option value="anime">Anime</option>
                                <option value="books">Books</option>
                                <option value="games">Games</option>
                                <option value="movies">Movies</option>
                                <option value="music">Music</option>
                                <option value="pictures">Pictures</option>
                                <option value="software">Software</option>
                                <option value="tv">TV shows</option>
                            </select>
                            <input type="hidden" name="plugins" value="all"/>
                            <button>Search</button>
                        </form>
                    </div>
                </div>
                <p className="title-secondary-text">Torrent contents explorer - open files in browser, no need to download to PC</p>
            </div>
            <div className="header-image-remainder-space"></div>
        </header>

        <form id="filters_form">
            <div className="filters-panel">
                <div id="status_text">{qbtvStatus}</div>

                <div id="size_decimal_category_whitelist">
                    {...SIZE_RANGES.map(sizeRange => <label data-size-decimal-category={sizeRange} key={sizeRange}>
                        <input type="checkbox" name="includedDecimalCategory" value={sizeRange}
                            checked={!excludedSizeRanges.has(sizeRange)}
                            onChange={e => {
                                setExcludedSizeRanges(prev => {
                                    const newSet = new Set(prev);
                                    if (!e.target.checked) {
                                        newSet.add(sizeRange);
                                    } else {
                                        newSet.delete(sizeRange);
                                    }
                                    return newSet;
                                });
                            }}
                        />
                        <span>{sizeRange}</span>
                    </label>)}
                </div>
                <div id="media_types_whitelist">{
                    [...mediaTypeToCount.entries()].map(([mediaType, count]) => <div
                        key={mediaType}
                        data-media-type={mediaType}
                    >
                        <label>
                            <input type="checkbox"
                                checked={!excludedMediaTypes.has(mediaType)}
                                onChange={e => setExcludedMediaTypes(prev => {
                                    const newSet = new Set(prev);
                                    if (!e.target.checked) {
                                        newSet.add(mediaType);
                                    } else {
                                        newSet.delete(mediaType);
                                    }
                                    return newSet;
                                })}
                            />
                            <span>{mediaType}</span>
                        </label>
                        <span className="amount-holder">{count}</span>
                    </div>)
                }</div>
            </div>
        </form>

        <div className="search-results-table-container">
            <table className="resulting-list-of-torrents">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Open</th>
                        <th>Name</th>
                        <th>Media</th>
                        <th>Size</th>
                        <th>Leechers</th>
                        <th>Seeders</th>
                        <th>Magnet (Download) Link</th>
                        <th>View in Tracker</th>
                    </tr>
                </thead>
                <tbody id="search_results_list" className={[
                    "css-filtered-list",
                    ...[...excludedSizeRanges]
                        .map(sizeRange => "size-decimal-category-excluded--" + sizeRange),
                    ...[...excludedMediaTypes]
                        .map(mediaType => "media-type-excluded--" + mediaType),
                ].join(" ")}>
                    {records.map((record, i) => {
                        const infoHash = getInfoHashNow(record)?.infoHash;
                        return <ResultRow
                            index={i}
                            key={getRowKey(record)}
                            record={record}
                            scrape={!infoHash ? undefined : infoHashToScrape.get(toLowerCase(infoHash))}
                        />;
                    })}
                </tbody>
            </table>
        </div>
    </>;
}