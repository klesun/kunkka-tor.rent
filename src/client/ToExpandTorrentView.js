
import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';
import Api from "../client/Api.js";
import ExternalTrackMatcher, {VIDEO_EXTENSIONS} from "../common/ExternalTrackMatcher.js";
import RarStreamer from "./RarStreamer.js";
import FixNaturalOrder from "../common/FixNaturalOrder.js";

/** @param {QbtSearchResultItem} resultItem */
const getInfoHash = async resultItem => {
    const asMagnet = resultItem.fileUrl.match(/^magnet:\?(\S+)$/);
    if (asMagnet) {
        const magnetQueryPart = asMagnet[1];
        const search = new URLSearchParams(magnetQueryPart);
        const infoHash = search.get('xt').replace(/^urn:btih:/, '');
        const tr = search.getAll('tr');
        return {infoHash, tr};
    } else {
        const torrentFileData = await Api()
            .downloadTorrentFile({fileUrl: resultItem.fileUrl});
        return {infoHash: torrentFileData.infoHash, tr: torrentFileData.announce};
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
        const {sample_fmt, sample_rate, channels, tags = {}, ...rest} = stream;
        const {language, title} = tags;
        return Dom('span', {}, [
            Dom('span', {}, language || ''),
            Dom('span', {}, title || ''),
            Dom('span', {}, (sample_rate / 1000) + ' kHz'),
            Dom('span', {}, channels + ' ch'),
        ]);
    },
    'subtitle': (stream) => {
        const {language, title, NUMBER_OF_FRAMES} = stream.tags || {};
        return Dom('span', {}, [
            Dom('span', {}, language),
            Dom('span', {}, title || ''),
            ...(NUMBER_OF_FRAMES ? [
                Dom('span', {}, NUMBER_OF_FRAMES + ' frames'),
            ] : []),
        ]);
    },
    'attachment': (stream) => {
        const {tags = {}} = stream;
        const {filename} = tags;
        return Dom('span', {}, filename || JSON.stringify(tags));
    },
};

const subsExtensions = ['srt', 'vtt', 'subrip', 'ass', 'sub'];
const goodAudioExtensions = ['aac', 'vorbis', 'flac', 'mp3', 'opus'];

const isBadAudioCodec = (codec_name) => ['ac3', 'eac3'].includes(codec_name);

/** @param {FfprobeStream} stream */
const makeStreamItem = (stream) => {
    const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
    const typedInfoMaker = typeToStreamInfoMaker[codec_type] || null;
    const typeInfo = typedInfoMaker ? [typedInfoMaker(rest)] : JSON.stringify(rest).slice(0, 70);
    const isBadCodec = ['h265', 'mpeg4', 'hdmv_pgs_subtitle', 'hevc'].includes(codec_name) || isBadAudioCodec(codec_name);
    const isGoodCodec = ['h264', 'vp9', ...subsExtensions, ...goodAudioExtensions].includes(codec_name);
    return Dom('div', {'data-codec-type': codec_type}, [
        Dom('span', {}, '#' + index),
        Dom('label', {}, [
            ...(codec_type !== 'audio' ? [] : [
                Dom('input', {type: 'radio', name: 'selectedAudioTrack', value: index}),
            ]),
            Dom('span', {
                ...(isBadCodec ? {class: 'bad-codec'} : {}),
                ...(isGoodCodec ? {class: 'good-codec'} : {}),
            }, codec_name),
            Dom('span', {}, codec_type),
            Dom('span', {}, profile),
            Dom('span', {}, typeInfo),
        ]),
    ]);
};

/** @param {HTMLVideoElement} video */
const addSubsTrack = ({video, src, tags = {}}) => {
    const srclang = (tags || {}).language;
    const hadTracks = !!video.querySelector('track');
    const label = ((srclang || '') + ' ' + ((tags || {}).title || '')).trim();
    video.appendChild(
        Dom('track', {
            src: src,
            ...(hadTracks ? {} : {default: 'default'}),
            kind: 'subtitles',
            ...(!label ? {} : {label}),
            srclang: srclang,
        }, [])
    );
};

/**
 * @param {HTMLVideoElement} video
 * @param {HTMLFormElement} ffmpegInfoBlock
 */
const monitorAudioTracks = ({video, ffmpegInfoBlock, fileApiParams}) => {
    /** @type {HTMLAudioElement} */
    const audioTrackPlayer = Dom('audio', {
        controls: 'controls',
        buffered: 'buffered',
        preload: 'auto',
    });
    ffmpegInfoBlock.appendChild(audioTrackPlayer);

    let activeAudioStreamIdx = -1;
    ffmpegInfoBlock.onchange = () => {
        const audioIdx = +ffmpegInfoBlock.elements['selectedAudioTrack'].value;
        if (audioIdx !== activeAudioStreamIdx) {
            const src = '/torrent-stream-extract-audio?' + new URLSearchParams({
                ...fileApiParams, streamIndex: audioIdx,
            });
            audioTrackPlayer.setAttribute('src', src);
            video.muted = true;
            if (!video.paused) {
                audioTrackPlayer.play().then(() => {
                    audioTrackPlayer.currentTime = video.currentTime;
                });
            }
            activeAudioStreamIdx = audioIdx;
        }
    };
    const syncAudio = () => {
        const EPS = 0.1;
        // should think of a better way, there is a small delay between when you
        // set currentTime and when it actually starts playing at this time
        const diff = video.currentTime - audioTrackPlayer.currentTime;
        if (Math.abs(diff) > EPS) {
            // TODO: when audio is converted from ac3, you can't freely navigate
            //  through timeline, probably better use speedup rewind like on a VCD =-D
            //  (as I have no idea how to make it work correctly with encoding on-the-fly)
            audioTrackPlayer.currentTime = video.currentTime;
        }
    };
    const timingInterval = setInterval(syncAudio, 5000);
    const stateInterval = setInterval(() => {
        if (video.paused) {
            if (!audioTrackPlayer.paused) {
                audioTrackPlayer.pause();
            }
        } else if (audioTrackPlayer.currentTime > video.currentTime) {
            // video is buffering
            audioTrackPlayer.muted = true;
        } else {
            audioTrackPlayer.muted = false;
            if (audioTrackPlayer.paused) {
                audioTrackPlayer.play();
            }
        }
        if (!document.body.contains(ffmpegInfoBlock)) {
            // dom was destroyed - clear intervals
            clearInterval(timingInterval);
            clearInterval(stateInterval);
        }
    }, 100);
};

/**
 * @param {FfprobeOutput} ffprobeOutput
 * @param {HTMLVideoElement} video
 * @param {HTMLFormElement} ffmpegInfoBlock
 */
const displayFfprobeOutput = ({
    ffprobeOutput, gui: {
        video, ffmpegInfoBlock,
    },
}) => {
    const streamList = Dom('div', {class: 'stream-list'});

    const fileApiParams = {
        infoHash: video.getAttribute('data-info-hash'),
        filePath: video.getAttribute('data-file-path'),
    };
    const {format, streams} = ffprobeOutput;
    const {format_name, format_long_name, probe_score, bit_rate} = format;
    const audioTracks = streams.filter(s => s.codec_type === 'audio');
    const hasBadAudioCodec = audioTracks.some(s => isBadAudioCodec(s.codec_name));
    let subsIndex = 0;
    for (const stream of streams) {
        const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
        const streamItem = makeStreamItem(stream);
        streamList.appendChild(streamItem);

        if (codec_type === 'subtitle') {
            const src = '/torrent-stream-extract-subs?' + new URLSearchParams({
                ...fileApiParams, subsIndex: subsIndex,
            });
            addSubsTrack({video, src, tags: stream.tags});
            ++subsIndex;
        }
    }

    ffmpegInfoBlock.innerHTML = '';
    ffmpegInfoBlock.classList.toggle('can-change-audio-track', audioTracks.length > 1 || hasBadAudioCodec);
    const containerInfo = Dom('div', {class: 'container-info'}, format_long_name + ' - ' +
        format_name + ' ' + (bit_rate / 1024 / 1024).toFixed(3) + ' MiB/s bitrate');
    ffmpegInfoBlock.appendChild(containerInfo);
    ffmpegInfoBlock.appendChild(streamList);

    monitorAudioTracks({video, ffmpegInfoBlock, fileApiParams});
};

const makeFileView = ({src, extension}) => {
    if (['png', 'jpg', 'jpeg'].includes(extension)) {
        // разожми меня покрепче, шакал
        return Dom('div', {}, [
            Dom('img', {src: src, style: 'max-width: 100%; max-height: 900px'}),
            Dom('div', {}, 'Loading image...'),
        ]);
    } else if ([...subsExtensions, 'txt', 'xml', 'json', 'yml', 'yaml', 'nfo', 'info', 'md5', 'sha', 'bat', 'rtf'].includes(extension)) {
        const textarea = Dom('textarea', {rows: 36, cols: 140});
        fetch(src)
            .then(rs => rs.text())
            .then(text => textarea.value = text);
        return Dom('div', {}, [
            textarea,
            Dom('div', {}, 'Loading text...'),
        ]);
    } else if (['exe', 'msi', 'pdf', 'djvu'].includes(extension)) {
        window.open(src, '_blank');
        return Dom('div', {}, 'Binary file, initiating download...');
    } else {
        return null;
    }
};

const makeZipFileView = (fileApiParams) => {
    const zippedFilesList = Dom('div');
    const statusPanel = Dom('div', {}, 'Loading archive contents...');
    Api().prepareZipReader(fileApiParams).then(async iter => {
        for await (const entry of iter) {
            const openFileCont = Dom('div', {});
            const extension = entry.path.toLowerCase().replace(/^.*\./, '');
            const src = '/ftp/zipReaderFile?' + new URLSearchParams({
                ...fileApiParams, zippedFilePath: entry.path,
            });
            const dom = Dom('div', {style: 'text-align: right'}, [
                Dom('div', {}, [
                    Dom('span', {}, entry.path),
                    Dom('span', {}, ' '),
                    Dom('span', {}, (entry.size / 1024 / 1024).toFixed(2) + ' MiB'),
                    Dom('span', {}, ' '),
                    Dom('button', {
                        onclick: () => {
                            openFileCont.innerHTML = '';
                            let fileView = makeFileView({src, extension});
                            if (!fileView) {
                                window.open(src, '_blank');
                                fileView = Dom('div', {}, 'Binary file, initiating download...');
                            }
                            openFileCont.appendChild(fileView);
                        },
                    }, 'View'),
                ]),
                openFileCont,
            ]);
            zippedFilesList.appendChild(dom);
        }
        statusPanel.textContent = 'Extracted ' + zippedFilesList.children.length + ' files';
    });
    const downloadSrc = '/torrent-stream?' + new URLSearchParams(fileApiParams);
    return Dom('div', {}, [
        zippedFilesList,
        Dom('div', {}, [
            Dom('button', {onclick: () => window.open(downloadSrc, '_blank')}, 'Download'),
        ]),
        statusPanel,
    ]);
};

const makeRarFileView = (src) => {
    const raredFilesList = Dom('div');
    const statusPanel = Dom('div', {}, 'Loading archive contents...');
    fetch(src).then(async rs => {
        const reader = rs.body.getReader();
        const iterating = RarStreamer({reader});
        for await (const file of iterating.iter) {
            const openFileCont = Dom('div', {});
            const extension = file.name.toLowerCase().replace(/^.*\./, '');
            const dom = Dom('div', {style: 'text-align: right'}, [
                Dom('div', {}, [
                    Dom('span', {}, file.name),
                    Dom('span', {}, ' '),
                    Dom('span', {}, (file.unpSize / 1024 / 1024).toFixed(2) + ' MiB'),
                    Dom('span', {}, ' '),
                    Dom('button', {
                        onclick: () => {
                            const [stateRec, resultRec] = iterating.extractFile(file);
                            if (stateRec.state !== 'SUCCESS') {
                                console.log('ololo stateRec', stateRec);
                                alert('No success in extracting file');
                            } else {
                                const blob = new Blob([resultRec.files[0].extract[1]], {type: 'image/jpeg'});
                                const src = URL.createObjectURL(blob);
                                let fileView = makeFileView({src, extension});
                                if (!fileView) {
                                    window.open(src, '_blank');
                                    fileView = Dom('div', {}, 'Binary file, initiating download...');
                                }
                                openFileCont.appendChild(fileView);
                            }
                        },
                    }, 'View'),
                ]),
                openFileCont,
            ]);
            raredFilesList.appendChild(dom);
        }
    });
    return Dom('div', {}, [
        raredFilesList,
        Dom('div', {}, [
            Dom('button', {onclick: () => window.open(src, '_blank')}, 'Download'),
        ]),
        statusPanel,
    ]);
};

/**
 * @param {ShortTorrentFileInfo} file
 * @param {ShortTorrentFileInfo[]} files
 */
const initPlayer = (infoHash, file, files, isBadCodec) => {
    // TODO: must detect hevc from ffmpeg info, not from name!
    const streamPath = isBadCodec ? '/torrent-stream-code-in-h264' : '/torrent-stream';
    const fileApiParams = {
        infoHash: infoHash,
        filePath: file.path,
    };
    const src = streamPath + '?' + new URLSearchParams(fileApiParams);

    const extension = file.path.toLowerCase().replace(/^.*\./, '');
    const fileView = makeFileView({src, extension});
    if (fileView) {
        return fileView;
    // TODO: use FixNaturalOrder.js
    } else if (['zip', 'cbz'].includes(extension)) {
        return makeZipFileView(fileApiParams);
    } else if (['rar', 'cbr'].includes(extension)) {
        return makeRarFileView(src);
    }

    const {matchedTracks} = ExternalTrackMatcher({
        videoPath: file.path, files: files,
        trackExtensions: subsExtensions,
    });
    const video = Dom('video', {
        controls: 'controls',
        'data-info-hash': infoHash,
        'data-file-path': file.path,
        'src': src,
    });
    for (const subsTrack of matchedTracks) {
        const subsSrc = '/torrent-stream-subs-ensure-vtt?' + new URLSearchParams({
            infoHash: infoHash,
            filePath: subsTrack.path,
        });
        addSubsTrack({video, src: subsSrc, tags: {title: subsTrack.title}});
    }
    const ffmpegInfoBlock = Dom('form', {class: 'ffmpeg-info'}, 'It may take a minute or so before playback can be started...');

    Api().getFfmpegInfo(fileApiParams)
        .then((ffprobeOutput) => {
            displayFfprobeOutput({
                ffprobeOutput, gui: {
                    video, ffmpegInfoBlock,
                }
            });
        }).catch(exc => {
            if ([...VIDEO_EXTENSIONS, 'mp3', 'flac', 'aac'].includes(extension)) {
                throw exc;
            } else {
                // not a video file probably
                window.open(src, '_blank');
            }
        });

    return Dom('div', {}, [
        Dom('div', {}, [video]),
        Dom('div', {class: 'media-info-section'}, [
            Dom('div', {class: 'file-name'}, file.path),
            Dom('div', {class: 'file-size'}, (file.length / 1024 / 1024).toFixed(3) + ' MiB'),
            ffmpegInfoBlock,
        ]),
    ]);
};

/**
 * @param {boolean} isBadCodec
 * @param {number} seconds
 * @param {ShortTorrentFileInfo[]} files
 * @param {function(f: ShortTorrentFileInfo): void} playCallback
 */
const makeFilesList = ({isBadCodec, seconds, files, playCallback}) => {
    files = FixNaturalOrder({items: files, getName: f => f.path}).sortedItems;
    let activeTr = null;
    return Dom('div', {}, [
        Dom('span', {}, seconds + ' seconds'),
        Dom('table', {}, [
            Dom('tbody', {class: 'files-in-torrent'}, files.map(f => {
                const tr = Dom('tr', {
                    'data-file-extension': f.path.replace(/^.*\./, ''),
                }, [
                    Dom('td', {}, f.path),
                    Dom('td', {}, (f.length / 1024 / 1024).toFixed(3) + ' MiB'),
                    Dom('td', {}, [
                        Dom('button', {
                            onclick: () => {
                                if (activeTr) {
                                    activeTr.classList.toggle('viewed-file', false);
                                }
                                activeTr = tr;
                                activeTr.classList.toggle('viewed-file', true);
                                playCallback(f);
                            },
                            ...(!isBadCodec ? {} : {
                                title: 'Codec of this video file (h265/hevc/mpeg4) is a proprietary piece of shit, it can not be played in the browser - you can only download it to pc and play with vlc or choose a different torrent',
                            }),
                        }, 'Watch'),
                    ]),
                ]);
                return tr;
            })),
        ]),
    ]);
};

/**
 * @param {QbtSearchResultItem} resultItem
 * @param {function(): HTMLTableRowElement} getTr
 */
const ToExpandTorrentView = ({
    resultItem, getTr,
}) => {
    let expandedView = null;
    let swarmInfoInterval = null;
    let whenMetaInfo = null;
    let whenMagnetData = null;
    const isBadCodec =
        resultItem.fileName.match(/265/) ||
        resultItem.fileName.match(/hevc/i) ||
        resultItem.fileName.match(/XviD/i) ||
        resultItem.fileName.match(/mpeg-?4/i);

    return () => {
        const tr = getTr();
        if (expandedView) {
            clearInterval(swarmInfoInterval);
            expandedView.remove();
            expandedView = null;
            return;
        }
        const swarmInfoPanel = Dom('div', {style: 'white-space: pre-wrap; font-family: monospace;'});
        const fileListCont = Dom('div', {class: 'file-list-cont'}, 'Loading File List...');
        const leftSection = Dom('div', {
            class: 'expanded-view-left-section'
        }, [
            fileListCont, swarmInfoPanel,
        ]);
        const playerCont = Dom('div', {class: 'player-cont'}, 'Choose a File from the List...');
        expandedView = Dom('tr', {class: 'expanded-view-row'}, [
            Dom('td', {colspan: 999}, [
                Dom('div', {class: 'expanded-torrent-block'}, [
                    leftSection, playerCont,
                ]),
            ]),
        ]);
        tr.parentNode.insertBefore(expandedView, tr.nextSibling);
        const startedMs = Date.now();
        whenMagnetData = whenMagnetData || getInfoHash(resultItem);
        whenMetaInfo = whenMetaInfo || whenMagnetData
            .then(magnetData => Api().connectToSwarm(magnetData));
        whenMetaInfo.then(async metaInfo => {
            const seconds = (Date.now() - startedMs) / 1000;
            const {infoHash} = await whenMagnetData;
            const filesList = makeFilesList({
                isBadCodec, seconds, files: metaInfo.files,
                playCallback: (f) => {
                    playerCont.innerHTML = '';
                    const player = initPlayer(infoHash, f, metaInfo.files, isBadCodec);
                    playerCont.appendChild(player);
                    [...player.querySelectorAll('video')].forEach(v => v.play());
                },
            });
            fileListCont.innerHTML = '';
            fileListCont.appendChild(filesList);
        });

        const updateSwarmInfo = async () => {
            const {infoHash} = await whenMagnetData;
            const swarmSummary = await Api().getSwarmInfo({infoHash});
            swarmInfoPanel.textContent = window.Tls.jsExport(swarmSummary, null, 90);
        };
        let intervalStartMs = Date.now();
        swarmInfoInterval = setInterval(() => {
            if (Date.now() - intervalStartMs > 20 * 1000) {
                // start with frequent updates to keep user in touch,
                // then decrease frequency when video supposedly started
                clearInterval(swarmInfoInterval);
                swarmInfoInterval = setInterval(updateSwarmInfo, 5000);
            } else {
                updateSwarmInfo();
            }
        }, 1000);
    };
};

export default ToExpandTorrentView;
