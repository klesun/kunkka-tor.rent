import longestCommonSubstring from "./lib/longest-common-substring/longestCommonSubstring.js";

export const VIDEO_EXTENSIONS = ['mkv', 'mp4', 'avi', 'mov', 'mpg', 'm2v'];
export const GOOD_AUDIO_EXTENSIONS = ['aac', 'vorbis', 'flac', 'mp3', 'opus'];
export const SUBS_EXTENSIONS = ['srt', 'vtt', 'subrip', 'ass', 'sub'];

/**
 * @param superstring = 'ololo hello vasya lololo'
 * @param substring = 'hello vasya'
 * @return {string} = 'ololo lololo'
 */
const removeOccurrence = (superstring, substring) => {
    const infixStart = superstring.indexOf(substring);
    if (infixStart > -1) {
        return (superstring.slice(0, infixStart) + ' ' + superstring.slice(infixStart + substring.length)).trim()
    } else {
        return superstring;
    }
};

const getAllUnambiguousMatches = (allFilePaths, allSubsOptions) => {
    const allVideoOptions = allFilePaths.flatMap(path => {
        const match = path.match(/(.*\/|)(.+)\.(\S+)/);
        if (!match) {
            return [];
        }
        let [, dir, name, ext] = match;
        name = name.replace(/'/g, '');
        if (!VIDEO_EXTENSIONS.includes(ext.toLowerCase())) {
            return [];
        } else {
            return [{name, path}];
        }
    });
    return allSubsOptions.flatMap(subRec => {
        const withRelevance = allVideoOptions.map(vidRec => ({...vidRec,
            commonSubstring: longestCommonSubstring(vidRec.name, subRec.name),
        })).sort((a,b) => b.commonSubstring.length - a.commonSubstring.length);

        if (withRelevance.length > 1 &&
            withRelevance[0].commonSubstring.length >
            withRelevance[1].commonSubstring.length ||
            withRelevance.length === 1
        ) {
            return [{
                subRec: subRec,
                vidRec: withRelevance[0],
            }];
        } else {
            return [];
        }
    });
};

/**
 * @param {string} videoPath
 * @param {{path: string, length: number}[]} files
 * @param {{ videoPath: string, files: ShortTorrentFileInfo[], trackExtensions: string[] }} params
 * @return {{ matchedTracks: {
 *     title: string,
 *     path: string,
 * }[] }} - list of paths to subs we identified as belonging to this video; may
 *  be zero; also can be more than one, example: french, Italian, rus, all in separate files
 */
const ExternalTrackMatcher = (params) => {
    const { videoPath, files, trackExtensions } = params;
    const videoCleanName = videoPath
        // remove directory
        .replace(/.*\//, '')
        // remove extension
        .replace(/^(.*)\.\S+$/, '$1')
        // remove special characters
        .replace(/'/g, '')
        ;
    const allFilePaths = files.map(f => f.path);
    const allSubsOptions = allFilePaths.flatMap(path => {
        const match = path.match(/(.*\/|)(.+)\.(\S+)/);
        if (!match) {
            return [];
        }
        let [, dir, name, ext] = match;
        name = name.replace(/'/g, '');
        if (!trackExtensions.includes(ext.toLowerCase())) {
            return [];
        } else {
            return [{name, path}];
        }
    });
    // simplest case
    let matchedTracks = allSubsOptions
        .flatMap(r => {
            const reducedName = removeOccurrence(r.name, videoCleanName);
            if (r.name !== reducedName) {
                return [{
                    title: reducedName,
                    path: r.path,
                }];
            } else {
                return [];
            }
        });
    if (matchedTracks.length === 0) {
        // artillery
        const unambiguousMatches = getAllUnambiguousMatches(allFilePaths, allSubsOptions);
        matchedTracks = unambiguousMatches
            .filter(({vidRec}) => vidRec.path === videoPath)
            .map(({subRec, vidRec}) => ({
                title: removeOccurrence(subRec.name, vidRec.commonSubstring),
                path: subRec.path,
                commonSubstring: vidRec.commonSubstring,
            }));
    }
    return {
        matchedTracks: matchedTracks,
    };
};

export default ExternalTrackMatcher;