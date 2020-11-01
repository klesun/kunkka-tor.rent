
// "Rej" stands for "Rejections"
// this module defines shortcuts for classified
// errors to distinct them programmatically
// (to decide whether or not to write it to Diag, for example)

let toMakeExc = (httpStatusCode: number, okByDefault = false): ExcCls => {
	const makeExcOlolo: ExcCls = (msg: string, data = undefined) => {
        let exc, isOk;
        ({isOk, ...data} = (data || {}));
        if (isOk === undefined) {
            isOk = okByDefault;
        }
        if (!isOk) {
            exc = new Error(msg);
        } else {
            // this is probably faster, and saves you few days of life
            // when you see tons of meaningless stack traces in the log
            exc = {message: msg, toString: () => msg};
        }
        exc.httpStatusCode = httpStatusCode;
        exc.isOk = isOk;
        exc.data = data;
		let cls = Object.entries(classes)
			.filter(([, cls]) => {
				return +cls.httpStatusCode === +httpStatusCode;
			})
			.map(([cls]) => cls)[0] || httpStatusCode;
		/**
		 * for code mistakes when you `throw Rej.NotImplemented()`
		 * instead if `throw Rej.NotImplemented.makeExc()`
		 */
		exc.toString = () => 'Exc.' + cls + '(' + msg + ')';
		return exc;
	};
	makeExcOlolo.httpStatusCode = httpStatusCode;
	makeExcOlolo.matches = (otherCode) => otherCode == httpStatusCode;
	return makeExcOlolo;
};

let isOk = true;

type ExcData = {
    isOk?: boolean,
    passToClient?: boolean,
    [k: string]: unknown,
};

type ExcCls = {
    httpStatusCode: number,
    matches: (otherCode: number) => boolean,
} & (
    (msg: string, data?: ExcData) => Error
);

let classes = {
	// non-error responses
	NoContent: toMakeExc(204, isOk),
	ResetContent: toMakeExc(205, isOk),
	PartialContent: toMakeExc(206, isOk),

	// user errors
	BadRequest: toMakeExc(400),
	NotAuthorized: toMakeExc(401),
	Forbidden: toMakeExc(403, isOk),
	NotFound: toMakeExc(404),
	MethodNotAllowed: toMakeExc(405),
	NotAcceptable: toMakeExc(406),
	ProxyAuthenticationRequired: toMakeExc(407),
	RequestTimeout: toMakeExc(408),
	Conflict: toMakeExc(409),
	Gone: toMakeExc(410),
	// unable to process the requested instructions, I'll use it
	// as cannot satisfy in RBS - when GDS returns error and such
	UnprocessableEntity: toMakeExc(422),
	Locked: toMakeExc(423),
	FailedDependency: toMakeExc(424),
	TooEarly: toMakeExc(425),
	TooManyRequests: toMakeExc(429),
	LoginTimeOut: toMakeExc(440),

	// server errors
	InternalServerError: toMakeExc(500),
	NotImplemented: toMakeExc(501),
	BadGateway: toMakeExc(502),
	ServiceUnavailable: toMakeExc(503),
	GatewayTimeout: toMakeExc(504),
	InsufficientStorage: toMakeExc(507),
	NotExtended: toMakeExc(510),
};

const typedClasses: Record<keyof typeof classes, ExcCls> = classes;

const Exc = {
	...typedClasses,
	dict: classes,
	list: Object.values(classes),
};

export default Exc;
