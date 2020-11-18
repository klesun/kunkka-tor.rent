import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';
import ToExpandTorrentView from "../src/client/ToExpandTorrentView.js";
import Api from "../src/client/Api.js";
import {parseMagnetUrl} from "../src/common/Utils.js";

const gui = {
    status_text: document.getElementById('status_text'),
    search_results_list: document.getElementById('search_results_list'),
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
    } else if (suspiciousSites.includes(item.siteUrl)) {
        return item.nbSeeders / 128;
    } else {
        return item.nbSeeders / 2;
    }
};

const makeSizeTd = (fileSize) => {
    const classes = ['torrent-size'];
    let content;
    if (fileSize <= 0) {
        content = fileSize;
        classes.push('invalid-size');
    } else {
        const sizeMib = fileSize / 1024 / 1024;
        if (sizeMib > 60 * 1024) {
            classes.push('very-big-torrent');
        } else if (sizeMib > 30 * 1024) {
            classes.push('big-torrent');
        } else if (sizeMib < 100) {
            classes.push('small-torrent');
        } else if (sizeMib < 500) {
            classes.push('single-episode-torrent');
        }
        if (sizeMib >= 1024) {
            content = (sizeMib / 1024).toFixed(1) + 'GiB';
        } else {
            content = sizeMib.toFixed(1) + 'MiB';
        }
    }
    return Dom('td', {class: classes.join(' ')}, content);
};

const makeResultTr = (resultItem) => {
    const seedsSuspicious =
        suspiciousSites.includes(resultItem.siteUrl) ||
        stagnantSites.includes(resultItem.siteUrl);

    const tr = Dom('tr', {}, [
        Dom('td', {class: 'torrent-file-name'}, resultItem.fileName),
        makeSizeTd(resultItem.fileSize),
        Dom('td', {class: 'leechers-number'}, resultItem.nbLeechers),
        Dom('td', {class: 'seeders-number' + (seedsSuspicious ? ' suspicious-seeds' : '')}, (seedsSuspicious ? '(≖_≖)' : '') + resultItem.nbSeeders),
        Dom('td', {}, [
            Dom('a', {
                href: resultItem.fileUrl,
            }, resultItem.infoHash || resultItem.fileUrl),
        ]),
        Dom('td', {}, [
            Dom('a', {
                href: resultItem.descrLink,
            }, new URL(resultItem.descrLink).hostname),
        ]),
        Dom('td', {}, [
            Dom('button', {
                onclick: ToExpandTorrentView({resultItem, getTr: () => tr}),
            }, 'Open'),
        ]),
    ]);
    return tr;
};

const main = async () => {
    const api = Api();
    const searchParams = new URLSearchParams(window.location.search);
    const {id} = await api.qbtv2.search.start({
        pattern: searchParams.get('pattern'),
        category: searchParams.get('category') || 'all',
        plugins: searchParams.get('plugins') || 'all',
    });

    const allResults = [];
    for (let i = 0; i < 60; ++i) {
        const resultsRs = await api.qbtv2.search.results({
            id: id, limit: 500, offset: allResults.length,
        });

        gui.status_text.textContent = resultsRs.status;
        const resultsChunk = resultsRs.results
            .map(r => {
                r.infoHash = (parseMagnetUrl(r.fileUrl) || {}).infoHash;
                return r;
            });
        if (resultsChunk.length > 0) {
            allResults.push(...resultsChunk);
            allResults.sort((a,b) => getScore(b) - getScore(a));

            gui.search_results_list.textContent = '';
            for (const resultItem of allResults) {
                // forged seed numbers, no way to exclude on API level apparently
                if (resultItem.siteUrl === 'https://limetor.com') continue;

                const tr = makeResultTr(resultItem);
                gui.search_results_list.appendChild(tr);
            }
        }

        if (resultsRs.status !== 'Running' &&
            allResults.length >= resultsRs.total
        ) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

main();
