
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

const WORDED_DIGITS = {
    'ZERO': 0,
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5,
    'SIX': 6,
    'SEVEN': 7,
    'EIGHT': 8,
    'NINE': 9,
    'TEN': 10,
    'ELEVEN': 11,
    'TWELVE': 12,
    'THIRTEEN': 13,
    'FOURTEEN': 14,
    'FIFTEEN': 15,
    'SIXTEEN': 16,
    'SEVENTEEN': 17,
    'EIGHTEEN': 18,
    'NINETEEN': 19,
    'TWENTY': 20,
};

/**
 * exported for tests
 * @param {string} fileName
 */
export const splitTillFirstNumber = (fileName) => {
    let [, shortestPrefix, digit, longestPostfix] = fileName.match(/^([^\d]*)(\d*)(.*)$/);
    const wordDigitRegexSource =
        /^(.*?(?:[^a-zA-Z]|^))/.source +
        '(' + Object.keys(WORDED_DIGITS).join('|') + ')' +
        /((?:[^a-zA-Z]|$).*)$/.source;

    const wordDigitRegex = new RegExp(wordDigitRegexSource, 'i');
    const wordDigitMatch = fileName.match(wordDigitRegex);
    if (wordDigitMatch) {
        const [, wordPrefix, wordDigit, wordPostfix] = wordDigitMatch;
        if (wordPrefix.length < shortestPrefix.length) {
            shortestPrefix = wordPrefix;
            digit = WORDED_DIGITS[wordDigit.toUpperCase()] + '';
            longestPostfix = wordPostfix;
        }
    }
    return {
        prefix: shortestPrefix,
        digit: digit,
        postfix: longestPostfix,
    };
};

/**
 * mostly preserves the natural order and only changes item places if they
 * have a common prefix followed by a number and this number degrades
 *
 * the deal is that the order in which files are listed in the metadata is sometimes consistent, but often not - the
 * aim of this tool is to restore order for obvious cases like abc1, abc10, abc4 without hurting actually consistent lists
 *
 * @template T
 * @param {{ items: T[], getName: (item: T) => string }} params
 * @return {{ sortedItems: T[] }}
 */
const FixNaturalOrder = (params) => {
    const { items, getName } = params;
    const prefixToDigital = new Map();
    for (const item of items) {
        const fileName = getName(item);
        const {prefix, digit, postfix} = splitTillFirstNumber(fileName);
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