export class ErrorCode extends Error {
    constructor(msg: string) {
        super(msg);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ErrorCode.prototype);
    }
}