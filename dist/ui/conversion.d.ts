import type { Host } from "../host";
/** Only offer text conversions or a mapper that understands the source data. */
export declare function canConvertBlock(host: Host, from: string, to: string): boolean;
