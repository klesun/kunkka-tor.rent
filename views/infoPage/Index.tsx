import Api from "../../src/client/Api.js";
import ExternalTrackMatcher, { SUBS_EXTENSIONS, VIDEO_EXTENSIONS, GOOD_AUDIO_EXTENSIONS } from "../../src/common/ExternalTrackMatcher.js";
import FixNaturalOrder from "../../src/common/FixNaturalOrder.js";
import type { IApi_connectToSwarm_rs, IApi_getSwarmInfo_rs } from "../../src/server/Api";
import type {ShortTorrentFileInfo} from "../../src/server/actions/ScanInfoHashStatus";
import type { FfprobeOutput, FfprobeStream } from "../../src/client/FfprobeOutput";

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
        return <tr
            key={f.path}
            className={!watched ? undefined : "watched-in-past"}
            data-file-extension={f.path.replace(/^.*\./, '')}
        >
            <td>{f.path}</td>
            <td>{(f.length / 1024 / 1024).toFixed(3) + ' MiB'}</td>
            <td>
                <button
                    onClick={() => playCallback(f)}
                    title={!isBadCodec ? undefined : 'Codec of this video file (h265/hevc/mpeg4) is non playable in some systems/browsers - you can only download it to pc and play with vlc or choose a different torrent'}
                >Watch</button>
            </td>
        </tr>;
    });
    return <div>
        <span>{seconds + ' seconds'}</span>
        <table>
            <tbody className="files-in-torrent">
                {trs}
            </tbody>
        </table>
    </div>;
}

const typeToStreamInfoMaker: {
    [type in FfprobeStream['codec_type']]: (
        stream: FfprobeStream & {codec_type: type}
    ) => React.ReactElement
} = {
    'video': (stream) => {
        const {width, height, display_aspect_ratio, avg_frame_rate, bits_per_raw_sample, pix_fmt, ...rest} = stream;
        return <span>
            <span>{display_aspect_ratio + ' ' + width + 'x' + height}</span>
            <span>{+avg_frame_rate.split('/')[0] / 1000}</span>
            <span>Colors: {pix_fmt}</span>
        </span>;
    },
    'audio': (stream) => {
        const { sample_fmt, sample_rate, channels, tags = {}, ...rest } = stream;
        const { language, title } = tags;
        return <span>
            <span>{language || ''}</span>
            <span>{title || ''}</span>
            <span>{(+sample_rate / 1000) + ' kHz'}</span>
            <span>{channels + ' ch'}</span>
        </span>;
    },
    'subtitle': (stream) => {
        const {language, title, NUMBER_OF_FRAMES} = stream.tags || {};
        return <span>
            <span>{language}</span>
            <span>{title || ''}</span>
            {!!NUMBER_OF_FRAMES && <span>{NUMBER_OF_FRAMES} frames</span>}
        </span>;
    },
    'attachment': (stream) => {
        const { tags = { filename: "" } } = stream;
        const { filename } = tags;
        return <span>{filename || JSON.stringify(tags)}</span>;
    },
};

function StreamItem({ stream }: { stream: FfprobeStream }) {
    const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
    const typedInfoMaker = typeToStreamInfoMaker[codec_type] || null;
    const typeInfo = typedInfoMaker ? [typedInfoMaker(rest)] : JSON.stringify(rest).slice(0, 70);
    const isBadCodec = ['h265', 'mpeg4', 'hdmv_pgs_subtitle', 'hevc'].includes(codec_name) || isBadAudioCodec(codec_name);
    const isGoodCodec = ['h264', 'vp9', ...SUBS_EXTENSIONS, ...GOOD_AUDIO_EXTENSIONS].includes(codec_name);
    return <div data-codec-type={codec_type}>
        <span>#{index}</span>
        <label>
            {codec_type === "audio" && <input
                type="radio"
                name="selectedAudioTrack"
                value={index}
                data-codec-name={stream.codec_name}
            />}
            <span className={
                isBadCodec ? 'bad-codec' :
                isGoodCodec ? 'good-codec' :
                undefined
            }>{codec_name}</span>
            <span>{codec_type}</span>
            <span>{profile}</span>
            <span>{typeInfo}</span>
        </label>
    </div>;
}

const isBadAudioCodec = (codec_name: string) => ['ac3', 'eac3'].includes(codec_name);

function FfprobeOutput({ ffprobeOutput }: { ffprobeOutput: FfprobeOutput }) {
    const { format, streams } = ffprobeOutput;
    const { format_name, format_long_name, probe_score, bit_rate } = format;
    const audioTracks = streams.filter(s => s.codec_type === 'audio');
    const hasBadAudioCodec = audioTracks.some(s => isBadAudioCodec(s.codec_name));

    const streamItems = [];
    let subsIndex = 0;
    for (const stream of streams) {
        const {index, codec_name, codec_long_name, profile, codec_type, ...rest} = stream;
        streamItems.push(<StreamItem key={stream.index} stream={stream}/>);

        if (codec_type === 'subtitle') {
            // const src = '/torrent-stream-extract-subs?' + new URLSearchParams({
            //     ...fileApiParams, subsIndex: subsIndex,
            // });
            // addSubsTrack({video, src, tags: stream.tags});
            ++subsIndex;
        }
    }

    return <form className={"ffmpeg-info" + (audioTracks.length > 1 || hasBadAudioCodec ? " can-change-audio-track" : "")}>
        <div className="container-info">
            {format_long_name + ' - ' + format_name + ' ' + (+bit_rate / 1024 / 1024).toFixed(3) + ' MiB/s bitrate'}
        </div>
        <div className="stream-list">{streamItems}</div>
    </form>;
}

function Player({ infoHash, file, files }: {
    infoHash: string,
    file: ShortTorrentFileInfo,
    files: ShortTorrentFileInfo[],
}) {
    const [ffprobeOutput, setFfprobeOutput] = useState<FfprobeOutput>();

    useEffect(() => {
        Api().getFfmpegInfo(fileApiParams)
            .then(setFfprobeOutput).catch(exc => {
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
    for (const subsTrack of matchedTracks) {
        const subsSrc = '/torrent-stream-subs-ensure-vtt?' + new URLSearchParams({
            infoHash: infoHash,
            filePath: subsTrack.path,
        });
        // addSubsTrack({video, src: subsSrc, tags: {title: subsTrack.title}});
    }

    return <div>
        <div>
            <video controls={true} data-info-hash={infoHash} data-file-path={file.path} src={src}>
                {ffprobeOutput && ffprobeOutput.streams
                    .flatMap(s => s.codec_type === "subtitle" ? [s] : [])
                    .map((sub, subsIndex) => {
                        const src = '/torrent-stream-extract-subs?' + new URLSearchParams({
                            ...fileApiParams, subsIndex: String(subsIndex),
                        });
                        const { tags } = sub;
                        const srclang = (tags || { language: undefined }).language;
                        const label = ((srclang || '') + ' ' + ((tags || { title: "" }).title || '')).trim();
                        return <track
                            src={src}
                            default={subsIndex === 0}
                            kind="subtitles"
                            label={label || undefined}
                            srclang={srclang || undefined}
                        />;
                    })}
            </video>
        </div>
        <div className="media-info-section">
            <div className="file-name">{file.path}</div>
            <div className="file-size">{(file.length / 1024 / 1024).toFixed(3) + ' MiB'}</div>
            {!ffprobeOutput
                ? <div>It may take a minute or so before playback can be started...</div>
                : <FfprobeOutput ffprobeOutput={ffprobeOutput} />}
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