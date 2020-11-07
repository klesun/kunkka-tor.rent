import * as http from "http";
const fetch = require('node-fetch');
import Exc from 'klesun-node-tools/src/ts/Exc';

const readPost = (rq: http.IncomingMessage) => new Promise<string>((ok, err) => {
    if (rq.method === 'POST') {
        let body = '';
        rq.on('data', (data: string) => body += data);
        rq.on('error', (exc: any) => err(exc));
        rq.on('end', () => ok(body));
    } else {
        ok('');
    }
});

/**
 * a mapping to the Web API of qbittorrent
 * needed to proxy requests to the plugin search from trackers
 * aggregation, as this feature is ridiculously useful and convenient
 */
const Qbtv2 = ({port = 44011} = {}) => {
    return {
        search: {
            // probably better would be just use node-fetch...
            start: async (rq: http.IncomingMessage, rs: http.ServerResponse) => {
                const url = 'http://localhost:' + port + '/api/v2/search/start';
                const params = {
                    // needed for cookie, too lazy to parse it on node's side
                    headers: rq.headers,
                    method: 'POST',
                    body: await readPost(rq),
                };
                const fetchRs = await fetch(url, params);
                fetchRs.headers.forEach((value, name) => {
                    rs.setHeader(name, value);
                });
                const body = await fetchRs.text();
                try {
                    return JSON.parse(body);
                } catch (exc) {
                    throw Exc.BadGateway('Failed to parse qbt json response - ' + body);
                }
            },
            results: async (rq: http.IncomingMessage, rs: http.ServerResponse) => {
                const rqBody = await readPost(rq);
                const url = 'http://localhost:' + port + '/api/v2/search/results';
                const fetchRs = await fetch(url, {
                    // needed for cookie, too lazy to parse it on node's side
                    headers: rq.headers,
                    method: 'POST',
                    body: rqBody,
                });
                fetchRs.headers.forEach((value, name) => {
                    if (name.toLowerCase() !== 'content-encoding') {
                        rs.setHeader(name, value);
                    }
                });
                const body = await fetchRs.text();
                try {
                    return JSON.parse(body);
                } catch (exc) {
                    throw Exc.BadGateway('Failed to parse qbt json response - ' + body);
                }
            },
        },
    };
};

export default Qbtv2;