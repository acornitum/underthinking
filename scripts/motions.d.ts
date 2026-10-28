// Types for what scripts/motions.js exports (used by the local admin tools,
// and STYLE_GROUPS by the sidebar filters).
type CsvRecord = Record<string, string>;

export const CSV_PATH: string;
export function build(): void;
export function readCsv(file: string): { header: string[]; records: CsvRecord[] };
export function toCsv(header: string[], records: CsvRecord[]): string;
export function splitTypes(types: string | undefined): string[];
export const STYLE_GROUPS: string[];
