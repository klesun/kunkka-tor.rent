
// @ts-ignore
import Tracker = require('torrent-tracker');

type TrackerRecord = {
    url: string,
    maxHashesPerRequest: number,
};

export const trackerRecords: TrackerRecord[] = [
    {url: 'udp://9.rarbg.to:2920/announce', maxHashesPerRequest: 101},

    {url: 'udp://opentor.org:2710/announce', maxHashesPerRequest: 75},
    {url: 'udp://valakas.rollo.dnsabr.com:2710/announce', maxHashesPerRequest: 75},
    {url: 'udp://open.stealth.si:80/announce', maxHashesPerRequest: 75},
    {url: 'udp://tracker.opentrackr.org:1337/announce', maxHashesPerRequest: 75},
    {url: 'udp://tracker.zerobytes.xyz:1337/announce', maxHashesPerRequest: 75},
    {url: 'udp://tracker2.dler.org:80/announce', maxHashesPerRequest: 75},
    {url: 'udp://vibe.community:6969/announce', maxHashesPerRequest: 75},
    {url: 'udp://wassermann.online:6969/announce', maxHashesPerRequest: 75},
    {url: 'udp://retracker.lanta-net.ru:2710/announce', maxHashesPerRequest: 75},
    // {url: 'udp://tracker.openbittorrent.com:80/announce', maxHashesPerRequest: 75},
    // {url: 'udp://tracker.openbittorrent.com:6969/announce', maxHashesPerRequest: 75},
    {url: 'udp://www.torrent.eu.org:451/announce', maxHashesPerRequest: 75},
    {url: 'udp://tracker.torrent.eu.org:451/announce', maxHashesPerRequest: 75},
    {url: 'udp://udp-tracker.shittyurl.org:6969/announce', maxHashesPerRequest: 75},

    {url: 'udp://u.wwwww.wtf:1/announce', maxHashesPerRequest: 50},
    {url: 'http://nyaa.tracker.wf:7777/announce', maxHashesPerRequest: 50},
    {url: 'http://p4p.arenabg.com:1337/announce', maxHashesPerRequest: 50},

    {url: 'http://p4p.arenabg.com:1337/announce', maxHashesPerRequest: 50},

    {url: 'udp://tracker.internetwarriors.net:1337/announce', maxHashesPerRequest: 50},
    {url: 'udp://tracker1.bt.moack.co.kr:80/announce', maxHashesPerRequest: 50},
    {url: 'udp://opentracker.i2p.rocks:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://explodie.org:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://u.wwwww.wtf:1/announce', maxHashesPerRequest: 50},
    {url: 'udp://tracker.coppersurfer.tk:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://tracker.leechers-paradise.org:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://exodus.desync.com:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://9.rarbg.me:2710/announce', maxHashesPerRequest: 50},
    {url: 'udp://9.rarbg.to:2710/announce', maxHashesPerRequest: 50},
    {url: 'udp://tracker.tiny-vps.com:6969/announce', maxHashesPerRequest: 50},
    {url: 'udp://open.demonii.si:1337/announce', maxHashesPerRequest: 50},

    {url: 'udp://tracker1.bt.moack.co.kr:80/announce', maxHashesPerRequest: 50},

    // timeouts often
    //{url: 'udp://tracker0.ufibox.com:6969/announce', maxHashesPerRequest: 75},
];

type ScrapeResponseData = {
    seeders: number,
    completed: number,
    leechers: number,
};

type Scrape = ScrapeResponseData & {
    infohash: string,
    trackerUrl: string,
};

/**
 * Doing requests sequentially for a given tracker. Could
 * parallelize them, but I do not want to get my ip banned
 */
const scrapeTracker = async function*(tr: TrackerRecord, infohashes: string[]): AsyncGenerator<Scrape> {
    const tracker = new Tracker(tr.url);
    for (let i = 0; i < infohashes.length; i += tr.maxHashesPerRequest) {
        const chunk = infohashes.slice(i, i + tr.maxHashesPerRequest);
        let msg;
        try {
            msg = await new Promise<Record<string, ScrapeResponseData>>((resolve, reject) => {
                tracker.scrape(chunk, {timeout: 15000}, (err: unknown, msg: Record<string, ScrapeResponseData>) => {
                    err ? reject(err) : resolve(msg);
                });
            });
        } catch (error: unknown) {
            (error as any).message += ' at ' + tr.url;
            throw error;
        }
        for (const [infohash, data] of Object.entries(msg)) {
            yield { ...data, infohash, trackerUrl: tr.url };
        }
    }
};

/** @kudos to https://stackoverflow.com/a/50586391/2750743 */
const combine = async function*<T>(
    asyncIterators: AsyncGenerator<T, void, undefined>[]
): AsyncGenerator<T> {
    const results = [];
    let count = asyncIterators.length;
    const never = new Promise<never>(() => {});
    function getNext(
        asyncIterator: AsyncGenerator<T, void, undefined>,
        index: number
    ): Promise<{index: number, result: IteratorResult<T, void>}> {
        return asyncIterator.next()
            .then(result => ({ index, result }));
    }
    const nextPromises = asyncIterators.map(getNext);
    try {
        while (count) {
            const {index, result} = await Promise.race(nextPromises);
            if (result.done) {
                nextPromises[index] = never;
                results[index] = result.value;
                count--;
            } else {
                nextPromises[index] = getNext(asyncIterators[index], index);
                yield result.value;
            }
        }
    } finally {
        for (const [index, iterator] of asyncIterators.entries()) {
            if (nextPromises[index] != never && iterator.return != null) {
                iterator.return(undefined);
            }
        }
        // no await here - see https://github.com/tc39/proposal-async-iteration/issues/126
    }
};

/** @return - incrementally only better options for a given infohash */
const ScrapeTrackersSeedInfo = async function*(infohashes: string[]) {
    const generators = trackerRecords.map(tr => scrapeTracker(tr, infohashes));
    const hashToBestScrape = new Map<string, Scrape>();
    for await (const scrape of combine(generators)) {
        //console.log(JSON.stringify(scrape));
        const old = hashToBestScrape.get(scrape.infohash);
        if (!old ||
            scrape.seeders > old.seeders ||
            scrape.seeders === old.seeders && (
                scrape.completed > old.completed ||
                scrape.completed === old.completed &&
                scrape.leechers > old.leechers
            )
        ) {
            yield scrape;
            hashToBestScrape.set(scrape.infohash, scrape);
        }
    }
};

export default ScrapeTrackersSeedInfo;
