export interface TorrentDownloadItem {
    id: number;
    name: string;
    status: number;
    statusLabel: string;
    progress: number;
    rateDownload: number;
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
    managedBySeedflix?: boolean;
}

export interface TorrentDownloadsResponse {
    ok: boolean;
    torrents: TorrentDownloadItem[];
    activeCount: number;
}