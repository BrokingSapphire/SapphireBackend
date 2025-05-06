import { RiskScore } from '@app/database/db';
import { RiskCategory, OccupationRiskGroup } from '../modules/rms/rms.types';

// Mapping the occupation to risk groups
const occupationToRiskGroup: Record<string, OccupationRiskGroup> = {
    Professional: OccupationRiskGroup.STABLE,
    'Government/Public Sector': OccupationRiskGroup.STABLE,
    Business: OccupationRiskGroup.STABLE,
    'Private Sector': OccupationRiskGroup.MEDIUM,
    Agriculturist: OccupationRiskGroup.MEDIUM,
    Student: OccupationRiskGroup.VULNERABLE,
    Housewife: OccupationRiskGroup.VULNERABLE,
    Retired: OccupationRiskGroup.VULNERABLE,
    Others: OccupationRiskGroup.VULNERABLE,
};

export const calculateRiskScore = (
    annualIncome: string,
    tradingExperience: string,
    occupation: string,
    maritalStatus: string,
    politicallyExposed: string,
): RiskScore => {
    let annualIncomeScore = 0;
    if (annualIncome === 'le_1_Lakh' || annualIncome === '1_5_Lakh') {
        annualIncomeScore = 2;
    } else if (annualIncome === '5_10_Lakh' || annualIncome === '10_25_Lakh') {
        annualIncomeScore = 1;
    } else if (annualIncome === '25_1_Cr' || annualIncome === 'Ge_1_Cr') {
        annualIncomeScore = 0;
    }

    let tradingExperienceScore = 0;
    if (tradingExperience === '1' || tradingExperience === null) {
        tradingExperienceScore = 2;
    } else if (tradingExperience === '1-5') {
        tradingExperienceScore = 1;
    } else if (tradingExperience === '5-10' || tradingExperience === '10') {
        tradingExperienceScore = 0;
    }

    let occupationScore = 0;
    const riskGroup = occupationToRiskGroup[occupation] || OccupationRiskGroup.VULNERABLE;

    if (riskGroup === OccupationRiskGroup.VULNERABLE) {
        occupationScore = 2;
    } else if (riskGroup === OccupationRiskGroup.MEDIUM) {
        occupationScore = 1;
    } else if (riskGroup === OccupationRiskGroup.STABLE) {
        occupationScore = 0;
    }

    let maritalStatusScore = 0;
    if (maritalStatus === 'Divorced') {
        maritalStatusScore = 2;
    } else if (maritalStatus === 'Single') {
        maritalStatusScore = 1;
    } else if (maritalStatus === 'Married') {
        maritalStatusScore = 0;
    }

    const politicallyExposedScore = politicallyExposed === 'Yes' ? 2 : 0;

    const totalScore =
        annualIncomeScore + tradingExperienceScore + occupationScore + maritalStatusScore + politicallyExposedScore;

    let category: RiskCategory;
    if (totalScore >= 0 && totalScore <= 2) {
        category = RiskCategory.LOW;
    } else if (totalScore >= 3 && totalScore <= 6) {
        category = RiskCategory.MODERATE;
    } else {
        category = RiskCategory.HIGH;
    }

    return {
        annualIncomeScore,
        tradingExperienceScore,
        occupationScore,
        maritalStatusScore,
        politicallyExposedScore,
        totalScore,
        category,
    };
};
