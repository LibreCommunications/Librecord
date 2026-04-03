export interface EventBus {
    on<T>(event: string, handler: (detail: T) => void): () => void;
    onPlain(event: string, handler: () => void): () => void;
    dispatch<T>(event: string, detail: T): void;
    dispatchPlain(event: string): void;
}
