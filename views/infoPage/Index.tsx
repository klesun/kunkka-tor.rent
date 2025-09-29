import Api from "../../src/client/Api.js";
import ExternalTrackMatcher, {SUBS_EXTENSIONS, VIDEO_EXTENSIONS } from "../../src/common/ExternalTrackMatcher.js";
import FixNaturalOrder from "../../src/common/FixNaturalOrder.js";
import type { IApi_connectToSwarm_rs, IApi_getSwarmInfo_rs } from "../../src/server/Api";
import type {ShortTorrentFileInfo} from "../../src/server/actions/ScanInfoHashStatus";

const { React, ReactDOM } = window;
const { useEffect, useState } = React;

const Dom = React.createElement;

const startedMs = Date.now();

function FilesList({ seconds, isBadCodec, files, playCallback }: {
    isBadCodec: boolean,
    seconds: number,
    files: ShortTorrentFileInfo[],
    playCallback: (f: ShortTorrentFileInfo) => void,
}) {
    files = FixNaturalOrder<ShortTorrentFileInfo>({ items: files, getName: f => f.path }).sortedItems;
    const trs = files.map((f, i) => {
        // const key = makeStorageKey(f);
        // const watched = !!window.localStorage.getItem(key);
        const watched = false;
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
                    onClick : () => playCallback(f),
                    ...(!isBadCodec ? {} : {
                        title: 'Codec of this video file (h265/hevc/mpeg4) is non playable in some systems/browsers - you can only download it to pc and play with vlc or choose a different torrent',
                    }),
                }, 'Watch'),
            ]),
        ]);
    });
    return Dom('div', {}, [
        Dom('span', {}, seconds + ' seconds'),
        Dom('table', {}, [
            Dom('tbody', {class: 'files-in-torrent'}, trs),
        ]),
    ]);
}

function Player({ infoHash, file, files }: {
    infoHash: string,
    file: ShortTorrentFileInfo,
    files: ShortTorrentFileInfo[],
}) {
    useEffect(() => {
        Api().getFfmpegInfo(fileApiParams)
            .then((ffprobeOutput) => {
                // displayFfprobeOutput({
                //     ffprobeOutput, gui: {
                //         video, ffmpegInfoBlock,
                //     }
                // });
            }).catch(exc => {
                if ([...VIDEO_EXTENSIONS, 'mp3', 'flac', 'aac'].includes(extension)) {
                    throw exc;
                } else {
                    // not a video file probably
                    window.open(src, '_blank');
                }
            });
    }, []);

    const streamPath = '/torrent-stream';
    const fileApiParams = {
        infoHash: infoHash,
        filePath: file.path,
    };
    const src = streamPath + '?' + new URLSearchParams(fileApiParams);

    const extension = file.path.toLowerCase().replace(/^.*\./, '');
    // TODO: implement and uncomment
    // const fileView = makeFileView({src, extension});
    // if (fileView) {
    //     return fileView;
    // // TODO: use FixNaturalOrder.js
    // } else if (['zip', 'cbz', 'epub'].includes(extension)) {
    //     return makeZipFileView(fileApiParams);
    // } else if (['rar', 'cbr'].includes(extension)) {
    //     return makeRarFileView(src);
    // }

    const {matchedTracks} = ExternalTrackMatcher({
        videoPath: file.path, files: files,
        trackExtensions: SUBS_EXTENSIONS,
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
        // addSubsTrack({video, src: subsSrc, tags: {title: subsTrack.title}});
    }
    const ffmpegInfoBlock = Dom('form', {class: 'ffmpeg-info'}, 'It may take a minute or so before playback can be started...');

    return <div>
        <div>{video}</div>
        <div className="media-info-section">
            <div className="file-name">{file.path}</div>
            <div className="file-size">{(file.length / 1024 / 1024).toFixed(3) + ' MiB'}</div>
            {ffmpegInfoBlock}
        </div>
    </div>;
}

export default function Index({ infoHash }: { infoHash: string }) {
    const [metaInfo, setMetaInfo] = useState<Awaited<IApi_connectToSwarm_rs>>();
    const [swarmInfo, setSwarmInfo] = useState<Awaited<IApi_getSwarmInfo_rs>>();
    const [openedFile, setOpenedFile] = useState<ShortTorrentFileInfo>();

    const updateSwarmInfo = async () => {
        const swarmSummary = await Api().getSwarmInfo({infoHash});
        setSwarmInfo(swarmSummary);
    };

    const renderFileList = (metaInfo: Awaited<IApi_connectToSwarm_rs>) => {
        const seconds = (Date.now() - startedMs) / 1000;
        const isBadCodec = metaInfo.files.some(f => (
            f.path.match(/265/) ||
            f.path.match(/hevc/i) ||
            f.path.match(/XviD/i) ||
            f.path.match(/mpeg-?4/i)
        ));
        return <FilesList {...{
            isBadCodec, seconds,
            files: metaInfo.files,
            playCallback: setOpenedFile,
        }}/>;
    };

    useEffect(() => {
        Api().connectToSwarm({ infoHash, tr: [] }).then(setMetaInfo);

        let intervalStartMs = Date.now();
        let swarmInfoInterval = window.setInterval(() => {
            if (Date.now() - intervalStartMs > 120 * 1000) {
                // start with frequent updates to keep user in touch,
                // then decrease frequency when video supposedly started
                clearInterval(swarmInfoInterval);
                swarmInfoInterval = window.setInterval(updateSwarmInfo, 5000);
            } else {
                updateSwarmInfo();
            }
        }, 500);
    }, []);

    return <div>
        <link rel="stylesheet" href="./../search.css"/>
        <div className="expanded-torrent-block">
            <div className="expanded-view-left-section">
                {!metaInfo
                    ? <div className="file-list-cont">Loading File List...</div>
                    : renderFileList(metaInfo)}
                {!swarmInfo
                    ? <div className="swarm-info-container"></div>
                    : <div className="swarm-info-container">{JSON.stringify(swarmInfo, null, 4)}</div>}
            </div>
            <div className="player-cont">{
                !metaInfo ? 'Meta Data is loading...' : !openedFile ? 'Choose a File from the List.' : <Player
                    key={openedFile.path} infoHash={infoHash} file={openedFile} files={metaInfo.files}
                />
            }</div>
        </div>
    </div>;
}