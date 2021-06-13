
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
    if (name.match(/480p|720p|1080p/) ||
        name.match(/\bS\d+\b|\bE\d+\b/i) ||
        name.match(/Season/i) ||
        name.match(/Episode/i) ||
        name.match(/BluRay/i) ||
        name.match(/\bXviD\b/i) ||
        name.match(/rip\b/i) ||
        name.match(/\bhevc\b/i) ||
        name.match(/\bOAV\b/i) ||
        name.match(/\bOVA\b/i) ||
        name.match(/\bmovie\b/i) ||
        name.match(/\bBDMV\b/i) ||
        name.match(/\bTV\b/i) ||
        name.match(/\.mp4$/i) ||
        name.match(/\.mov$/i) ||
        name.match(/\b[hx]26[45]\b/i)
    ) {
        mediaType = 'video';
    } else if (name.match(/\bepub\b/i)
            || name.match(/\bcbz\b/i)
            || name.match(/\bcbr\b/i)
            || name.match(/\bpdf\b/i)
            || name.match(/\bLight Novel\b/i)
            || name.match(/\bAudiobook\b/i)
            || name.match(/\bDrama CD\b/i)
            || name.match(/\bmanga\b/i)
            || name.match(/\bDigital\b/i)
            || name.match(/\bvol(umes?|\.|).?\d+\b/i)
    ) {
        mediaType = 'book';
    } else if (name.match(/\bmp3\b/i)
            || name.match(/\bflac\b/i)
            || name.match(/\bogg\b/i)
    ) {
        mediaType = 'music';
    }
    return {
        parts: [{
            mediaType, // video/audio/book/comics/data
        }],
    };
};

export default TorrentNameParser;