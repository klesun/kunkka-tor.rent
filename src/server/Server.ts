import * as http from 'http';
import HandleHttpRequest, {HandleHttpParams} from './HandleHttpRequest';
import Api from "./Api";
import * as SocketIo from 'socket.io';
import ScanInfoHashStatus from "./actions/ScanInfoHashStatus";
import {HTTP_PORT} from "./Constants";

const handleRq = (params: HandleHttpParams) => {
    HandleHttpRequest(params).catch(exc => {
        params.rs.statusCode = exc.httpStatusCode || 500;
        params.rs.statusMessage = ((exc || {}).message || exc + '' || '(empty error)')
            // sanitize, as statusMessage seems to not allow special characters
            .slice(0, 300).replace(/[^ -~]/g, '?');
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
    const socketIo = SocketIo();
    socketIo.on('connection', socket => {
        socket.on('message', (data, reply) => {
            if (data.messageType === 'SCAN_INFO_HASH_STATUS') {
                try {
                    const {infoHashes} = data;
                    const itemCallback = itemStatus => socket.send({
                        messageType: 'INFO_HASH_STATUS',
                        messageData: itemStatus,
                    });
                    ScanInfoHashStatus({infoHashes, itemCallback, api});
                    reply({status: 'SCANNING_STARTED'});
                } catch (exc) {
                    reply({status: 'ERROR', message: exc + ''});
                }
            } else {
                console.log('Unexpected message from client', data);
                reply({status: 'UNEXPECTED_MESSAGE_TYPE'});
            }
        });
    });
    const server = http
        .createServer((rq, rs) => handleRq({rq, rs, rootPath, api}))
        .listen(HTTP_PORT, '0.0.0.0', () => {
            console.log('listening kunkka-torrent requests on http://localhost:' + HTTP_PORT);
        });
    socketIo.listen(server);
};

export default Server;