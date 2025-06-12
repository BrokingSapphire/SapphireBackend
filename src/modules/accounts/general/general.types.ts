import { ChartProvider, Theme } from "@app/database/db";
import { DefaultResponseData } from "@app/types";

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

export type TwoFactorMethod = 'email_otp' | 'authenticator' | 'disabled';

export interface UserSettings {
    theme: Theme;
    biometricAuthentication: boolean;
    twoFactorAuth: TwoFactorMethod;
    chartProvider: ChartProvider;
    orderNotifications: boolean;
    tradeNotifications: boolean;
    tradeRecommendations: boolean;
    promotion: boolean;
}

export interface UserPermissions {
    internet: boolean;
    storage: boolean;
    location: boolean;
    smsReading: boolean;
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
    reason?: string;
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