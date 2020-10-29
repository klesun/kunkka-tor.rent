import * as http from 'http';
import HandleHttpRequest, {HandleHttpParams} from './HandleHttpRequest';
import Api from "./Api";

const HTTP_PORT = 36865;

const handleRq = (params: HandleHttpParams) => {
    HandleHttpRequest(params).catch(exc => {
        params.rs.statusCode = exc.httpStatusCode || 500;
        params.rs.statusMessage = ((exc || {}).message || exc + '' || '(empty error)').slice(0, 300);
        params.rs.end(JSON.stringify({error: exc + '', stack: exc.stack}));
        const msg = 'kunkka-torrent HTTP request ' + params.rq.url + ' ' + ' failed';
        if (!exc.isOk) {
            console.error(msg, exc);
        }
    });
};

/** @param rootPath - file system path matching the root of the website hosting this request */
const Server = async (rootPath: string) => {
    const api = Api();
    const server = http
        .createServer((rq, rs) => handleRq({rq, rs, rootPath, api}))
        .listen(HTTP_PORT, '0.0.0.0', () => {
            console.log('listening kunkka-torrent requests on http://localhost:' + HTTP_PORT);
        });
};

export default Server;