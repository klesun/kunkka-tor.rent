import * as http from "http";

export const readPost = (rq: http.IncomingMessage) => new Promise<string>((ok, err) => {
    if (rq.method === 'POST') {
        let body = '';
        rq.on('data', (data: string) => body += data);
        rq.on('error', (exc: any) => err(exc));
        rq.on('end', () => ok(body));
    } else {
        ok('');
    }
});
