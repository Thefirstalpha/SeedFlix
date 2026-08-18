import { IndexerSettings, TransmissionSettings } from "./settings";

export interface UserStatusBar {
    downloads: number;
    notifications: number;
    wishlist: number;
}

export interface User {
    id: number;
    username: string;
    flags: {
        mustSetup: boolean;
        mustUpdatePassword: boolean;
        legalAccepted: boolean;
    };
    settings: {
        indexer: IndexerSettings | null;
        transmission: TransmissionSettings | null;
        language?: string | null;
        spoilerMode?: boolean | null;
    };
}