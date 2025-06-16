export enum NotificationTemplateType {
    SUCCESSFUL_ACCOUNT_OPEN = 'SUCCESSFUL_ACCOUNT_OPEN',
    MARGIN_SHORTFALL_ALERT = 'MARGIN_SHORTFALL_ALERT',
    PAYOUT_REJECTED = 'PAYOUT_REJECTED',
    FUNDS_ADDED = 'FUNDS_ADDED',
    ACCOUNT_SUSPENSION_NOTICE = 'ACCOUNT_SUSPENSION_NOTICE',
}

export interface NotificationTemplate {
    title: string;
    body: string;
    data?: Record<string, string>;
    options?: {
        imageUrl?: string;
        clickAction?: string;
        badge?: string;
    };
}

const notificationTemplateMap: Record<NotificationTemplateType, NotificationTemplate> = {
    [NotificationTemplateType.SUCCESSFUL_ACCOUNT_OPEN]: {
        title: 'Account Successfully Opened! 🎉',
        body: 'Dear {#name#}, congratulations! Your Sapphire account is now active. Start trading now on our terminal.',
        data: {
            type: 'account_opened',
            action: 'open_terminal',
        },
        options: {
            clickAction: 'terminal.sapphirebroking.com',
            badge: '1',
        },
    },

    [NotificationTemplateType.MARGIN_SHORTFALL_ALERT]: {
        title: 'Margin Shortfall Alert ⚠️',
        body: 'Dear {#name#}, your account has a margin shortfall of ₹{#amount#}. Please add funds to avoid RMS square off.',
        data: {
            type: 'margin_alert',
            action: 'add_funds',
        },
        options: {
            clickAction: '/add-funds',
            badge: '1',
        },
    },
    [NotificationTemplateType.PAYOUT_REJECTED]: {
        title: 'Payout Request Rejected ❌',
        body: 'Dear {#name#}, your payout request of ₹{#amount#} has been rejected due to {#reason#}. Please check and retry.',
        data: {
            type: 'payout_rejected',
            action: 'view_payout',
        },
        options: {
            clickAction: '/payout-history',
            badge: '1',
        },
    },

    [NotificationTemplateType.FUNDS_ADDED]: {
        title: 'Funds Added Successfully ✅',
        body: 'Dear {#name#}, ₹{#amount#} has been added to your account. Available balance: ₹{#balance#}.',
        data: {
            type: 'funds_added',
            action: 'view_balance',
        },
        options: {
            clickAction: '/account-summary',
            badge: '1',
        },
    },

    [NotificationTemplateType.ACCOUNT_SUSPENSION_NOTICE]: {
        title: 'Account Suspended 🚫',
        body: 'Dear {#name#}, your account has been temporarily suspended due to {#reason#}. Please contact support for assistance.',
        data: {
            type: 'account_suspended',
            action: 'contact_support',
        },
        options: {
            clickAction: '/support',
            badge: '1',
        },
    },
};

export default notificationTemplateMap;
