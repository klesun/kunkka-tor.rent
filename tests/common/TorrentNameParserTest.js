import TorrentNameParser from "../../src/common/TorrentNameParser.js";

const provide_call = () => {
    const testCases = [];

    testCases.push({
        input: {
            name: '[Furi] Avatar - The Last Airbender [720p] (Full 3 Seasons + Extras)',
        },
        output: {
            releaseGroup: 'Furi',
            titles: ['Avatar - The Last Airbender'],
            parts: [
                {season: 1, resolution: '720p'},
                {season: 2, resolution: '720p'},
                {season: 3, resolution: '720p'},
                {rawDescription: 'Extras'},
            ],
        },
    });

    testCases.push({
        input: {
            name: 'Avatar The Last Airbender (2005) Season 1-3 S01-S03 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 2.0 RCVR) REPACK\t',
        },
        output: {
            titles: ['Avatar The Last Airbender'],
            parts: [
                {season: 1, resolution: '1080p', videoCodec: 'x265', audioCodec: 'eac3', sourceQuality: 'WEB-DLRip', year: 2005},
                {season: 2, resolution: '1080p', videoCodec: 'x265', audioCodec: 'eac3', sourceQuality: 'WEB-DLRip'},
                {season: 3, resolution: '1080p', videoCodec: 'x265', audioCodec: 'eac3', sourceQuality: 'WEB-DLRip'},
            ],
            unparsedTokens: ['AMZN', '10bit', '2.0', 'RCVR', 'REPACK'],
        },
    });

    testCases.push({
        input: {
            "name": "Мой маленький пони: Дружба - это чудо / My Little Pony: Friendship Is Magic / Сезон: 8 / Серии: 1-26 из 26 (Джейсон Тиссен / Jayson Thiessen, Джеймс Вуттон / James Wootton) [2018, комедия, семейный, фэнтези, WEB-DLRip] Dub (Карусель) + Original + Sub",
            "tracker": "rutracker.org"
        },
        output: {
            titles: [
                'Мой маленький пони: Дружба - это чудо',
                'My Little Pony: Friendship Is Magic',
            ],
            parts: [
                {
                    season: 8,
                    episodes: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
                    // not everything will be parsed on the first iteration
                    authors: [
                        'Джейсон Тиссен / Jayson Thiessen',
                        'Джеймс Вуттон / James Wootton',
                    ],
                    year: 2018,
                    sourceQuality: 'WEB-DLRip',
                    genres: ['комедия', 'семейный', 'фэнтези'],
                    tracks: [
                        {type: 'dubbing', studio: 'Карусель'},
                        {type: 'original'},
                        {type: 'subbing'},
                    ],
                },
            ],
        },
    });

    testCases.push({
        input: {
            "name": "My.Little.Pony.The.Movie.2017.1080p.WEBRip.DD5.1.x264-SHITBOX",
            "tracker": "torrents-csv.ml"
        },
        output: {
            titles: ['My Little Pony The Movie'],
            parts: [
                {
                    type: 'movie',
                    year: 2017,
                    resolution: '1080p',
                    sourceQuality: 'WEBRip',
                    videoCodec: 'x264',
                },
            ],
            unparsedTokens: ['DD5', '1', '-SHITBOX'],
        },
    });

    testCases.push({
        input: {
            "name": "My Little Pony Friendship is Magic Season 1-5",
            "tracker": "torrents-csv.ml"
        },
        output: {
            titles: ['My Little Pony Friendship is Magic'],
            parts: [
                {season: 1}, {season: 2},
                {season: 3}, {season: 4},
                {season: 5},
            ],
        },
    });

    return testCases.map(c => [c]);
};

class TorrentNameParserTest extends require('klesun-node-tools/src/Transpiled/Lib/TestCase.js') {
    test_call({input, output}) {
        const actual = TorrentNameParser(input);
        this.assertSubTree(output, actual);
    }

    getTestMapping() {
        return [
            // TODO: implement the parser
            // [provide_call, this.test_call],
        ];
    }
}

module.exports = TorrentNameParserTest;