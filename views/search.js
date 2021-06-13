import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';
import ToExpandTorrentView from "../src/client/ToExpandTorrentView.js";
import Api from "../src/client/Api.js";
import {parseMagnetUrl} from "../src/common/Utils.js";
import TorrentNameParser from "../src/common/TorrentNameParser.js";

const gui = {
    status_text: document.getElementById('status_text'),
    search_results_list: document.getElementById('search_results_list'),
    media_types_whitelist: document.getElementById('media_types_whitelist'),
    filters_form: document.getElementById('filters_form'),
};

/** I'd question their honesty in the claimed seed numbers */
const suspiciousSites = ['https://1337x.to', 'https://limetor.com', 'https://zooqle.com'];
/** not updating seeders information for years, but at least numbers look realistic, just outdated */
const stagnantSites = ['https://bakabt.me'];
/** updating seeders info constantly, I think on every request (you can easily distinguish them: the seed amounts are around 10-20, not 100-500) */
const credibleSites = ['https://nyaa.si', 'https://rutracker.org', 'https://nnmclub.to/forum/', 'https://torrents-csv.ml', 'https://rarbg.to'];

const getScore = (item) => {
    if (item.siteUrl === 'https://eztv.io') {
        // returns irrelevant results if nothing matched query
        return 0;
    } else if (credibleSites.includes(item.siteUrl)) {
        return item.nbSeeders;
    } else if (item.siteUrl === 'https://bakabt.me') {
        // tried few Kara no Kyoukai torrents, reports 44 and 38 seeds, but both seems to be dead, seems like
        // numbers weren't updated in years - in this regard torrents.csv would be much more credible for example
        return item.nbSeeders / 4;
    } else if (item.siteUrl === 'https://thepiratebay.org') {
        // don't know the reason, but recently popular piratebay torrents are showing as 1 seed, probably script broken
        return item.nbSeeders * 20;
    } else if (suspiciousSites.includes(item.siteUrl)) {
        return item.nbSeeders / 128;
    } else {
        return item.nbSeeders / 2;
    }
};

const makeComparator = (watchIndex) => {
    return (a,b) => {
        const aFilesWatched = watchIndex.get(a.fileUrl) || [];
        const bFilesWatched = watchIndex.get(b.fileUrl) || [];

        if (bFilesWatched.length === aFilesWatched.length ||
            aFilesWatched.length < 2 && bFilesWatched.length < 2
        ) {
            return getScore(b) - getScore(a);
        } else {
            return bFilesWatched.length - aFilesWatched.length;
        }
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

const makeResultTr = (resultItem) => {
    const seedsSuspicious =
        suspiciousSites.includes(resultItem.siteUrl) ||
        stagnantSites.includes(resultItem.siteUrl);

    const tr = Dom('tr', {
        'data-tracker': resultItem.tracker,
        'data-file-url': resultItem.fileUrl,
        'data-media-type': resultItem.mediaType,
        'data-size-decimal-category': getSizeDecimalCategory(resultItem.fileSize),
    }, [
        Dom('td', {}, [
            Dom('button', {
                onclick: ToExpandTorrentView({resultItem, getTr: () => tr}),
            }, 'Open'),
        ]),
        Dom('td', {class: 'torrent-file-name'}, resultItem.fileName),
        Dom('td', {}, resultItem.mediaType),
        makeSizeTd(resultItem.fileSize),
        Dom('td', {class: 'leechers-number'}, resultItem.nbLeechers),
        Dom('td', {class: 'seeders-number' + (seedsSuspicious ? ' suspicious-seeds' : '')}, (seedsSuspicious ? '(≖_≖)' : '') + resultItem.nbSeeders),
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

const makeListUpdater = (listDom, watchIndex) => {
    const allResults = [];
    const comparator = makeComparator(watchIndex);
    const update = (resultsChunk) => {
        resultsChunk = resultsChunk.filter(resultItem => {
            // forged seed numbers, no way to exclude on API level apparently
            return resultItem.siteUrl !== 'https://limetor.com';
        });
        let trIndex = allResults.length - 1;
        allResults.push(...resultsChunk);
        allResults.sort(comparator);

        for (let i = allResults.length - 1; i >= 0; --i) {
            const resultItem = allResults[i];
            const tr = listDom.children[trIndex];
            const newTr = makeResultTr(resultItem);
            const filesWatched = watchIndex.get(resultItem.fileUrl) || [];
            if (filesWatched.length > 1) {
                newTr.classList.toggle('was-watching', true);
            }
            if (trIndex < 0) {
                listDom.insertBefore(newTr, listDom.children[0]);
            } else if (tr.getAttribute('data-file-url') !== resultItem.fileUrl) {
                listDom.insertBefore(newTr, tr.nextSibling);
            } else {
                --trIndex;
            }
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
    const api = Api();
    const searchParams = new URLSearchParams(window.location.search);
    const started = api.qbtv2.search.start({
        pattern: searchParams.get('pattern'),
        category: searchParams.get('category') || 'all',
        plugins: searchParams.get('plugins') || 'all',
    });
    const watchIndex = collectWatchIndex(window.localStorage);
    const {id} = await started;

    gui.filters_form.onchange = (event) => {
        if (event.target.name === 'includedDecimalCategory') {
            document.body.classList.toggle('size-decimal-category-excluded--' + event.target.value, !event.target.checked);
        }
    };
    let offset = 0;
    const listUpdater = makeListUpdater(gui.search_results_list, watchIndex);
    for (let i = 0; i < 60; ++i) {
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
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

main().catch(exc => {
    console.error(exc);
    alert('Main script execution failed - ' + exc);
});
