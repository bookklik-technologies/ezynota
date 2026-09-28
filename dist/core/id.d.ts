export interface IdGenerator {
    (): string;
}
export declare function createDefaultIdGenerator(): IdGenerator;
export declare function createIdFactory(custom?: IdGenerator): IdGenerator;
