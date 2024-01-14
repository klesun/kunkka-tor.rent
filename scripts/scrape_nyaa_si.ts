
import fetch from 'node-fetch';
import {promises as fs} from 'fs';

/**
 * @package - nyaa.si is super awesome tracker: it works fast, seed info is reliable and content is vast
 *     so I'll try to be as delicate as possible while scraping
 *     their Crawl-delay in robots.txt is set to 2 seconds for Googlebot and 5 seconds for noname crawlers
 *     so I guess, at least for starters better be nice and make 5 seconds pause between requests
 *     there are 1407696 torrents on the moment of writing, so it's about 81 days...
 *     I'll probably try to slowly decrease this delay and see if I won't get banned
 */

const baseDir = __dirname + '/../data/nyaa_si_scrapes';

const CHUNK_SIZE = 1000;
const MIN_DELAY = 1500;
const MAX_DELAY = 2500;

const main = async () => {
    let ddosErrors = 0;
    for (let i = 40065; i <= 1766459; ++i) {
        const relIndex = (i - 1) % CHUNK_SIZE;
        const chunkDir = baseDir + '/' + (i - relIndex) + '_' + (i - relIndex - 1 + CHUNK_SIZE);
        if (relIndex === 0) {
            await fs.mkdir(chunkDir, {recursive: true})
        }
        const url = 'https://nyaa.si/view/' + i;
        const response = await fetch(url, {
            headers: {
                'user-agent': 'torrent.klesun.net/af4a607a90e71c5ce9f8157442c813cd09a539c3 infohashes crawler script',
            },
        });
        console.log('processing #' + i + ' - ' + response.status);
        if (response.status === 404) {
            // skip this number, torrent was deleted
        } else {
            const pageHtml = await response.text();
            if (response.status === 200) {
                ddosErrors = 0;
                await fs.writeFile(chunkDir + '/' + i + '.html', pageHtml);
            } else {
                if (ddosErrors > 5) {
                    const msg = 'Aborting after receiving unexpected response code ' + ddosErrors + ' times in a row ' +
                        response.status + ' - probably rate limit\n' + pageHtml;
                    throw new Error(msg);
                } else {
                    ++ddosErrors;
                    --i;
                    const baseDelay = MIN_DELAY + Math.floor(
                        Math.random() * (MAX_DELAY - MIN_DELAY)
                    );
                    const delay = baseDelay * 20;
                    const msg = 'DDoS protection response ' + response.status +
                        ', pausing for ' + delay + ' ms\n' + pageHtml;
                    console.warn(msg);
                    await new Promise(_ => setTimeout(_, baseDelay * 20 * Math.pow(2, ddosErrors)));
                    continue;
                }
            }
        }
        const delay = MIN_DELAY + Math.floor(
            Math.random() * (MAX_DELAY - MIN_DELAY)
        );
        await new Promise(_ => setTimeout(_, delay));
    }
};

main().catch(error => {
    console.error('Main script failed', error);
    process.exit(1);
});
