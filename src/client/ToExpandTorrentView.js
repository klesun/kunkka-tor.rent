
import {Dom} from 'https://klesun-misc.github.io/dev_data/common/js/Dom.js';
import Api from "../client/Api.js";

/** @param {QbtSearchResultItem} resultItem */
const getInfoHash = async resultItem => {
    if (resultItem.infoHash) {
        return resultItem.infoHash;
    } else {
        const torrentFileData = await Api()
            .downloadTorrentFile({fileUrl: resultItem.fileUrl});
        return torrentFileData.infoHash;
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

const subsExtensions = ['srt', 'vtt', 'subrip', 'ass'];
const goodAudioExtensions = ['aac', 'vorbis', 'flac', 'mp3', 'opus'];

/**
 * @param {FfprobeOutput} ffprobeOutput
 * @param {HTMLVideoElement} video
 * @param {HTMLElement} ffmpegInfoBlock
 */
const displayFfprobeOutput = ({
    ffprobeOutput, gui: {
        video, ffmpegInfoBlock,
    },
}) => {
    const streamList = Dom('div', {class: 'stream-list'});

    const {format, streams} = ffprobeOutput;
    const {format_name, format_long_name, probe_score, bit_rate} = format;
    let subsIndex = 0;
    const audioTracks = [];
    for (const stream of streams) {
        const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
        const typedInfoMaker = typeToStreamInfoMaker[codec_type] || null;
        const typeInfo = typedInfoMaker ? [typedInfoMaker(rest)] : JSON.stringify(rest).slice(0, 70);
        const isBadCodec = ['h265', 'mpeg4', 'ac3', 'hdmv_pgs_subtitle', 'hevc'].includes(codec_name);
        const isGoodCodec = ['h264', 'vp9', ...subsExtensions, ...goodAudioExtensions].includes(codec_name);
        streamList.appendChild(
            Dom('div', {'data-codec-type': codec_type}, [
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
        } else if (codec_type === 'audio') {
            audioTracks.push(stream);
        }
    }
    if (audioTracks.length > 0 || audioTracks.some(tr => tr.codec_name === 'ac3')) {
        // TODO: add tracks
    }

    ffmpegInfoBlock.innerHTML = '';
    const containerInfo = Dom('div', {class: 'container-info'}, format_long_name + ' - ' +
        format_name + ' ' + (bit_rate / 1024 / 1024).toFixed(3) + ' MiB/s bitrate');
    ffmpegInfoBlock.appendChild(containerInfo);
    ffmpegInfoBlock.appendChild(streamList);
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
    } else if (['exe', 'msi', 'zip', 'rar', 'pdf'].includes(extension)) {
        window.open(src, '_blank');
        return Dom('div', {}, 'Binary file, initiating download...');
    } else {
        return null;
    }
};

/** @param {ShortTorrentFileInfo} file */
const initPlayer = (infoHash, file, isBadCodec) => {
    const streamPath = isBadCodec ? '/torrent-stream-hevc' : '/torrent-stream';
    const fileApiParams = {
        infoHash: infoHash,
        filePath: file.path,
    };
    const src = streamPath + '?' + new URLSearchParams(fileApiParams);

    const extension = file.path.toLowerCase().replace(/^.*\./, '');
    const fileView = makeFileView({src, extension});
    if (fileView) {
        return fileView;
    } else if (['zip', 'cbz'].includes(extension)) {
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
        return Dom('div', {}, [zippedFilesList, statusPanel]);
    // would be nice to extract rar and allow to explore further
    }

    const video = Dom('video', {
        controls: 'controls',
        'data-info-hash': infoHash,
        'data-file-path': file.path,
        'src': src,
    });
    const ffmpegInfoBlock = Dom('div', {class: 'ffmpeg-info'}, 'It may take a minute or so before playback can be started...');

    Api().getFfmpegInfo(fileApiParams)
        .then((ffprobeOutput) => {
            displayFfprobeOutput({
                ffprobeOutput, gui: {
                    video, ffmpegInfoBlock,
                }
            });
        }).catch(exc => {
            if (['mkv', 'mp4', 'mov', 'mpg', 'm2v', 'mp3', 'flac', 'aac'].includes(extension)) {
                throw exc;
            } else {
                // not a video file probably
                window.open(src, '_blank');
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
    let whenMetaInfo = null;
    let whenInfoHash = null;
    const isBadCodec =
        resultItem.fileName.match(/265/) ||
        resultItem.fileName.match(/hevc/i) ||
        resultItem.fileName.match(/mpeg-?4/i);

    return () => {
        const tr = getTr();
        if (expandedView) {
            expandedView.remove();
            expandedView = null;
            return;
        }
        const fileListCont = Dom('div', {class: 'file-list-cont'}, 'Loading File List...');
        const playerCont = Dom('div', {class: 'player-cont'}, 'Choose a File from the List...');
        expandedView = Dom('tr', {class: 'expanded-view-row'}, [
            Dom('td', {colspan: 999}, [
                Dom('div', {class: 'expanded-torrent-block'}, [
                    fileListCont, playerCont,
                ]),
            ]),
        ]);
        tr.parentNode.insertBefore(expandedView, tr.nextSibling);
        const startedMs = Date.now();
        whenInfoHash = whenInfoHash || getInfoHash(resultItem);
        whenMetaInfo = whenMetaInfo || whenInfoHash
            .then(ih => Api().getSwarmInfo({infoHash: ih}));
        whenMetaInfo.then(async metaInfo => {
            const seconds = (Date.now() - startedMs) / 1000;
            const infoHash = await whenInfoHash;
            const filesList = makeFilesList({
                isBadCodec, seconds, files: metaInfo.files,
                playCallback: (f) => {
                    playerCont.innerHTML = '';
                    const player = initPlayer(infoHash, f, isBadCodec);
                    playerCont.appendChild(player);
                    [...player.querySelectorAll('video')].forEach(v => v.play());
                },
            });
            fileListCont.innerHTML = '';
            fileListCont.appendChild(filesList);
        });
    };
};

export default ToExpandTorrentView;