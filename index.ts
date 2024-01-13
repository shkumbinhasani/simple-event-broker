import WebSocket from 'ws';
import {Commands, ConnectionError} from "./types";

const PORT = 61089;

function startServer() {
    const wsServer = new WebSocket.Server({port: PORT});
    const clients = new Map<string, {
        ws: WebSocket,
        connectionTime: number,
    }>();

    wsServer.on('connection', (ws, request) => {
        const identifier = Math.random().toString(36).substring(7);
        const isServer = request.url?.includes('?server');
        const connectionTime = Date.now();

        ws.send(Commands.connection_established);

        if (!isServer) {
            clients.set(identifier, {
                ws,
                connectionTime
            });
            updateBackupServer();
        }

        ws.on('message', (message) => {
            wsServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });

        ws.on('close', () => {
            clients.delete(identifier);
            updateBackupServer(); // Call function to update backup server if needed
        });
    });

    const updateBackupServer = () => {
        let oldestClient = null;
        let oldestTime = Date.now();

        clients.forEach((client) => {
            if (client.connectionTime < oldestTime) {
                oldestTime = client.connectionTime;
                oldestClient = client.ws;
            }
        });

        if (oldestClient) {
            oldestClient.send(Commands.backup_server);
        }
    };
}

function connectToServer(args: {
    onMessage: (message: string) => void,
    amITheServer?: boolean,
    onBecomeServer?: () => void,
    onReconnect?: () => void,
}) {
    return new Promise<WebSocket>((resolve, reject) => {
        let isBackupServer = false;
        let connectionEstablished = false;
        const timeout = setTimeout(() => {
            reject(ConnectionError.timout);
        }, 1000);

        const socket = new WebSocket(`ws://localhost:${PORT}` + (args.amITheServer ? '?server' : ''));

        socket.on('message', (message) => {
            if (message.toString() === Commands.connection_established) {
                clearTimeout(timeout);
                connectionEstablished = true;
                resolve(socket);
            } else if (message.toString() === Commands.backup_server) {
                isBackupServer = true;
            } else {
                args.onMessage(message.toString());
            }
        });

        socket.on('error', (error) => {
            clearTimeout(timeout)
            reject(ConnectionError.refused);
        });

        socket.on('close', () => {
            if (!connectionEstablished) {
                return;
            }

            if (isBackupServer) {
                args.onBecomeServer?.();
                return;
            }

            setTimeout(() => {
                args.onReconnect?.();
            }, 100);
        });
    });
}

export const createBroker = (onMessage: (message: string) => void) => {
    let socket = null;
    const connectOrStartServer = (args: {
        createServer: boolean,
        isServer: boolean,
    }) => {
        if (args.createServer) {
            startServer();
            connectOrStartServer({createServer: false, isServer: true});
        } else {
            connectToServer({
                onMessage,
                onBecomeServer: () => connectOrStartServer({createServer: true, isServer: true}),
                onReconnect: () => connectOrStartServer({createServer: false, isServer: false}),
                amITheServer: args.isServer,
            }).then((ws) => {
                socket = ws;
            }).catch((error) => {
                if (error === ConnectionError.timout) console.error('Port is not open, or use a different port');
                else if (error === ConnectionError.refused) connectOrStartServer({createServer: true, isServer: false});
            });
        }
    }

    connectOrStartServer({createServer: false, isServer: false});

    return {
        send: (message: string) => {
            if (socket) socket.send(message);
            else console.log('Connection is not established yet', {message});
        },
    }
}
