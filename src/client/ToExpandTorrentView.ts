
import {Dom} from './Dom.js';
import Api from "../client/Api.js";
// TODO: support! https://github.com/klesun/ts-browser/issues/19
// import ExternalTrackMatcher, {VIDEO_EXTENSIONS} from "../common/ExternalTrackMatcher.js";
import ExternalTrackMatcher from "../common/ExternalTrackMatcher.js";
import {VIDEO_EXTENSIONS} from "../common/ExternalTrackMatcher.js";
import FixNaturalOrder from "../common/FixNaturalOrder.js";
import {FfprobeOutput, FfprobeStream} from "./FfprobeOutput.d";
import {QbtSearchResultItem, QbtSearchResultItemExtended} from "./QbtSearch.d";
// TODO: allow to express through .d.ts and add ignore `import type` statements
//import type {ShortTorrentFileInfo} from "../server/actions/ScanInfoHashStatus";
// import type  {FileHeader} from "../../node_modules/node-unrar-js/src/js/extractor";

const WATCHED_STORAGE_PREFIX = 'WATCHED_STORAGE_PREFIX';

const getInfoHash = async (resultItem: QbtSearchResultItemExtended) => {
    const asMagnet = resultItem.fileUrl.match(/^magnet:\?(\S+)$/);
    if (asMagnet) {
        const magnetQueryPart = asMagnet[1];
        const search = new URLSearchParams(magnetQueryPart);
        const infoHash = search.get('xt')!.replace(/^urn:btih:/, '');
        const tr = search.getAll('tr');
        return {infoHash, tr};
    } else {
        const torrentFileData = await Api()
            .downloadTorrentFile({fileUrl: resultItem.fileUrl});
        return {infoHash: torrentFileData.infoHash, tr: torrentFileData.announce};
    }
};

const typeToStreamInfoMaker: {
    [type in FfprobeStream['codec_type']]: (
        stream: FfprobeStream & {codec_type: type}
    ) => HTMLElement
} = {
    'video': (stream) => {
        const {width, height, display_aspect_ratio, avg_frame_rate, bits_per_raw_sample, pix_fmt, ...rest} = stream;
        return Dom('span', {}, [
            Dom('span', {}, display_aspect_ratio + ' ' + width + 'x' + height),
            Dom('span', {}, +avg_frame_rate.split('/')[0] / 1000),
            Dom('span', {}, 'Colors: ' + pix_fmt),
        ]);
    },
    'audio': (stream) => {
        const {sample_fmt, sample_rate, channels, tags = {}, ...rest} = stream;
        const {language, title} = tags;
        return Dom('span', {}, [
            Dom('span', {}, language || ''),
            Dom('span', {}, title || ''),
            Dom('span', {}, (+sample_rate / 1000) + ' kHz'),
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

const isBadAudioCodec = (codec_name: string) => ['ac3', 'eac3'].includes(codec_name);

const makeStreamItem = (stream: FfprobeStream) => {
    const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
    const typedInfoMaker = typeToStreamInfoMaker[codec_type] || null;
    const typeInfo = typedInfoMaker ? [typedInfoMaker(rest)] : JSON.stringify(rest).slice(0, 70);
    const isBadCodec = ['h265', 'mpeg4', 'hdmv_pgs_subtitle', 'hevc'].includes(codec_name) || isBadAudioCodec(codec_name);
    const isGoodCodec = ['h264', 'vp9', ...subsExtensions, ...goodAudioExtensions].includes(codec_name);
    return Dom('div', {'data-codec-type': codec_type}, [
        Dom('span', {}, '#' + index),
        Dom('label', {}, [
            ...(codec_type !== 'audio' ? [] : [
                Dom('input', {
                    type: 'radio',
                    name: 'selectedAudioTrack',
                    value: String(index),
                    'data-codec-name': stream.codec_name,
                }),
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

const addSubsTrack = ({video, src, tags = {}}: {
    video: HTMLVideoElement,
    src: string,
    tags,
}) => {
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

const monitorAudioTracks = ({video, ffmpegInfoBlock, fileApiParams}: {
    video: HTMLVideoElement,
    ffmpegInfoBlock: HTMLFormElement,
    fileApiParams,
}) => {
    const audioTrackPlayer = Dom('audio', {
        controls: 'controls',
        preload: 'auto',
    });
    ffmpegInfoBlock.appendChild(audioTrackPlayer);

    let activeAudioStreamIdx = -1;
    ffmpegInfoBlock.onchange = () => {
        const radio = Array.isArray(ffmpegInfoBlock.elements['selectedAudioTrack'])
	    ? [...ffmpegInfoBlock.elements['selectedAudioTrack']].find(r => r.checked)
	    : ffmpegInfoBlock.elements['selectedAudioTrack'];
        const audioIdx = +radio.value;
        const codecName = radio.getAttribute('data-codec-name');
        // commented cuz when first audio track codec is ac3 there is no sound out of the box
	//if (audioIdx !== activeAudioStreamIdx) {
            const src = '/torrent-stream-extract-audio?' + new URLSearchParams({
                ...fileApiParams, streamIndex: audioIdx, codecName: codecName,
            });
            audioTrackPlayer.setAttribute('src', src);
            video.muted = true;
            if (!video.paused) {
                audioTrackPlayer.play().then(() => {
                    audioTrackPlayer.currentTime = video.currentTime;
                });
            }
            activeAudioStreamIdx = audioIdx;
        //}
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

const displayFfprobeOutput = ({
    ffprobeOutput, gui: {
        video, ffmpegInfoBlock,
    },
}: {
    ffprobeOutput: FfprobeOutput,
    gui: {
        video: HTMLVideoElement,
        ffmpegInfoBlock: HTMLFormElement,
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

const makeFileView = ({src, extension}: {
    src: string, extension: string,
}) => {
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
    // pdf could be opened in an iframe
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

type RarStreamer = (params: {reader: ReadableStreamReader<Uint8Array>}) => ({
    iter: AsyncGenerator<FileHeader>,
    getBytes: () => Uint8Array,
    extractFile: (fileHeader: FileHeader) => [
        {state: string},
        {files: {extract: Blob[]}[]},
    ],
});

let whenRarStreamer: Promise<RarStreamer> | null = null;
const getRarStreamer = (): Promise<RarStreamer> => {
    if (whenRarStreamer === null) {
        whenRarStreamer = import("./RarStreamer.js")
            .then(module => module.default);
    }
    return whenRarStreamer;
};

const makeRarFileView = (src: string) => {
    const raredFilesList = Dom('div');
    const statusPanel = Dom('div', {}, 'Loading archive contents...');
    fetch(src).then(async rs => {
        const RarStreamer = await getRarStreamer();
        const reader = rs.body!.getReader();
        const iterating = RarStreamer({reader});
        let filesLoaded = 0;
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
                                const mimeTypes: Record<string, string> = {
                                    'png': 'image/png',
                                    'jpg': 'image/jpeg',
                                    'jpeg': 'image/jpeg',
                                    'ogg': 'audio/ogg',
                                    'mp3': 'audio/mp3',
                                };
                                const mimeType = mimeTypes[extension];
                                const blob = new Blob([resultRec.files[0].extract[1]], {type: mimeType});
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
            // for a big 1+ GiB archive we'd like to gradually slow down to not clog
            // user's CPU as re-parsing the archive becomes more and more demanding
            await new Promise(_ => setTimeout(_, filesLoaded++ * 10));
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

const initPlayer = (
    infoHash: string,
    file: ShortTorrentFileInfo,
    files: ShortTorrentFileInfo[],
    isBadCodec: boolean
) => {
    const streamPath = '/torrent-stream';
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
    } else if (['zip', 'cbz', 'epub'].includes(extension)) {
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

const makeFilesList = ({isBadCodec, resultItem, seconds, files, playCallback}: {
    isBadCodec: boolean,
    resultItem: QbtSearchResultItemExtended,
    seconds: number,
    files: ShortTorrentFileInfo[],
    playCallback: (f: ShortTorrentFileInfo) => void,
}) => {
    const makeStorageKey = (f: ShortTorrentFileInfo) => WATCHED_STORAGE_PREFIX + '&' + encodeURIComponent(resultItem.fileUrl) + '&' + encodeURIComponent(f.path);
    files = FixNaturalOrder({items: files, getName: f => f.path}).sortedItems;
    let activeTr: null | HTMLTableRowElement = null;
    let lastPlayIndex = -1;
    const trs = files.map((f, i) => {
        const key = makeStorageKey(f);
        const watched = !!window.localStorage.getItem(key);
        return Dom('tr', {
            ...!watched ? {} : {
                class: 'watched-in-past',
            },
            'data-file-extension': f.path.replace(/^.*\./, ''),
        }, [
            Dom('td', {}, f.path),
            Dom('td', {}, (f.length / 1024 / 1024).toFixed(3) + ' MiB'),
            Dom('td', {}, [
                Dom('button', {
                    onclick: () => playFileAt(i),
                    ...(!isBadCodec ? {} : {
                        title: 'Codec of this video file (h265/hevc/mpeg4) is non playable in some systems/browsers - you can only download it to pc and play with vlc or choose a different torrent',
                    }),
                }, 'Watch'),
            ]),
        ]);
    });
    const playFileAt = (i: number) => {
        const tr = trs[i];
        const f = files[i];
        if (activeTr) {
            activeTr.classList.toggle('viewed-file', false);
        }
        activeTr = tr;
        activeTr.classList.toggle('viewed-file', true);
        playCallback(f);
        lastPlayIndex = i;
        const key = makeStorageKey(f);
        window.localStorage.setItem(key, JSON.stringify({
            ...JSON.parse(window.localStorage.getItem(key) || '{}'),
            lastPlayedAt: new Date().toISOString(),
        }));
    };
    const dom = Dom('div', {}, [
        Dom('span', {}, seconds + ' seconds'),
        Dom('table', {}, [
            Dom('tbody', {class: 'files-in-torrent'}, trs),
        ]),
    ]);
    const tryPlayNext = () => {
        const index = lastPlayIndex + 1;
        if (index < trs.length) {
            playFileAt(index);
        }
    };
    return {dom, tryPlayNext};
};

const ToExpandTorrentView = ({
    resultItem, getTr,
}: {
    resultItem: QbtSearchResultItem,
    getTr: () => HTMLTableRowElement,
}) => {
    let expandedView: HTMLTableRowElement | null = null;
    let swarmInfoInterval: number | undefined;
    let whenMetaInfo = null;
    let whenMagnetData: ReturnType<typeof getInfoHash> | null = null;
    const isBadCodec =
        resultItem.fileName.match(/265/) ||
        resultItem.fileName.match(/hevc/i) ||
        resultItem.fileName.match(/XviD/i) ||
        resultItem.fileName.match(/mpeg-?4/i);

    return () => {
        const tr = getTr();
        if (expandedView) {
            clearInterval(swarmInfoInterval);
            // see https://stackoverflow.com/a/28060352/2750743
            [...expandedView.querySelectorAll('video')].forEach(v => {
                v.pause();
                v.removeAttribute('src');
                v.load();
            });
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
        tr.parentNode!.insertBefore(expandedView, tr.nextSibling);
        const startedMs = Date.now();
        whenMagnetData = whenMagnetData || getInfoHash(resultItem);
        whenMetaInfo = whenMetaInfo || whenMagnetData
            .then(magnetData => Api().connectToSwarm(magnetData));
        whenMetaInfo.then(async metaInfo => {
            const seconds = (Date.now() - startedMs) / 1000;
            const {infoHash} = await whenMagnetData;
            const {dom, tryPlayNext} = makeFilesList({
                isBadCodec, seconds, resultItem, files: metaInfo.files,
                playCallback: (f) => {
                    [...playerCont.querySelectorAll('video')].forEach(v => {
                        v.pause();
                        v.removeAttribute('src');
                        v.load();
                    });
                    playerCont.innerHTML = '';
                    const player = initPlayer(infoHash, f, metaInfo.files, isBadCodec);
                    playerCont.appendChild(player);
                    [...player.querySelectorAll('video')].forEach(v => {
                        v.play();
                        v.addEventListener('ended', tryPlayNext);
                    });
                },
            });
            fileListCont.innerHTML = '';
            fileListCont.appendChild(dom);
        });

        const updateSwarmInfo = async () => {
            const {infoHash} = await whenMagnetData!;
            const swarmSummary = await Api().getSwarmInfo({infoHash});
            swarmInfoPanel.textContent = window.Tls.jsExport(swarmSummary, null, 90);
        };
        let intervalStartMs = Date.now();
        swarmInfoInterval = window.setInterval(() => {
            if (Date.now() - intervalStartMs > 120 * 1000) {
                // start with frequent updates to keep user in touch,
                // then decrease frequency when video supposedly started
                clearInterval(swarmInfoInterval);
                swarmInfoInterval = setInterval(updateSwarmInfo, 5000);
            } else {
                updateSwarmInfo();
            }
        }, 500);
    };
};

export default ToExpandTorrentView;
