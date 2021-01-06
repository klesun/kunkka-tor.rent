
/**
 * '' < '0'
 * '10' > '01'
 * '10' > '1'
 */
const compareDigits = (a, b) => {
    if (a === b) {
        return 0;
    } else if (a === '') {
        return -1;
    } else if (b === '') {
        return 1;
    } else {
        return a - b;
    }
};

const hasPostfix = mate => mate.postfix !== '';

/** mates are guys with same roots */
const sortMates = (mates) => {
    const digitSorted = [...mates]
        .sort((a,b) => compareDigits(a.digit, b.digit));

    const grouped = new Map();
    for (const mate of digitSorted) {
        if (!grouped.has(mate.digit)) {
            grouped.set(mate.digit, []);
        }
        grouped.get(mate.digit).push(mate);
    }

    return [...grouped].flatMap(([digit, mates]) => {
        const ended = mates.filter(m => !hasPostfix(m));
        const continued = mates.filter(m => hasPostfix(m));
        const {sortedItems} = FixNaturalOrder({
            items: continued,
            getName: mate => mate.postfix,
        });
        return [...ended, ...sortedItems];
    }).map(mate => mate.item);
};

/**
 * mostly preserves the natural order and only changes item places if they
 * have a common prefix followed by a number and this number degrades
 *
 * the deal is that the order in which files are listed in the metadata is sometimes consistent, but often not - the
 * aim of this tool is to restore order for obvious cases like abc1, abc10, abc4 without hurting actually consistent lists
 *
 * @template T
 * @param {T[]} items
 * @param {function(T): string} getName
 */
const FixNaturalOrder = ({items, getName}) => {
    const prefixToDigital = new Map();
    for (const item of items) {
        const [, prefix, digit, postfix] = getName(item).match(/^([^\d]*)(\d*)(.*)$/);
        if (!prefixToDigital.has(prefix)) {
            prefixToDigital.set(prefix, []);
        }
        prefixToDigital.get(prefix).push({
            digit, postfix, item,
        });
    }
    const sortedItems = [...prefixToDigital]
        .flatMap(([prefix, mates]) => sortMates(mates));
    return {sortedItems};
};

export default FixNaturalOrder;