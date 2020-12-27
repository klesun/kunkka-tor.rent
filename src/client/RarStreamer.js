
import '../common/lib/VendorsWrapper.bundle.js';
const nodeUnrarJs = window.VendorsWrapper['node-unrar-js'];

/**
 * @param {ReadableStreamReader} reader
 * @return {AsyncGenerator<Uint8Array>}
 */
const iterateOverRsChunks = async function*(reader) {
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        yield value;
    }
};

/** @param {ReadableStreamReader} reader */
const RarStreamer = ({reader}) => {
    let prefix = new Uint8Array(0);
    let filesYielded = 0;
    const chunksIter = iterateOverRsChunks(reader);

    const makeIter = async function*() {
        for await (const chunk of chunksIter) {
            // not efficient, by idgaf
            const joined = new Uint8Array(prefix.length + chunk.length);
            joined.set(prefix);
            joined.set(chunk, prefix.length);
            prefix = joined;

            const extractor = nodeUnrarJs.createExtractorFromData(joined.buffer);
            const [stateRec, resultRec] = extractor.getFileList();
            for (const file of resultRec.fileHeaders.slice(filesYielded)) {
                yield file;
                ++filesYielded;
            }
        }
    };
    const iter = makeIter();
    return {
        iter: iter,
        getBytes: () => prefix,
        extractFile: fileHeader => {
            const extractor = nodeUnrarJs.createExtractorFromData(prefix.buffer);
            return extractor.extractFiles([fileHeader.name]);
        },
    };
};

export default RarStreamer;
