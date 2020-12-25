
/**
 * yet another torrent name parser
 * I was not satisfied with existing ones, as they did not support cases when torrent
 * consists of several different parts, like "Seasons 1-3 + Movie 1 + Spinoffs"
 *
 * @param {string} tracker = 'rutracker.org'
 *  on rutracker and nnm (probably on others as well) there is a wizard page
 *  where you input details and name gets generated in a normalized format
 */
const TorrentNameParser = ({
    name, tracker = null,
}) => {
    let mediaType = 'unknown';
    // for starters don't try to interpret it as multi-part torrent, but preserve multiformat for future
    if (name.match(/720p|1080p/) ||
        name.match(/\bS\d+\b|\bE\d+\b/i) ||
        name.match(/Season/i) ||
        name.match(/Episode/i) ||
        name.match(/BluRay/i) ||
        name.match(/rip\b/i) ||
        name.match(/\bhevc\b/i) ||
        name.match(/\b[hx]26[45]\b/i)
    ) {
        mediaType = 'video';
    }
    return {
        parts: [{
            mediaType, // video/audio/book/comics/data
        }],
    };
};

export default TorrentNameParser;