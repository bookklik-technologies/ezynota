export interface TextMatch {
    range: Range;
    editable: HTMLElement;
}
/** Match literal text without inserting markup into the editor document. */
export declare function findTextMatches(root: HTMLElement, query: string): TextMatch[];
