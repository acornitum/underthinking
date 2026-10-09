// Build a RegExp whose \b, \w and \d behave like Python's `re` on text:
// Unicode-aware (accented letters, CJK and full-width digits count), where
// JavaScript's are ASCII-only. The import rules were written for Python.
const WORD = String.raw`[\p{L}\p{N}_]`;
const BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;

export function unicodeRegex(pattern, flags = '') {
	const source = pattern
		.replaceAll(String.raw`\b`, BOUNDARY)
		.replaceAll(String.raw`\w`, WORD)
		.replaceAll(String.raw`\d`, String.raw`\p{Nd}`);
	return new RegExp(source, `${flags}u`);
}

// Python's int() accepts any Unicode digits (e.g. full-width "１２").
export function toInt(digits) {
	return Number(digits.normalize('NFKC'));
}
