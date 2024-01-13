export const ConnectionError = {
    timout: 'Timeout',
    refused: 'Connection refused',
    unknown: 'Unknown error',
} as const;

export type ConnectionError = typeof ConnectionError[keyof typeof ConnectionError];

export const Commands = {
    connection_established: 'connection_established',
    backup_server: 'backup_server',
} as const;

export type Commands = typeof Commands[keyof typeof Commands];
