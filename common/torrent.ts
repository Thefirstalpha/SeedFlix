export interface TorrentDownloadItem {
    id: number;
    name: string;
    status: number;
    statusLabel: string;
    progress: number;
    rateDownload: number;
    rateUpload: number;
    eta: number;
    totalSize: number;
    downloadDir: string;
    addedDate: number;
    isFinished: boolean;
    leftUntilDone: number;
    peersConnected: number;
    error: number;
    errorString: string;
    hashString: string;
    uploadRatio: number;
    uploadedEver: number;
    managedBySeedflix?: boolean;
}

export interface TorrentDownloadsResponse {
    ok: boolean;
    torrents: TorrentDownloadItem[];
    activeCount: number;
}


export interface TorrentStatsResponse {
    activeTorrentCount: number;
    pausedTorrentCount: number;
    torrentCount: number;
    downloadSpeed: number;
    uploadSpeed: number;
}