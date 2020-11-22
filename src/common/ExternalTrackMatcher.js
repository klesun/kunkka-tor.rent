
/**
 * @param {string} videoPath
 * @param {{path: string, length: number}[]} files
 * @return {string[]} - list of paths to subs we identified as belonging to this video; may
 *  be zero; also can be more than one, example: french, Italian, rus, all in separate files
 */
const ExternalTrackMatcher = ({
    videoPath, files, trackExtensions,
}) => {
    const videoCleanName = videoPath
        .replace(/.*\//, '')
        .replace(/^(.*)\.\S+$/, '$1');
    const allSubsOptions = files.map(f => f.path).flatMap(path => {
        const match = path.match(/(.*\/|)(.+)\.(\S+)/);
        if (!match) {
            return [];
        }
        const [, dir, name, ext] = match;
        if (!trackExtensions.includes(ext.toLowerCase())) {
            return [];
        } else {
            return {name, path};
        }
    });
    // simplest case
    const matchedTracks = allSubsOptions
        .flatMap(r => {
            const infixStart = r.name.indexOf(videoCleanName);
            if (infixStart > -1) {
                return [{
                    title: (r.name.slice(0, infixStart) + ' ' + r.name.slice(infixStart + videoCleanName.length)).trim(),
                    path: r.path,
                }];
            } else {
                return [];
            }
        });
    return {
        matchedTracks: matchedTracks,
    };
};

export default ExternalTrackMatcher;