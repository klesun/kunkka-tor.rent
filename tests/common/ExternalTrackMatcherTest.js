import ExternalTrackMatcher from "../../src/common/ExternalTrackMatcher.js";

const provide_call = () => {
    const testCases = [];

    testCases.push({
        title: 'Simplest case, just 2 files: one video and one subs',
        input: {
            videoPath: 'Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS/Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS.avi',
            trackExtensions: ['srt', 'vtt', 'ass', 'sub'],
            "files":[
                {"path":"Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS/Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS.avi","length":1462265856},
                {"path":"Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS/Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS.srt","length":158410},
            ],
        },
        output: {
            matchedTracks: [
                {
                    title: '', // file names completely match, no any suffixes
                    path: 'Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS/Clerks [The First Cut].1994.BRRip.XviD.AC3[5.1]-VLiS.srt',
                },
            ],
        },
    });

    testCases.push({
        title: 'When there is just one video file and many subtitle files, they all should be matched even if not direct prefix',
        input: {
            videoPath: 'Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_.mp4',
            trackExtensions: ['srt', 'vtt', 'ass', 'sub'],
            "files":[
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_.mp4", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_dan.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_dut.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_eng[SDH].srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_fin.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_ger.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_ita.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_nor.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_spa.srt", length: 1},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_swe.srt", length: 1},
            ]
        },
        output: {
            matchedTracks: [
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_dan.srt", title: 'dan'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_dut.srt", title: 'dut'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_eng[SDH].srt", title: 'eng[SDH]'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_fin.srt", title: 'fin'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_ger.srt", title: 'ger'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_ita.srt", title: 'ita'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_nor.srt", title: 'nor'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_spa.srt", title: 'spa'},
                {path: "Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous/Monty.Python.and.the.Holy.Grail.1975.1080p.BluRay.x264.anoXmous_swe.srt", title: 'swe'},
            ],
        },
    });

    testCases.push({
        title: 'More complicated example, with a prefix on subs, could try levenstein, or just sort and match by order with each video',
        input: {
            videoPath: 'Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Monty Python The Movies 1971-1983/03 Monty Python\'s Life Of Brian - 1979 Eng Subs 1080p [H264-mp4].mp4',
            trackExtensions: ['srt', 'vtt', 'ass', 'sub'],
            files: [
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP1front.jpg","length":106508},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP4front.jpg","length":102175},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP3front.jpg","length":99231},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP2front.jpg","length":91474},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP4snap2.jpg","length":72534},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP3snap2.jpg","length":56478},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP2snap2.jpg","length":50158},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP1snap2.jpg","length":46388},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP1snap1.jpg","length":45810},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP4snap3.jpg","length":34546},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP2snap3.jpg","length":33550},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP4snap1.jpg","length":30084},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP3snap1.jpg","length":29901},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP2snap1.jpg","length":29625},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP3snap3.jpg","length":26352},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Images/MP1snap3.jpg","length":23727},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Monty Python The Movies 1971-1983/04 Monty Python's The Meaning Of Life - 30th Anniversary Edition 1983 Eng Subs 1080p [H264-mp4].mp4","length":2197248382},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Monty Python The Movies 1971-1983/03 Monty Python's Life Of Brian - 1979 Eng Subs 1080p [H264-mp4].mp4","length":1925030565},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Monty Python The Movies 1971-1983/02 Monty Python And The Holy Grail - 1975 Eng Subs 1080p [H264-mp4].mp4","length":1892663944},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Monty Python The Movies 1971-1983/01 Monty Python And Now For Something Completely Different - 1971 Eng Subs 1080p [H264-mp4].mp4","length":1814455602},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/04 Monty Pythons The Meaning Of Life - 30th Anniversary Edition 1983 [H264-mp4] English.srt","length":121960},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/03 Monty Pythons Life Of Brian - 1979 [H264-mp4] English.srt","length":115220},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/02 Monty Python And The Holy Grail - 1975 [H264-mp4] English.srt","length":105766},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/01 Monty Python And Now For Something Completely Different - 1971 [H264-mp4] English.srt","length":89367},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/04 Monty Pythons The Meaning Of Life - 30th Anniversary Edition 1983 [H264-mp4] English.sub","length":82806},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/03 Monty Pythons Life Of Brian - 1979 [H264-mp4] English.sub","length":78962},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/02 Monty Python And The Holy Grail - 1975 [H264-mp4] English.sub","length":68463},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/01 Monty Python And Now For Something Completely Different - 1971 [H264-mp4] English.sub","length":62858},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/INFO.nfo","length":8932},{"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Darkside_RG.jpg","length":6482},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from extratorrent.cc.txt","length":346},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from AhaShare.com.txt","length":59},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from seedpeer.eu.txt","length":47},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from demonoid.pw.txt","length":46},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from thepiratebay.se.txt","length":46},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from 1337x.to.txt","length":40},
                {"path":"Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Torrent downloaded from kat.cr.txt","length":39}
            ],
        },
        output: {
            matchedTracks: [
                {path: "Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/03 Monty Pythons Life Of Brian - 1979 [H264-mp4] English.srt", title: '[H264-mp4] English'},
                {path: "Monty Python The Movies 1, 2, 3, 4 - Comedy 1971-1983 Eng Subs 1080p [H264-mp4]/Subtitles Eng [SubRip-MicroDVD]/03 Monty Pythons Life Of Brian - 1979 [H264-mp4] English.sub", title: '[H264-mp4] English'},
            ],
        },
    });

    return testCases.map(c => [c]);
};

class ExternalTrackMatcherTest extends require('klesun-node-tools/src/Transpiled/Lib/TestCase.js') {
    test_call({input, output}) {
        const actual = ExternalTrackMatcher(input);
        this.assertSubTree(output, actual);
    }

    getTestMapping() {
        return [
            [provide_call, this.test_call],
        ];
    }
}

module.exports = ExternalTrackMatcherTest;