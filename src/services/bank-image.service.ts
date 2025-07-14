// services/bank-image.service.ts
export class BankImageService {
    private static readonly BASE_PATH = '/Bank Logo/';
    private static readonly DEFAULT_BANK_IMAGE = 'State Bank of India.svg';

    private static readonly BANK_IMAGE_MAPPING: Record<string, string> = {
        // Indian Public Sector Banks
        'STATE BANK OF INDIA': 'State Bank of India.svg',
        SBI: 'State Bank of India.svg',
        'BANK OF BARODA': 'Bank of Baroda.svg',
        BOB: 'Bank of Baroda.svg',
        'PUNJAB NATIONAL BANK': 'Punjab National Bank.svg',
        PNB: 'Punjab National Bank.svg',
        'CANARA BANK': 'Canara Bank.svg',
        'UNION BANK OF INDIA': 'Union Bank.svg',
        UBI: 'Union Bank.svg',
        'UNION BANK': 'Union Bank.svg',
        'BANK OF INDIA': 'Bank of India.svg',
        BOI: 'Bank of India.svg',
        'CENTRAL BANK OF INDIA': 'Central Bank of India.svg',
        'INDIAN BANK': 'Indian Bank.svg',
        'INDIAN OVERSEAS BANK': 'Indian Overseas Bank.svg',
        IOB: 'Indian Overseas Bank.svg',
        'UCO BANK': 'UCO Bank.svg',
        'BANK OF MAHARASHTRA': 'Bank of Maharastra.svg',
        'BANK OF MAHARASTRA': 'Bank of Maharastra.svg',
        'PUNJAB AND SIND BANK': 'Punjab & Sind Bank.svg',
        'PUNJAB & SIND BANK': 'Punjab & Sind Bank.svg',

        // Indian Private Sector Banks
        'HDFC BANK': 'HDFC Bank.svg',
        'HDFC BANK LIMITED': 'HDFC Bank.svg',
        'ICICI BANK': 'ICICI Bank.svg',
        'ICICI BANK LIMITED': 'ICICI Bank.svg',
        'AXIS BANK': 'Axis bank.svg',
        'AXIS BANK LIMITED': 'Axis bank.svg',
        'KOTAK MAHINDRA BANK': 'Kotak Mahindra Bank.svg',
        'KOTAK MAHINDRA BANK LIMITED': 'Kotak Mahindra Bank.svg',
        'YES BANK': 'Yes Bank.svg',
        'YES BANK LIMITED': 'Yes Bank.svg',
        'INDUSIND BANK': 'Induslnd Bank.svg',
        'INDUSIND BANK LIMITED': 'Induslnd Bank.svg',
        'INDUSLND BANK': 'Induslnd Bank.svg',
        'RBL BANK': 'RBL Bank.svg',
        'RBL BANK LIMITED': 'RBL Bank.svg',
        'DCB BANK': 'DCB Bank.svg',
        'DCB BANK LIMITED': 'DCB Bank.svg',
        'IDBI BANK': 'IDBI Bank.svg',
        'IDBI BANK LIMITED': 'IDBI Bank.svg',
        'IDFC FIRST BANK': 'IDFC Bank.svg',
        'IDFC FIRST BANK LIMITED': 'IDFC Bank.svg',
        'IDFC BANK': 'IDFC Bank.svg',
        'BANDHAN BANK': 'Bandhan Bank.svg',
        'BANDHAN BANK LIMITED': 'Bandhan Bank.svg',
        'FEDERAL BANK': 'HDFC Bank.svg',
        'FEDERAL BANK LIMITED': 'HDFC Bank.svg',

        // Regional Rural Banks
        'SOUTH INDIAN BANK': 'South Indian Bank.svg',
        'SOUTH INDIAN BANK LIMITED': 'South Indian Bank.svg',
        'KARNATAKA BANK': 'Karnataka Bank.svg',
        'KARNATAKA BANK LIMITED': 'Karnataka Bank.svg',
        'CITY UNION BANK': 'City Union Bank.svg',
        'CITY UNION BANK LIMITED': 'City Union Bank.svg',
        'JAMMU AND KASHMIR BANK': 'Jammu & Kashmir Bank.svg',
        'J&K BANK': 'Jammu & Kashmir Bank.svg',
        'JAMMU & KASHMIR BANK': 'Jammu & Kashmir Bank.svg',
        'TAMILNAD MERCANTILE BANK': 'Tamilnad Mercantile Bank.svg',
        TMB: 'Tamilnad Mercantile Bank.svg',
        'DHANLAXMI BANK': 'Dhanlaxmi Bank.svg',
        'NAINITAL BANK': 'Nainital Bank.svg',
        'CSB BANK': 'CSB Bank.svg',
        'CATHOLIC SYRIAN BANK': 'CSB Bank.svg',

        // Small Finance Banks
        'AU SMALL FINANCE BANK': 'AU Small Finance Bank.svg',
        'AU BANK': 'AU Small Finance Bank.svg',
        'ESAF SMALL FINANCE BANK': 'ESAF Small Finance Bank Ltd.svg',
        'ESAF BANK': 'ESAF Small Finance Bank Ltd.svg',
        'UJJIVAN SMALL FINANCE BANK': 'Ujjivan Small Finance Bank.svg',
        'UJJIVAN BANK': 'Ujjivan Small Finance Bank.svg',

        // Payment Banks
        'AIRTEL PAYMENTS BANK': 'Airtel Payments Bank.svg',
        'PAYTM PAYMENTS BANK': 'Paytm Payments Bank.svg',
        'FINO PAYMENTS BANK': 'FINO Payments Bank.svg',
        'INDIA POST PAYMENTS BANK': 'India Post Payments Bank.svg',
        'JIO PAYMENTS BANK': 'Jio Payments Bank.svg',

        // International Banks in India
        'STANDARD CHARTERED BANK': 'Standard Chartered Bank.svg',
        'STANDARD CHARTERED': 'Standard Chartered Bank.svg',
        'HSBC BANK': 'HSBC Bank.svg',
        HSBC: 'HSBC Bank.svg',
        'HONGKONG AND SHANGHAI BANKING CORPORATION': 'HSBC Bank.svg',
        CITIBANK: 'Citi Bank.svg',
        'CITI BANK': 'Citi Bank.svg',
        CITICORP: 'Citi Bank.svg',
        'DEUTSCHE BANK': 'Deutsche Bank.svg',
        'DBS BANK': 'DBS Bank.svg',
        'DEVELOPMENT BANK OF SINGAPORE': 'DBS Bank.svg',

        // Middle Eastern Banks
        'ABU DHABI COMMERCIAL BANK': 'Abu Dhabi Commercial Bank.svg',
        ADCB: 'Abu Dhabi Commercial Bank.svg',
        'EMIRATES NBD': 'Emirates NBD.svg',
        'FIRST ABU DHABI BANK': 'First Abu Dhabi Bank.svg',
        FAB: 'First Abu Dhabi Bank.svg',
        'DOHA BANK': 'Doha Bank.svg',
        'QATAR NATIONAL BANK': 'Qatar National Bank.svg',
        QNB: 'Qatar National Bank.svg',

        // US Banks
        'BANK OF AMERICA': 'Bank of America.svg',
        'JPMORGAN CHASE': 'JPMorgan Chase.svg',
        'JP MORGAN CHASE': 'JPMorgan Chase.svg',
        'AMERICAN EXPRESS': 'American Express.svg',
        AMEX: 'American Express.svg',

        // European Banks
        'BARCLAYS BANK': 'Barclays Bank.svg',
        BARCLAYS: 'Barclays Bank.svg',
        'BNP PARIBAS': 'BNP Paribas.svg',
        'CREDIT AGRICOLE': 'Crédit Agricole Corporate and Investment Bank.svg',
        'CRÉDIT AGRICOLE': 'Crédit Agricole Corporate and Investment Bank.svg',
        'SOCIETE GENERALE': 'Société Générale.svg',
        'SOCIÉTÉ GÉNÉRALE': 'Société Générale.svg',
        'CREDIT SUISSE': 'Credit Suisse.svg',
        'ABN AMRO': 'ABN AMRO.svg',
        'NATWEST BANK': 'NatWest Bank.svg',
        NATWEST: 'NatWest Bank.svg',
        SBERBANK: 'Sberbank.svg',

        // Australian Banks
        'AUSTRALIA AND NEW ZEALAND BANKING GROUP': 'Australia and New Zealand Banking Group.svg',
        'ANZ BANK': 'Australia and New Zealand Banking Group.svg',
        ANZ: 'Australia and New Zealand Banking Group.svg',
        WESTPAC: 'Westpac.svg',
        'SCOTIA BANK': 'Scotia Bank.svg',

        // Japanese Banks
        'SUMITOMO MITSUI BANKING CORPORATION': 'Sumitomo Mitsui Banking Corporation.svg',
        SMBC: 'Sumitomo Mitsui Banking Corporation.svg',
        'MIZUHO BANK': 'Mizuho Corporate Bank.svg',
        'MIZUHO CORPORATE BANK': 'Mizuho Corporate Bank.svg',
        'MUFG BANK': 'MUFG Bank.svg',
        'MITSUBISHI UFJ FINANCIAL GROUP': 'MUFG Bank.svg',

        // Chinese Banks
        'INDUSTRIAL AND COMMERCIAL BANK OF CHINA': 'Industrial & Commercial Bank of China.svg',
        ICBC: 'Industrial & Commercial Bank of China.svg',
        'BANK OF CHINA': 'Bank of China.svg',

        // South Korean Banks
        'KEB HANA BANK': 'KEB Hana Bank.svg',
        'SHINHAN BANK': 'Shinhan Bank.svg',
        'WOORI BANK': 'Woori Bank.svg',
        'KOOKMIN BANK': 'Kookmin Bank.svg',
        'INDUSTRIAL BANK OF KOREA': 'Industrial Bank of Korea.svg',

        // Thai Banks
        'KRUNG THAI BANK': 'Krung Thai Bank.svg',

        // Other Southeast Asian Banks
        'UNITED OVERSEAS BANK': 'United Overseas Bank.svg',
        UOB: 'United Overseas Bank.svg',
        'BANK MAYBANK INDONESIA': 'Bank Maybank Indonesia.svg',
        MAYBANK: 'Bank Maybank Indonesia.svg',

        // Other Banks
        'BANK OF BAHRAIN AND KUWAIT': 'Bank of Bahrain and Kuwait.svg',
        BBK: 'Bank of Bahrain and Kuwait.svg',
        'BANK OF CEYLON': 'Bank of Ceylon.svg',
        'SONALI BANK': 'Sonali Bank.svg',
        'FIRSTRAND BANK': 'FirstRand Bank.svg',
    };

    /**
     * Get bank image URL for a given bank name
     * @param bankName - The bank name from IFSC response
     * @returns Complete image URL path
     */
    public static getBankImageUrl(bankName: string): string {
        if (!bankName) {
            return this.BASE_PATH + this.DEFAULT_BANK_IMAGE;
        }

        const normalizedBankName = this.normalizeBankName(bankName);

        let imageFileName = this.BANK_IMAGE_MAPPING[normalizedBankName];

        // If no exact match, try partial matching
        if (!imageFileName) {
            imageFileName = this.findPartialMatch(normalizedBankName) || this.DEFAULT_BANK_IMAGE;
        }

        // Return default if no match found
        if (!imageFileName) {
            imageFileName = this.DEFAULT_BANK_IMAGE;
        }

        return this.BASE_PATH + imageFileName;
    }

    /**
     * Normalize bank name for consistent matching
     * @param bankName - Raw bank name
     * @returns Normalized bank name
     */
    private static normalizeBankName(bankName: string): string {
        return bankName
            .toUpperCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\bLIMITED\b|\bLTD\b/g, '')
            .trim();
    }

    /**
     * Find partial match for bank name
     * @param normalizedBankName - Normalized bank name
     * @returns Image filename if partial match found
     */
    private static findPartialMatch(normalizedBankName: string): string | undefined {
        for (const [key, value] of Object.entries(this.BANK_IMAGE_MAPPING)) {
            const normalizedKey = this.normalizeBankName(key);

            if (normalizedBankName.includes(normalizedKey) || normalizedKey.includes(normalizedBankName)) {
                return value;
            }
        }

        return undefined;
    }

    /**
     * Get all available bank images
     * @returns Array of all bank image URLs
     */
    public static getAllBankImages(): string[] {
        const uniqueImages = [...new Set(Object.values(this.BANK_IMAGE_MAPPING))];
        return uniqueImages.map((filename) => this.BASE_PATH + filename);
    }

    /**
     * Check if bank image exists for given bank name
     * @param bankName - Bank name to check
     * @returns Boolean indicating if image exists
     */
    public static hasBankImage(bankName: string): boolean {
        if (!bankName) return false;

        const normalizedBankName = this.normalizeBankName(bankName);
        return (
            this.BANK_IMAGE_MAPPING.hasOwnProperty(normalizedBankName) || !!this.findPartialMatch(normalizedBankName)
        );
    }

    /**
     * Get bank name suggestions for debugging
     * @param bankName - Bank name to find suggestions for
     * @returns Array of possible matches
     */
    public static getBankNameSuggestions(bankName: string): string[] {
        if (!bankName) return [];

        const normalizedInput = this.normalizeBankName(bankName);
        const suggestions: string[] = [];

        for (const key of Object.keys(this.BANK_IMAGE_MAPPING)) {
            const normalizedKey = this.normalizeBankName(key);
            if (normalizedKey.includes(normalizedInput) || normalizedInput.includes(normalizedKey)) {
                suggestions.push(key);
            }
        }

        return suggestions;
    }
}
