export type AdProvider = 'admob' | 'custom' | 'none';

export interface AdPositionConfig {
    enabled: boolean;
    provider: AdProvider;
    unit_id?: string;
    custom_image_url?: string;
    custom_link_url?: string;
}

export interface AppAdConfig {
    global_enabled: boolean;
    banner: AdPositionConfig;
    native: AdPositionConfig;
    interstitial: AdPositionConfig;
    last_updated?: string; // ISO String
}
