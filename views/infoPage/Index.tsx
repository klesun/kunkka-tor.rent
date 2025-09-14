import Api from "../../src/client/Api.js";
import FixNaturalOrder from "../../src/common/FixNaturalOrder.js";
import type { IApi_connectToSwarm_rs, IApi_getSwarmInfo_rs } from "../../src/server/Api";
import type {ShortTorrentFileInfo} from "../../src/server/actions/ScanInfoHashStatus";

const { React, ReactDOM } = window;
const { useEffect, useState } = React;

const Dom = React.createElement;

const startedMs = Date.now();

function FilesList({ seconds, isBadCodec, files }: {
    isBadCodec: boolean,
    seconds: number,
    files: ShortTorrentFileInfo[],
}) {
    files = FixNaturalOrder({items: files, getName: f => f.path}).sortedItems;
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
                // Dom('button', {
                //     onclick: () => playFileAt(i),
                //     ...(!isBadCodec ? {} : {
                //         title: 'Codec of this video file (h265/hevc/mpeg4) is non playable in some systems/browsers - you can only download it to pc and play with vlc or choose a different torrent',
                //     }),
                // }, 'Watch'),
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

export default function Index({ infoHash }: { infoHash: string }) {
    const [metaInfo, setMetaInfo] = useState<Awaited<IApi_connectToSwarm_rs>>();
    const [swarmInfo, setSwarmInfo] = useState<Awaited<IApi_getSwarmInfo_rs>>();

    const playerCont = Dom('div', {class: 'player-cont'}, 'Choose a File from the List...');

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
        const dom = <FilesList {...{
            isBadCodec, seconds,
            // resultItem,
            files: metaInfo.files,
            // playCallback: (f) => {
            //     [...playerCont.querySelectorAll('video')].forEach(v => {
            //         v.pause();
            //         v.removeAttribute('src');
            //         v.load();
            //     });
            //     playerCont.innerHTML = '';
            //     const player = initPlayer(infoHash, f, metaInfo.files, isBadCodec);
            //     playerCont.appendChild(player);
            //     [...player.querySelectorAll('video')].forEach(v => {
            //         v.play();
            //         v.addEventListener('ended', tryPlayNext);
            //     });
            // },
        }}/>;
        return dom;
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
        {Dom('div', {class: 'expanded-torrent-block'}, [
            Dom('div', {
                class: 'expanded-view-left-section'
            }, [
                !metaInfo
                    ? Dom('div', {class: 'file-list-cont'}, 'Loading File List...')
                    : renderFileList(metaInfo),
                !swarmInfo
                    ? Dom('div', { class: 'swarm-info-container'})
                    : Dom('div', { class: 'swarm-info-container'}, JSON.stringify(swarmInfo, null, 4)),
            ]),
            playerCont,
        ])}
    </div>;
}