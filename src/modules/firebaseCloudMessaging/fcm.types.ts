export interface SaveFcmTokenType {
    clientId: string;
    fcmToken: string;
}
export interface DeleteFcmTokenType {
    clientId: string;
    fcmToken: string;
}

export interface SendNotificationToUserType {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    options?: {
        imageUrl?: string;
        clickAction?: string;
        badge?: string;
    };
}

export interface SendBulkNotificationType {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
    options?: {
        imageUrl?: string;
        clickAction?: string;
        badge?: string;
    };
}

export interface SendTopicNotificationType {
    topic: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    options?: {
        imageUrl?: string;
        clickAction?: string;
    };
}
