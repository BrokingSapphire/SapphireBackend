import { sql } from 'kysely';
import { db } from '@app/database';

export const DEPARTMENT_CODES = {
    ADM: 'Admin / Operations',
    ACC: 'Accounts & Finance',
    KYC: 'KYC & Onboarding',
    IPV: 'In-Person Verification',
    TRD: 'Trading Desk / Trade Operations',
    RMS: 'Risk Management System',
    CLM: 'Client Management / Relationship Management',
    // Demat & Depository
    DMT: 'Demat Operations',
    DPB: 'Depository Participant Backoffice',

    // Compliance & Legal
    COM: 'Compliance',
    AUD: 'Internal & External Audits',
    LEG: 'Legal Affairs',

    // Support & Technical
    TKT: 'Support & Ticketing',
    DEV: 'IT Development',
    INF: 'Infrastructure (IT)',
    API: 'API Integration',

    // Business Functions
    MKT: 'Marketing & Communication',
    HRM: 'Human Resources',
} as const;

export type DepartmentCode = keyof typeof DEPARTMENT_CODES;

export default class SRNGenerator {
    constructor(private readonly departmentCode: DepartmentCode) {}

    generateRandomSRN(): string {
        const dateStr = this.getCurrentDateString();
        const randomSuffix = this.generateRandomSuffix();

        return `SRN-${dateStr}-${this.departmentCode}-${randomSuffix}`;
    }

    generateTimestampSRN(): string {
        const dateStr = this.getCurrentDateString();
        const timeStr = this.getCurrentTimeString();

        return `SRN-${dateStr}-${this.departmentCode}-${timeStr}`;
    }
    private getCurrentDateString(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        return `${year}${month}${day}`;
    }

    private getCurrentTimeString(): string {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${hours}${minutes}${seconds}`;
    }

    private generateRandomSuffix(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';

        for (let i = 0; i < 5; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars[randomIndex];
        }

        return result;
    }

    static isValidDepartmentCode(code: string): code is DepartmentCode {
        return code in DEPARTMENT_CODES;
    }

    getDepartmentDescription(): string {
        return DEPARTMENT_CODES[this.departmentCode];
    }
}
