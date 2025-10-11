import type { api_findTorrentsInLocalDb_DbRow } from "./Api";

export type QbtSearchResultItem = {
    descrLink: "https://pirateproxy.live/torrent/7504788/Warcraft_-_Frozen_Throne_DotA_1.26Version" | string,
    fileName: "Warcraft - Frozen Throne DotA 1.26Version" | string,
    fileSize: 2265595248 | number,
    fileUrl: "magnet:?xt=urn:btih:A84C9E5330692BB20058F72AFDF372251EAF3E6E&dn=Warcraft+-+Frozen+Throne+DotA+1.26Version&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2920%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.pirateparty.gr%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.cyberia.is%3A6969%2Fannounce"
           | "https://bakabt.me/torrent/348674/kara-no-kyoukai-1-fukan-fuukei-the-garden-of-sinners-1-overlooking-view-bd-1080p-coalgirls"
           | string,
    nbLeechers: 0 | number,
    nbSeeders: 6 | number,
    siteUrl: "https://pirateproxy.live" | string,
};

type QbtSearchResultItemExtended = QbtSearchResultItem & {
    infoHash?: string | null | undefined,
    tracker: string,
    mediaType: "video" | "music" | "book" | "unknown" | string,
};

type QbtSearchResultItemFromLocalDb = QbtSearchResultItemExtended & {
    asLocalDbRecord: api_findTorrentsInLocalDb_DbRow,
};

type QbtSearchResult = {
    status: "Running" | "Stopped",
    total: 442,
    results: QbtSearchResultItem[],
};
