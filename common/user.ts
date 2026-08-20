import { FtpSettings, IndexerSettings, TransmissionSettings } from "./settings";

export interface WebPushSubscription {
    id: string;
    name: string;
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    createdAt: string;
}

export interface StatusBarNotification {
    title: string;
    message: string;
    type: string;
    id: string;
}

export interface UserStatusBar {
    downloads: number;
    notifications: number;
    wishlist: number;
    latestNotification?: StatusBarNotification | null;
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
        ftp: FtpSettings | null;
        language?: string | null;
        spoilerMode?: boolean | null;
    };
    notifications: {
        discord: {
            webhookUrl: string | null;
        } | null;
        web: {
            subscriptions: WebPushSubscription[];
        };
    };
}