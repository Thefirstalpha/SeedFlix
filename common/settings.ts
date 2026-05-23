export interface TransmissionSettings {
    host: string;
    port: number;
    authRequired: boolean | false;
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
}