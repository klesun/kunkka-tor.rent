import {Dom} from '../src/client/Dom.js';
import Api from "../src/client/Api.js";
import {parseMagnetUrl} from "../src/common/Utils.js";
import TorrentNameParser from "../src/common/TorrentNameParser.js";

const api = Api();

const gui = {
    status_text: document.getElementById('status_text'),
    search_results_list: document.getElementById('search_results_list'),
    media_types_whitelist: document.getElementById('media_types_whitelist'),
    filters_form: document.getElementById('filters_form'),
};

/** I'd question their honesty in the claimed seed numbers */
const suspiciousSites = ['https://eztv.io', 'https://1337x.to', 'https://limetor.com', 'https://www.limetorrents.lol', 'https://torrentproject2.se'];

/** not updating seeders information for years, but at least numbers look realistic, just outdated */
const stagnantSites = ['https://bakabt.me', 'https://zooqle.com', ...suspiciousSites];
/** updating seeders info constantly, I think on every request (you can easily distinguish them: the seed amounts are around 10-20, not 100-500) */
const liveSeedUpdateSites = ['https://nyaa.si', 'https://rutracker.org', 'https://nnmclub.to/forum/', 'https://rarbg.to'];
const credibleSites = [...liveSeedUpdateSites, 'https://torrents-csv.ml'];

const hashToScrape = new Map();

const isStagnant = object => {
    return suspiciousSites.includes(object.stored.siteUrl);
}

const compareObjects = (a, b) => {
    if (isStagnant(a) && !isStagnant(b)) {
        return -1;
    }
    if (!isStagnant(a) && isStagnant(b)) {
        return 1;
    }
    const aSeeders = a.scrape?.seeders ?? a.stored.nbSeeders;
    const bSeeders = b.scrape?.seeders ?? b.stored.nbSeeders;
    if (+aSeeders !== +bSeeders) {
        return aSeeders - bSeeders;
    }
    const aLeechers = a.scrape?.leechers ?? a.stored.nbLeechers;
    const bLeechers = b.scrape?.leechers ?? b.stored.nbLeechers;
    if (+aLeechers !== +bLeechers) {
        return aLeechers - bLeechers;
    }
    const aCompleted = a.scrape?.completed ?? '0';
    const bCompleted = b.scrape?.completed ?? '0';
    if (+aCompleted !== +bCompleted) {
        return aCompleted - bCompleted;
    }
    return 0;
};

const trToObject = (tr) => {
    return {
        stored: {
            nbSeeders: tr.getAttribute('data-stored-seeders'),
            nbLeechers: tr.getAttribute('data-stored-leechers'),
            siteUrl: tr.getAttribute('data-site-url'),
        },
        scrape: {
            seeders: tr.getAttribute('data-live-seeders'),
            leechers: tr.getAttribute('data-live-leechers'),
            completed: tr.getAttribute('data-live-completed'),
        },
    };
};

/**
 * @param {HTMLTableRowElement} a
 * @param {HTMLTableRowElement} b
 */
const compareTrs = (a, b) => {
    return compareObjects(trToObject(a), trToObject(b));

};

const makeDataComparator = (watchIndex) => {
    /**
     * @param {QbtSearchResultItemExtended} a
     * @param {QbtSearchResultItemExtended} b
     */
    return (a,b) => {
        return -compareObjects(
            {stored: a, scrape: hashToScrape.get(a.infoHash) || null},
            {stored: b, scrape: hashToScrape.get(b.infoHash) || null},
        );
    }
};

/** @deprecated I guess, better use more consistent decimal grouping */
const makeSizeTd = (fileSize) => {
    const classes = ['torrent-size'];
    let content;
    if (fileSize <= 0) {
        content = fileSize;
        classes.push('invalid-size');
    } else {
        const sizeMb = fileSize / 1000 / 1000;
        if (sizeMb >= 1000) {
            content = (sizeMb / 1000).toFixed(1) + 'GiB';
        } else {
            content = sizeMb.toFixed(1) + 'MiB';
        }
    }
    return Dom('td', {class: classes.join(' ')}, content);
};

const getSizeDecimalCategory = (bytes) => {
    if (bytes < Math.pow(10, 6)) {
        return 'less-than-1mb'; // a text-only book
    } else if (bytes < Math.pow(10, 7)) {
        return '1mb-10mb'; // a set of books or a single mp3 song
    } else if (bytes < Math.pow(10, 8)) {
        return '10mb-100mb'; // a flac song
    } else if (bytes < Math.pow(10, 9)) {
        return '100mb-1gb'; // a soundtrack or all volumes of a medium length manga
    } else if (bytes < Math.pow(10, 10)) {
        return '1gb-10gb'; // a season of an anime
    } else if (bytes < Math.pow(10, 11)) {
        return '10gb-100gb'; // an ak movie or all seasons of a long-running anime
    } else {
        return 'more-than-100gb';
    }
};

//import ToExpandTorrentView from "../src/client/ToExpandTorrentView.js";

// import('https://klesun-misc.github.io/ts-browser-beta/src/ts-browser.js')
const whenToExpandTorrentView = import('https://klesun-misc.github.io/ts-browser-beta/src/ts-browser.js')
    .then(tsBrowser => tsBrowser.loadModule('./../src/client/ToExpandTorrentView.ts'))
    .then(module => module.default);

/** @param {QbtSearchResultItemExtended} resultItem */
const makeResultTr = (resultItem) => {
    const seedsSuspicious = stagnantSites.includes(resultItem.siteUrl);

    const whenExpandView = whenToExpandTorrentView.then(ToExpandTorrentView => {
        return ToExpandTorrentView({resultItem, getTr: () => tr});
    });
    const tr = Dom('tr', {
        'data-tracker': resultItem.tracker,
        'data-site-url': resultItem.siteUrl,
        'data-file-url': resultItem.fileUrl,
        'data-media-type': resultItem.mediaType,
        'data-size-decimal-category': getSizeDecimalCategory(resultItem.fileSize),
        'data-stored-seeders': resultItem.nbSeeders,
        'data-stored-leechers': resultItem.nbLeechers,
    }, [
        Dom('td', {}, [
            Dom('button', {
                onclick: () => whenExpandView.then(expandView => expandView()),
            }, 'Open'),
        ]),
        Dom('td', {class: 'torrent-file-name'}, resultItem.fileName),
        Dom('td', {}, resultItem.mediaType),
        makeSizeTd(resultItem.fileSize),
        Dom('td', {class: 'leechers-number'}, resultItem.nbLeechers),
        Dom('td', {
            class: 'seeders-number' + (seedsSuspicious ? ' suspicious-seeds' : ''),
        }, [
            Dom('span', {class: 'live-seeds-holder'}, ''),
            Dom('span', {class: 'stored-seeds-holder'}, (seedsSuspicious ? '(≖_≖)' : '') + resultItem.nbSeeders),
        ]),
        Dom('td', {class: 'infohash'}, [
            Dom('a', {
                href: resultItem.fileUrl,
            }, resultItem.infoHash || resultItem.fileUrl.replace(/^https?:\/\/[^\/?]*/, '')),
        ]),
        Dom('td', {}, [
            Dom('a', {
                href: resultItem.descrLink,
            }, resultItem.tracker),
        ]),
        Dom('td', {}, [
            Dom('a', {
                ...resultItem.infoHash ? {
                    target: '_blank',
                    href: './infoPage/' + resultItem.infoHash.toLowerCase(),
                    style: 'white-space: nowrap',
                } : {
                    onclick: () => {
                        alert('TODO: implement magnet-less!');
                    },
                },
            }, [
                Dom('button', {}, 'Full Page'),
            ]),
        ]),
    ]);
    return tr;
};

/** @param {HTMLTableRowElement} tr */
const formatTr = (tr) => {
    return tr.getAttribute('data-stored-seeders') + ' | ' + tr.getAttribute('data-live-seeders') + ' | ' + tr.querySelector('.torrent-file-name').textContent;
};

/** @param {HTMLTableRowElement} tr */
const updateOrder = (tr) => {
    const tbody = tr.parentNode;
    let prev = tr.previousSibling;
    while (prev) {
        if (compareTrs(tr, prev) > 0) {
            prev = prev.previousSibling;
        } else {
            break;
        }
    }
    tr.remove();
    tbody.insertBefore(tr, prev ? prev.nextSibling : tbody.children[0]);

    let next = tr.nextSibling;
    while (next) {
        if (compareTrs(tr, next) < 0) {
            next = next.nextSibling;
        } else {
            break;
        }
    }
    tr.remove();
    tbody.insertBefore(tr, next);
};

const makeListUpdater = (listDom, watchIndex) => {
    const comparator = makeDataComparator(watchIndex);
    const foundHashes = new Set();
    /** @param {QbtSearchResultItemExtended[]} resultsChunk */
    const update = (resultsChunk) => {
        resultsChunk = resultsChunk.filter(resultItem => {
            // forged seed numbers, no way to exclude on API level apparently
            return resultItem.siteUrl !== 'https://limetor.com';
        }).filter(resultItem => {
            if (resultItem.infoHash) {
                if (foundHashes.has(resultItem.infoHash.toLowerCase())) {
                    return false;
                } else {
                    foundHashes.add(resultItem.infoHash.toLowerCase());
                }
            }
            return true;
        }).sort(comparator);

        const hashToTrs = new Map();

        const resultChunkTrs = resultsChunk.map(resultItem => {
            const newTr = makeResultTr(resultItem);
            const filesWatched = watchIndex.get(resultItem.fileUrl) || [];
            if (filesWatched.length > 1) {
                newTr.classList.toggle('was-watching', true);
            }
            if (!hashToTrs.has(resultItem.infoHash)) {
                hashToTrs.set(resultItem.infoHash, []);
            }
            hashToTrs.get(resultItem.infoHash).push(newTr);
            return newTr;
        });

        for (const oldTr of [...listDom.children]) {
            while (resultChunkTrs.length > 0 && compareTrs(resultChunkTrs[0], oldTr) > 0) {
                listDom.insertBefore(resultChunkTrs.shift(), oldTr);
            }
        }
        resultChunkTrs.forEach(chunkItem => listDom.appendChild(chunkItem));

        const needForSeed = resultsChunk.filter(i => {
            return i.infoHash
                && !liveSeedUpdateSites.includes(i.siteUrl)
                && !suspiciousSites.includes(i.siteUrl);
        });
        if (needForSeed.length > 0) {
            (async () => {
                const torrents = needForSeed.map(i => ({infohash: i.infoHash}));
                const scraps = await api.scrapeTrackersSeedInfo({torrents});
                for await (const {infohash, ...scrape} of scraps) {
                    for (const tr of hashToTrs.get(infohash) || []) {
                        tr.querySelector('.live-seeds-holder').textContent = scrape.seeders;
                        tr.setAttribute('title', JSON.stringify(scrape));
                        tr.setAttribute('data-live-seeders', scrape.seeders);
                        tr.setAttribute('data-live-completed', scrape.completed);
                        tr.setAttribute('data-live-leechers', scrape.leechers);
                        updateOrder(tr);
                    }
                    hashToScrape.set(infohash, scrape);
                }
            })();
        }
    };
    return { update };
};

const collectWatchIndex = (localStorage) => {
    const fileUrlToPaths = new Map();
    for (let i = 0; i < localStorage.length; ++i) {
        const key = localStorage.key(i);
        const parts = key.split('&');
        if (parts[0] === 'WATCHED_STORAGE_PREFIX') {
            const [, fileUrlEnc, pathEnc] = parts;
            const fileUrl = decodeURIComponent(fileUrlEnc);
            const path = decodeURIComponent(pathEnc);
            if (!fileUrlToPaths.has(fileUrl)) {
                fileUrlToPaths.set(fileUrl, []);
            }
            fileUrlToPaths.get(fileUrl).push(path);
        }
    }
    return fileUrlToPaths;
};

const main = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const startMs = Date.now();
    const started = api.qbtv2.search.start({
        pattern: searchParams.get('pattern'),
        category: searchParams.get('category') || 'all',
        plugins: searchParams.get('plugins') || 'all',
    });
    const whenLocalResults = api.findTorrentsInLocalDb({
        userInput: searchParams.get('pattern'),
    });
    const localResults = await whenLocalResults;
    const watchIndex = collectWatchIndex(window.localStorage);
    const listUpdater = makeListUpdater(gui.search_results_list, watchIndex);
    listUpdater.update(localResults.map(({infohash, name}) => ({
        infoHash: infohash,
        descrLink: 'https://kunkka-torrent.online/views/infoPage/' + infohash,
        fileName: name,
        fileSize: -1,
        fileUrl: 'magnet:?xt=urn:btih:' + infohash,
        nbLeechers: 0,
        nbSeeders: 1,
        siteUrl: 'https://kunkka-torrent.online',
        tracker: 'kunkka-torrent.online',
        mediaType: TorrentNameParser({name}).parts[0].mediaType,
    })));
    const {id} = await started;

    gui.filters_form.onchange = (event) => {
        if (event.target.name === 'includedDecimalCategory') {
            document.body.classList.toggle('size-decimal-category-excluded--' + event.target.value, !event.target.checked);
        }
    };
    let offset = 0;
    for (let i = 0; i < 120; ++i) {
        const resultsRs = await api.qbtv2.search.results({
            id: id, limit: 500, offset: offset,
        });

        gui.status_text.textContent = resultsRs.status;
        if (resultsRs.results.length > 0) {
            const mediaTypeToCount = new Map();
            const resultsChunk = resultsRs.results.map(r => {
                r.infoHash = (parseMagnetUrl(r.fileUrl) || {}).infoHash;
                const tracker = new URL(r.descrLink).hostname;
                const mediaType = TorrentNameParser({name: r.fileName, tracker}).parts[0].mediaType;
                mediaTypeToCount.set(mediaType, (mediaTypeToCount.get(mediaType) || 0) + 1);
                r.tracker = tracker;
                r.mediaType = mediaType;
                return r;
            });
            offset += resultsChunk.length;
            listUpdater.update(resultsChunk);
            for (const [mediaType, count] of mediaTypeToCount) {
                const existingEntry = [...gui.media_types_whitelist.children]
                    .find(e => e.getAttribute('data-media-type') === mediaType);
                if (existingEntry) {
                    const amountHolder = existingEntry.querySelector('.amount-holder');
                    amountHolder.textContent = +amountHolder.textContent + count;
                } else {
                    gui.media_types_whitelist.appendChild(
                        Dom('div', {'data-media-type': mediaType}, [
                            Dom('label', {}, [
                                Dom('input', {
                                    type: 'checkbox',
                                    checked: 'checked',
                                    onchange: (event) => {
                                        document.body.classList.toggle('media-type-excluded--' + mediaType, !event.target.checked);
                                    },
                                }),
                                Dom('span', {}, mediaType),
                            ]),
                            Dom('span', {class: 'amount-holder'}),
                        ]),
                    );
                }
            }
        }

        if (resultsRs.status !== 'Running' &&
            offset >= resultsRs.total
        ) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};

main().catch(exc => {
    console.error(exc);
    alert('Main script execution failed - ' + exc);
});
