import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';

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

const getInfoHash = async resultItem => {
    if (resultItem.infoHash) {
        return resultItem.infoHash;
    } else {
        throw new Error('TODO: convert torrent to info hash - ' + resultItem.fileUrl);
    }
};

const typeToStreamInfoMaker = {
    'video': (stream) => {
        const {width, height, display_aspect_ratio, avg_frame_rate, bits_per_raw_sample, pix_fmt, ...rest} = stream;
        return Dom('span', {}, [
            Dom('span', {}, display_aspect_ratio + ' ' + width + 'x' + height),
            Dom('span', {}, avg_frame_rate.split('/')[0] / 1000),
            Dom('span', {}, 'Colors: ' + pix_fmt),
        ]);
    },
    'audio': (stream) => {
        const {sample_fmt, sample_rate, channels, ...rest} = stream;
        return Dom('span', {}, [
            Dom('span', {}, (sample_rate / 1000) + ' kHz'),
            Dom('span', {}, channels + ' ch'),
        ]);
    },
    'subtitle': (stream) => {
        const {language, title, NUMBER_OF_FRAMES} = stream.tags || {};
        return Dom('span', {}, [
            Dom('span', {}, title || ''),
            Dom('span', {}, language),
            ...(NUMBER_OF_FRAMES ? [
                Dom('span', {}, NUMBER_OF_FRAMES + ' frames'),
            ] : []),
        ]);
    },
};

/**
 * @param {FfprobeOutput} ffprobeOutput
 * @param {HTMLVideoElement} video
 */
const displayFfprobeOutput = (ffprobeOutput, expandedView) => {
    const video = expandedView.querySelector('video');
    const {format, streams} = ffprobeOutput;
    const {format_name, format_long_name, probe_score, bit_rate} = format;
    expandedView.querySelector('.container-info').textContent = format_long_name + ' - ' +
        format_name + ' ' + (bit_rate / 1024 / 1024).toFixed(3) + ' MiB/s bitrate';
    const streamList = expandedView.querySelector('.stream-list');
    streamList.innerHTML = '';
    let subsIndex = 0;
    for (const stream of streams) {
        const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
        const typedInfoMaker = typeToStreamInfoMaker[codec_type] || null;
        const typeInfo = typedInfoMaker ? [typedInfoMaker(rest)] : JSON.stringify(rest).slice(0, 70);
        const isBadCodec = ['h265', 'mpeg4', 'ac3', 'hdmv_pgs_subtitle', 'hevc'].includes(codec_name);
        const isGoodCodec = ['h264', 'vp9', 'aac', 'vorbis', 'flac', 'mp3', 'srt', 'vtt', 'subrip', 'ass'].includes(codec_name);
        streamList.appendChild(
            Dom('div', {}, [
                Dom('span', {}, '#' + index),
                Dom('span', {
                    ...(isBadCodec ? {class: 'bad-codec'} : {}),
                    ...(isGoodCodec ? {class: 'good-codec'} : {}),
                }, codec_name),
                Dom('span', {}, codec_type),
                Dom('span', {}, profile),
                Dom('span', {}, typeInfo),
            ])
        );

        if (codec_type === 'subtitle') {
            const srclang = (stream.tags || {}).language;
            const src = '/torrent-stream-subs?' + new URLSearchParams({
                infoHash: video.getAttribute('data-info-hash'),
                filePath: video.getAttribute('data-file-path'),
                subsIndex: subsIndex,
            });
            video.appendChild(
                Dom('track', {
                    src: src,
                    ...(subsIndex === 0 ? {default: 'default'} : {}),
                    kind: 'subtitles',
                    label: srclang + ' ' + ((stream.tags || {}).title || ''),
                    srclang: srclang,
                }, [])
            );
            ++subsIndex;
        }
    }
};

const playVideo = (expandedView, infoHash, file, isBadCodec) => {
    const video = expandedView.querySelector('video');
    video.setAttribute('data-info-hash', infoHash);
    video.setAttribute('data-file-path', file.path);
    video.setAttribute('src', (isBadCodec ? '/torrent-stream-hevc' : '/torrent-stream') + '?' + new URLSearchParams({
        infoHash: video.getAttribute('data-info-hash'),
        filePath: video.getAttribute('data-file-path'),
    }));
    video.innerHTML = '';
    video.play();
    expandedView.querySelector('.ffmpeg-info').textContent = 'It may take a minute or so before playback can be started...';
    expandedView.querySelector('.container-info').innerHTML = '';
    expandedView.querySelector('.stream-list').innerHTML = '';
    expandedView.querySelector('.file-name').textContent = file.path;
    expandedView.querySelector('.file-size').textContent = (file.length / 1024 / 1024).toFixed(3) + ' MiB';

    const url = '/api/getFfmpegInfo?' + new URLSearchParams({
        infoHash: video.getAttribute('data-info-hash'),
        filePath: video.getAttribute('data-file-path'),
    });
    fetch(url).then(rs => rs.json()).then((ffprobeOutput) => {
        if (video.getAttribute('data-info-hash') === infoHash &&
            video.getAttribute('data-file-path') === file.path
        ) {
            displayFfprobeOutput(ffprobeOutput, expandedView);
        }
    });
    // updateSwarmInfo = async () => {
    //     if (video.getAttribute('data-info-hash') !== infoHash || video.ended) {
    //         updateSwarmInfo = () => {};
    //     } else {
    //         const url = 'https://kunkka-torrent.online/api/getSwarmInfo?' +
    //             new URLSearchParams({infoHash});
    //         fetch(url).then(rs => rs.json()).then(swarmSummary => {
    //             gui.selected_video_ffmpeg_info.textContent = JSON.stringify(swarmSummary);
    //         });
    //     }
    // };
};

const makeFilesList = ({resultItem, infoHash, seconds, expandedView, files}) => {
    const isBadCodec =
        resultItem.fileName.match(/265/) ||
        resultItem.fileName.match(/hevc/i) ||
        resultItem.fileName.match(/mpeg-?4/i);
    return Dom('div', {}, [
        Dom('span', {}, seconds),
        Dom('span', {}, 'Show Files:'),
        Dom('input', {type: 'checkbox', class: 'hide-following-flag'}),
        Dom('table', {}, [
            Dom('tbody', {}, files.map(f => Dom('tr', {}, [
                Dom('td', {}, f.path),
                Dom('td', {}, (f.length / 1024 / 1024).toFixed(3) + ' MiB'),
                Dom('td', {}, [
                    Dom('button', {
                        onclick: () => playVideo(expandedView, infoHash, f, isBadCodec),
                        ...(!isBadCodec ? {} : {
                            //disabled: 'disabled',
                            //style: 'cursor: help',
                            title: 'Codec of this video file (h265/hevc/mpeg4) is a proprietary piece of shit, it can not be played in the browser - you can only download it to pc and play with vlc or choose a different torrent',
                        }),
                    }, 'Watch'),
                ]),
            ]))),
        ]),
    ]);
};

const toExpandView = (resultItem, getTr) => {
    let expandedView = null;
    let whenMetaInfo = null;
    let whenInfoHash = null;
    return () => {
        const tr = getTr();
        if (expandedView) {
            expandedView.remove();
            expandedView = null;
            return;
        }
        const fileListCont = Dom('div', {}, 'Loading File List...');
        expandedView = Dom('tr', {}, [
            Dom('td', {colspan: 999}, [
                Dom('div', {style: 'display: flex; justify-content: space-evenly'}, [
                    fileListCont,
                    Dom('div', {}, [
                        Dom('div', {}, [
                            Dom('video', {controls: 'controls'}),
                        ]),
                        Dom('div', {}, [
                            Dom('div', {class: 'file-name'}),
                            Dom('div', {class: 'file-size'}),
                            Dom('div', {class: 'container-info'}),
                            Dom('div', {class: 'stream-list'}),
                            Dom('div', {class: 'ffmpeg-info'}),
                        ]),
                    ]),
                ]),
            ]),
        ]);
        tr.parentNode.insertBefore(expandedView, tr.nextSibling);
        const startedMs = Date.now();
        whenInfoHash = whenInfoHash || getInfoHash(resultItem);
        whenMetaInfo = whenMetaInfo || whenInfoHash
            .then((ih) => fetch('/api/getSwarmInfo?infoHash=' + ih))
            .then(rs => {
                if (rs.status !== 200) {
                    throw new Error(rs.statusText);
                } else {
                    return rs.json();
                }
            });
        whenMetaInfo.then(async metaInfo => {
            const seconds = (Date.now() - startedMs) / 1000;
            const infoHash = await whenInfoHash;
            const filesList = makeFilesList({
                resultItem, infoHash, seconds,
                expandedView, files: metaInfo.files,
            });
            fileListCont.innerHTML = '';
            fileListCont.appendChild(filesList);
        });
    };
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
                onclick: toExpandView(resultItem, () => tr),
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
