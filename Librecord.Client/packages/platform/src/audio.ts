export interface AudioService {
    playUrl(url: string): void;
    playBuffer(buffer: ArrayBuffer, contentType: string): void;
}
