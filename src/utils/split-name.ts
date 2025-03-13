import { Name } from '@app/database/transactions';

const splitName = (name: string): Name => {
    const names = name.split(' ');
    if (names.length === 1) {
        return {
            firstName: names[0],
            middleName: null,
            lastName: null,
        };
    } else if (names.length === 2) {
        return {
            firstName: names[0],
            middleName: null,
            lastName: names[1],
        };
    } else {
        return {
            firstName: names[0],
            middleName: names.slice(1, -1).join(' '),
            lastName: names[names.length - 1],
        };
    }
};

export default splitName;
