interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
    const content: string;
    export default content;
}

declare module "*.svg" {
    const src: string;
    export default src;
}
