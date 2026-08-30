export interface TransmissionSettings {
    host: string;
    port: number;
    authRequired: boolean;
    username: string | null;
    password: string | null | undefined;
    moviesFolder: string;
    seriesFolder: string;
}

export interface IndexerSettings {
    url: string;
    token: string | null | undefined;
    qualities: string[];
    languages: string[];
    autoDownload?: boolean;
}


export interface FtpSettings {
    host: string;
    port: number;
    secure: boolean;
    authRequired: boolean;
    username: string | undefined;
    password: string | undefined;
    rootFolder: string;
    storageLimit: number | null;
}