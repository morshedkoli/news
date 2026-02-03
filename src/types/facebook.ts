import { Timestamp } from 'firebase-admin/firestore';

/**
 * Facebook Page Connection stored in Firestore
 */
export interface FacebookPageConnection {
    id: string;                      // Firestore doc ID
    page_id: string;                 // Facebook Page ID
    page_name: string;               // Page display name
    access_token: string;            // Long-lived page access token
    token_expires_at: Timestamp;     // Token expiration date
    enabled: boolean;                // Auto-posting enabled for this page
    added_at: Timestamp;             // When page was connected
    added_by: string;                // Admin user ID
    last_posted_at?: Timestamp;      // Last successful post time
    last_error?: string;             // Last error message
    total_posts: number;             // Total posts made to this page
}

/**
 * Facebook Page from API response
 */
export interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
}

/**
 * Facebook Token Response
 */
export interface FacebookTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
}

/**
 * Data for posting to Facebook
 */
export interface FacebookPostData {
    message: string;           // Post text content
    link?: string;            // URL to share
    picture?: string;         // Image URL
}

/**
 * Facebook Post Response
 */
export interface FacebookPostResponse {
    id: string;               // Post ID (format: {page-id}_{post-id})
}

/**
 * Facebook API Error Response
 */
export interface FacebookErrorResponse {
    error: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number;
        fbtrace_id?: string;
    };
}
