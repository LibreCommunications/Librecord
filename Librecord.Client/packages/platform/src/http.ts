export interface HttpClient {
    fetch(url: string, options?: RequestInit): Promise<Response>;
}
