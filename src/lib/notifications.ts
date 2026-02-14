import { messagingAdmin } from "./firebase-admin";

export async function sendNotification(title: string, summary: string, newsId: string) {
    try {
        const message = {
            notification: {
                title: title,
                body: summary.slice(0, 100) + "...", // Truncate for notification body
            },
            data: {
                newsId: newsId,
                click_action: "FLUTTER_NOTIFICATION_CLICK", // Common for Flutter
            },
            topic: "news", // Subscribe users to 'news' topic in app
        };

        const response = await messagingAdmin.send(message);
        console.log("Successfully sent message:", response);
        return response;
    } catch (error) {
        console.error("Error sending notification:", error);
        // Don't throw, just log. Notification failure shouldn't break the app flow.
        return null;
    }
}
