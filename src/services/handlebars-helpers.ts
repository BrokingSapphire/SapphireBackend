import Handlebars from 'handlebars';

// Register concat helper
Handlebars.registerHelper('concat', function (...args: any[]) {
    // Remove the last item (Handlebars options object)
    args.pop();
    return args.join('');
});

// Register ifEquals helper
Handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: Handlebars.HelperOptions) {
    return arg1 === arg2 ? options.fn(this) : options.inverse(this);
});

// Register formatCurrency helper
Handlebars.registerHelper('formatCurrency', function (amount: string | number, currency?: string) {
    if (!amount || amount === 'N/A') return 'N/A';

    try {
        const numAmount = parseFloat(amount.toString());
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
        }).format(numAmount);
    } catch (e) {
        return amount;
    }
});

// Register formatDate helper
Handlebars.registerHelper('formatDate', function (date: string | Date, format?: string) {
    if (!date || date === 'N/A') return 'N/A';

    try {
        const dateObj = new Date(date);
        if (format === 'short') {
            return dateObj.toLocaleDateString('en-IN');
        } else if (format === 'long') {
            return dateObj.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            });
        } else {
            return date.toString();
        }
    } catch (e) {
        return date;
    }
});

export default Handlebars;
