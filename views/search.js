import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';
import ToExpandTorrentView from "../src/client/ToExpandTorrentView.js";

const gui = {
    status_text: document.getElementById('status_text'),
    search_results_list: document.getElementById('search_results_list'),
};

const getScore = (item) => {
    if (item.siteUrl === 'https://eztv.io') {
        // returns irrelevant results if nothing matched query
        return 0;
    } else if (item.infoHash) {
        return item.nbSeeders;
    } else {
        // would still be able to fetch them most likely,
        // but will be some hassle, not implemented yet
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
        if (sizeMib > 30 * 1024) {
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
    const tr = Dom('tr', {}, [
        Dom('td', {class: 'torrent-file-name'}, resultItem.fileName),
        makeSizeTd(resultItem.fileSize),
        Dom('td', {class: 'leechers-number'}, resultItem.nbLeechers),
        Dom('td', {class: 'seeders-number'}, resultItem.nbSeeders),
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
    const {id} = await fetch('/api/qbtv2/search/start', {
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        'body': window.location.search.slice('?'.length),
        'method': 'POST',
    }).then(rs => {
        if (rs.status !== 200) {
            throw new Error(rs.statusText);
        } else {
            return rs.json();
        }
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    /** @type {QbtSearchResult} */
    const resultsRs = await fetch('/api/qbtv2/search/results', {
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        'body': new URLSearchParams({
            id: id, limit: 500, offset: 0,
        }).toString(),
        'method': 'POST',
    }).then(rs => {
        if (rs.status !== 200) {
            throw new Error(rs.statusText);
        } else {
            return rs.json();
        }
    });

    gui.status_text.textContent = resultsRs.status;

    const results = resultsRs.results
        // forged seed numbers, no way to exclude on API level apparently
        .filter(r => r.siteUrl !== 'https://limetor.com')
        .map(r => {
            const match = r.fileUrl.match(/^magnet:\?xt=urn:btih:([a-fA-F0-9]{40}).*/);
            if (match) {
                r.infoHash = match[1];
            }
            return r;
        })
        .sort((a,b) => getScore(b) - getScore(a));

    for (const resultItem of results) {
        const tr = makeResultTr(resultItem);
        gui.search_results_list.appendChild(tr);
    }
};

main();
