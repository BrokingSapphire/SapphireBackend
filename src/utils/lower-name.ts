/**
 * Normalizes a name by converting to lowercase and removing extra spaces
 */
export const normalizeNameForComparison = (name: string): string => {
    if (!name || typeof name !== 'string') {
        return '';
    }

    return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

export const compareNormalizedNames = (name1: string, name2: string): boolean => {
    const normalized1 = normalizeNameForComparison(name1);
    const normalized2 = normalizeNameForComparison(name2);

    return normalized1 === normalized2;
};
