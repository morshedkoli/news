export interface AppVersionConfig {
    latest_version: string;
    force_update: boolean;
    update_message: string;
    play_store_url: string;
    last_updated?: string;
}
