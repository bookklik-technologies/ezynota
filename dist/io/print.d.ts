import type { EzynotaDocument } from "../types";
/**
 * Browser printing/PDF output for the active document. The print DOM is
 * built exclusively with createElement/textContent — untrusted content
 * never reaches innerHTML.
 */
export declare function printDocument(document: EzynotaDocument): void;
