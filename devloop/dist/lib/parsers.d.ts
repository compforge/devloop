export interface ReferenceEntry {
    readonly title: string;
    readonly path: string;
    readonly description: string;
}
export interface SubprojectEntry {
    readonly name: string;
    readonly path: string;
    readonly aliases: readonly string[];
    readonly language?: string;
    readonly role?: string;
    readonly note?: string;
}
export declare function parseReferencesSection(path: string): readonly ReferenceEntry[];
export declare function parseSubprojectsSection(path: string): readonly SubprojectEntry[];
//# sourceMappingURL=parsers.d.ts.map