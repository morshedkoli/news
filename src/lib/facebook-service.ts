import { dbAdmin } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
    FacebookPage,
    FacebookTokenResponse,
    FacebookPostData,
    FacebookPostResponse,
    FacebookErrorResponse,
    FacebookPageConnection
} from '@/types/facebook';

const FACEBOOK_GRAPH_API = 'https://graph.facebook.com/v18.0';
const FACEBOOK_OAUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';

export class FacebookService {
    private static async getAppInfo(): Promise<{ appName: string; playStoreUrl?: string }> {
        const appName = process.env.APP_NAME || 'NewsByte';

        try {
            const appDoc = await dbAdmin.collection('app_config').doc('version').get();
            if (appDoc.exists) {
                const data = appDoc.data();
                const playStoreUrl = typeof data?.play_store_url === 'string' ? data.play_store_url.trim() : '';
                return {
                    appName,
                    playStoreUrl: playStoreUrl || undefined
                };
            }
        } catch (error) {
            console.error('Error loading app config for Facebook posts:', error);
        }

        return { appName };
    }
    /**
     * Load Facebook credentials from Firestore or fallback to env vars
     */
    private static async getCredentials(): Promise<{
        appId: string;
        appSecret: string;
        redirectUri: string;
    }> {
        try {
            // Try to load from Firestore first
            const settingsDoc = await dbAdmin.collection('system_settings').doc('facebook').get();

            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                if (data?.app_id && data?.app_secret && data?.redirect_uri) {
                    return {
                        appId: data.app_id,
                        appSecret: data.app_secret,
                        redirectUri: data.redirect_uri
                    };
                }
            }
        } catch (error) {
            console.error('Error loading Facebook credentials from Firestore:', error);
        }

        // Fallback to environment variables
        const appId = process.env.FACEBOOK_APP_ID;
        const appSecret = process.env.FACEBOOK_APP_SECRET;
        const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

        if (!appId || !appSecret || !redirectUri) {
            throw new Error('Facebook credentials not configured. Please configure in admin panel or set environment variables.');
        }

        return { appId, appSecret, redirectUri };
    }

    /**
     * Generate OAuth URL for Facebook Login
     */
    static async getOAuthURL(state?: string): Promise<string> {
        const { appId, redirectUri } = await this.getCredentials();

        const params = new URLSearchParams({
            client_id: appId,
            redirect_uri: redirectUri,
            scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
            response_type: 'code',
            state: state || ''
        });

        return `${FACEBOOK_OAUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    static async exchangeCodeForToken(code: string): Promise<string> {
        const { appId, appSecret, redirectUri } = await this.getCredentials();

        const params = new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code
        });

        const response = await fetch(`${FACEBOOK_GRAPH_API}/oauth/access_token?${params.toString()}`);

        if (!response.ok) {
            const error = await response.json() as FacebookErrorResponse;
            throw new Error(`Facebook token exchange failed: ${error.error.message}`);
        }

        const data = await response.json() as FacebookTokenResponse;
        return data.access_token;
    }

    /**
     * Get long-lived user access token (60 days)
     */
    static async getLongLivedToken(shortLivedToken: string): Promise<FacebookTokenResponse> {
        const { appId, appSecret } = await this.getCredentials();

        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken
        });

        const response = await fetch(`${FACEBOOK_GRAPH_API}/oauth/access_token?${params.toString()}`);

        if (!response.ok) {
            const error = await response.json() as FacebookErrorResponse;
            throw new Error(`Long-lived token exchange failed: ${error.error.message}`);
        }

        return await response.json() as FacebookTokenResponse;
    }

    /**
     * Fetch user's Facebook pages
     */
    static async getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
        const response = await fetch(
            `${FACEBOOK_GRAPH_API}/me/accounts?access_token=${userAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json() as FacebookErrorResponse;
            throw new Error(`Failed to fetch pages: ${error.error.message}`);
        }

        const data = await response.json();
        return data.data as FacebookPage[];
    }

    /**
     * Save Facebook page connection to Firestore
     */
    static async savePageConnection(
        page: FacebookPage,
        userId: string,
        tokenExpiresIn: number = 5184000 // 60 days in seconds
    ): Promise<string> {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenExpiresIn);

        const pageData: Omit<FacebookPageConnection, 'id'> = {
            page_id: page.id,
            page_name: page.name,
            access_token: page.access_token,
            token_expires_at: Timestamp.fromDate(expiresAt),
            enabled: true,
            added_at: FieldValue.serverTimestamp() as unknown as Timestamp,
            added_by: userId,
            total_posts: 0
        };

        const docRef = await dbAdmin.collection('facebook_pages').add(pageData);
        return docRef.id;
    }

    /**
     * Get all connected Facebook pages
     */
    static async getConnectedPages(): Promise<FacebookPageConnection[]> {
        const snapshot = await dbAdmin.collection('facebook_pages').get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as FacebookPageConnection[];
    }

    /**
     * Get enabled Facebook pages for auto-posting
     */
    static async getEnabledPages(): Promise<FacebookPageConnection[]> {
        const snapshot = await dbAdmin
            .collection('facebook_pages')
            .where('enabled', '==', true)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as FacebookPageConnection[];
    }

    /**
     * Delete a page connection
     */
    static async deletePage(pageId: string): Promise<void> {
        await dbAdmin.collection('facebook_pages').doc(pageId).delete();
    }

    /**
     * Update page settings
     */
    static async updatePageSettings(
        pageId: string,
        settings: { enabled?: boolean }
    ): Promise<void> {
        await dbAdmin.collection('facebook_pages').doc(pageId).update(settings);
    }

    /**
     * Post content to a Facebook page
     */
    static async postToPage(
        pageConnection: FacebookPageConnection,
        postData: FacebookPostData
    ): Promise<string> {
        const { access_token, page_id } = pageConnection;

        // Build form data
        const formData = new URLSearchParams();
        formData.append('message', postData.message);
        formData.append('access_token', access_token);

        if (postData.link) {
            formData.append('link', postData.link);
        }

        if (postData.picture) {
            // For link posts, Facebook automatically fetches the image from the link
            // But we can also explicitly set it
            formData.append('picture', postData.picture);
        }

        const response = await fetch(
            `${FACEBOOK_GRAPH_API}/${page_id}/feed`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            }
        );

        if (!response.ok) {
            const error = await response.json() as FacebookErrorResponse;
            throw new Error(`Facebook post failed: ${error.error.message}`);
        }

        const result = await response.json() as FacebookPostResponse;

        // Update page stats
        await dbAdmin.collection('facebook_pages').doc(pageConnection.id).update({
            last_posted_at: FieldValue.serverTimestamp(),
            total_posts: FieldValue.increment(1),
            last_error: FieldValue.delete()
        });

        return result.id;
    }

    /**
     * Post news to all enabled Facebook pages
     */
    static async postNewsToPages(
        newsId: string,
        title: string,
        summary: string,
        imageUrl?: string,
        sourceUrl?: string
    ): Promise<{
        success: Record<string, string>;  // pageId -> postId
        errors: Record<string, string>;   // pageId -> error message
    }> {
        const pages = await this.getEnabledPages();
        const success: Record<string, string> = {};
        const errors: Record<string, string> = {};
        const appInfo = await this.getAppInfo();
        const headline = appInfo.appName ? `${title} | ${appInfo.appName}` : title;
        const downloadLine = appInfo.playStoreUrl
            ? `Download ${appInfo.appName} on Play Store: ${appInfo.playStoreUrl}`
            : `Download ${appInfo.appName} on Play Store`;
        const messageParts = [headline, summary, downloadLine].filter(Boolean);
        const message = messageParts.join('\n\n');

        // Post to each page
        for (const page of pages) {
            try {
                // Check token expiry
                const expiresAt = page.token_expires_at.toDate();
                if (expiresAt < new Date()) {
                    errors[page.page_id] = 'Access token expired. Please reconnect the page.';
                    await dbAdmin.collection('facebook_pages').doc(page.id).update({
                        last_error: 'Token expired'
                    });
                    continue;
                }

                const postData: FacebookPostData = {
                    message,
                    link: sourceUrl,
                    picture: imageUrl
                };

                const postId = await this.postToPage(page, postData);
                success[page.page_id] = postId;

            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unknown error";
                console.error(`Failed to post to Facebook page ${page.page_name}:`, error);
                errors[page.page_id] = message;

                // Update page with error
                await dbAdmin.collection('facebook_pages').doc(page.id).update({
                    last_error: message
                });
            }
        }

        // Update news document with Facebook post info
        if (Object.keys(success).length > 0 || Object.keys(errors).length > 0) {
            const updateData: Record<string, unknown> = {
                facebook_posted_at: FieldValue.serverTimestamp()
            };

            if (Object.keys(success).length > 0) {
                updateData.facebook_post_ids = success;
            }

            if (Object.keys(errors).length > 0) {
                updateData.facebook_post_errors = errors;
            }

            await dbAdmin.collection('news').doc(newsId).update(updateData);
        }

        return { success, errors };
    }
}
