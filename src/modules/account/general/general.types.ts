import { ChartProvider } from '@app/database/db';
import { DefaultResponseData } from '@app/types';

export enum ProfileSection {
    GENERAL = 'general',
    MANAGE = 'manage',
    REPORTS = 'reports',
    SUPPORT = 'support',
    OTHERS = 'others',
}

export enum GeneralAction {
    KNOW_YOUR_PARTNER = 'know-your-partner',
    SETTINGS = 'settings',
    CHANGE_PIN = 'change-pin',
    SWITCH_ACCOUNT = 'switch-account',
    LOGOUT = 'logout',
}

export enum TradingSegment {
    EQUITY_CASH = 'equity_cash',
    EQUITY_DERIVATIVES = 'equity_derivatives',
    CURRENCY_DERIVATIVES = 'currency_derivatives',
    COMMODITY_DERIVATIVES = 'commodity_derivatives',
}

export interface UserOrderPreferences {
    [key: string]: any;
}
export enum TwoFactorMethod {
    DISABLED = 'disabled',
    SMS_OTP = 'sms_otp',
    AUTHENTICATOR = 'authenticator',
}

export interface TwoFactorSetupRequest {
    method: TwoFactorMethod;
}

export interface TwoFactorSetupResponse extends DefaultResponseData {
    data: {
        method: TwoFactorMethod;
        secret?: string;
        qrCodeUrl?: string;
        manualEntryKey?: string;
        maskedPhone?: string;
        sessionId: string;
    };
}
export interface TwoFactorVerifySetupRequest {
    method: TwoFactorMethod;
    token: string;
    sessionId: string;
    secret?: string;
}

export interface TwoFactorStatusResponse extends DefaultResponseData {
    data: {
        method: TwoFactorMethod;
        enabled: boolean;
        maskedPhone?: string;
    };
}

export interface TwoFactorDisableRequest {
    password: string;
    token: string;
}

export interface UserSettings {
    twoFactorAuth: TwoFactorMethod;
    chartProvider: ChartProvider;
    orderNotifications: boolean;
    tradeNotifications: boolean;
    tradeRecommendations: boolean;
    promotion: boolean;
}

export interface UserPermissions {
    internet: boolean;
    notification: boolean;
    biometric: boolean;
}

export interface NotificationSettings {
    orderNotifications: boolean;
    tradeNotifications: boolean;
    tradeRecommendations: boolean;
    promotion: boolean;
}

export interface DeleteAccountInitiateRequest {
    reason: string[];
}

export interface DeleteAccountVerifyRequest {
    otp: string;
    sessionId: string;
}

export interface KnowYourPartnerType {
    companyName: string;
    supportContact: number;
    supportEmail: string;
    supportAddress: string;
}

export interface KnowYourPartnerResponse extends DefaultResponseData {
    data: KnowYourPartnerType;
}

export interface DeviceInfo {
    browser?: string;
    device?: string;
    deviceType?: string;
    userAgent?: string;
}

export interface LocationInfo {
    city?: string;
    region?: string;
    country?: string;
}

export interface CurrentSessionInfo {
    sessionId: number;
    ipAddress: string;
    deviceInfo: DeviceInfo;
    locationData: LocationInfo;
    sessionStart: Date;
    lastActivity: Date;
}

export interface CurrentSessionResponse extends DefaultResponseData {
    data: CurrentSessionInfo;
}
