
export const parseMagnetUrl = (url) => {
    const match = url.match(/^magnet:\?xt=urn:btih:([a-fA-F0-9]{40}).*/);
    if (match) {
        return {infoHash: match[1]};
    } else {
        return null;
    }
};