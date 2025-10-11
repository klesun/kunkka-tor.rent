
/** @return {{ infoHash: string } | null} */
export const parseMagnetUrl = (url) => {
    const match =
        url.match(/^magnet:\?xt=urn:btih:([a-fA-F0-9]{40}).*/) ?? // hnx
        url.match(/^magnet:\?xt=urn:btih:([a-zA-Z2-7]{32}).*/); // base32
    if (match) {
        return { infoHash: match[1] };
    } else {
        return null;
    }
};