export class InvalidMessageException extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class ParseError extends Error {
    constructor(message: string) {
        super(message);
    }
}
