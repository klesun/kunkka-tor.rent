import * as http from 'http';
import HandleHttpRequest, {HandleHttpParams} from './HandleHttpRequest';

const HTTP_PORT = 36865;

const handleRq = ({rq, rs, rootPath}: HandleHttpParams) => {
    HandleHttpRequest({rq, rs, rootPath}).catch(exc => {
        rs.statusCode = exc.httpStatusCode || 500;
        rs.statusMessage = ((exc || {}).message || exc + '' || '(empty error)').slice(0, 300);
        rs.end(JSON.stringify({error: exc + '', stack: exc.stack}));
        const msg = 'kunkka-torrent HTTP request ' + rq.url + ' ' + ' failed';
        if (!exc.isOk) {
            console.error(msg, exc);
        }
    });
};

/** @param rootPath - file system path matching the root of the website hosting this request */
const Server = async (rootPath: string) => {
    const server = http
        .createServer((rq, rs) => handleRq({rq, rs, rootPath}))
        .listen(HTTP_PORT, '0.0.0.0', () => {
            console.log('listening kunkka-torrent requests on http://localhost:' + HTTP_PORT);
        });
};

export default Server;