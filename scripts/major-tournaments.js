// Hand-picked major BP university tournaments.
//
// Each entry is [group, pattern]. A tournament is major if it is BP, university
// (or mixed) level, matches a pattern, and matches none of EXCLUDE. Patterns are
// case-insensitive and matched against the tournament name. `\b` is Unicode-aware
// here (see unicode-regex.js), so it behaves like Python's re.
import { unicodeRegex } from './unicode-regex.js';

const MAJORS = [
	// Championships
	['WUDC', String.raw`^\d+(st|nd|rd|th) \w+ worlds (19|20)\d\d$`], // "11th Toronto Worlds 1991"
	['WUDC', String.raw`\bWUDC\b`],
	['WUDC', String.raw`world universities'? debating championships`],
	[
		'EUDC',
		String.raw`\bEUDC\b|european universit(y|ies) debating championships?|european universites debating`
	],
	[
		'NAUDC',
		String.raw`\bNAUDC\b|north american universit(y|ies)'? debat(e|ing) championships?|north american debating championships`
	],
	['NAUDC', String.raw`HWS North American Universities Debating Championsip`],
	['ABP', String.raw`\bABP\b|asian BP|asian british parliamentary`],
	['PAUDC', String.raw`\bPAUDC\b|pan[- ]african universit(y|ies) debat(e|ing) championships?`],
	// Big IVs
	['Oxford IV', String.raw`^oxford (IV|intervarsity)\b`],
	['Cambridge IV', String.raw`^cambridge (IV|intervarsity)\b`],
	[
		'LSE Open / IV',
		String.raw`^LSE (open|IV)\b|^(the )?london school of economics and political science inter-?varsity`
	],
	['Manchester IV', String.raw`manchester (IV|intervarsity)`],
	['Durham IV', String.raw`^durham IV\b`],
	['Leiden Open', String.raw`^leiden open\b`],
	['Berlin IV', String.raw`^berlin IV$`],
	['Vienna IV', String.raw`^vienna (IV|intervarsity)\b`],
	['Trinity IV (Dublin)', String.raw`^trinity IV\b|^trinity college dublin('s)? (IV|intervarsity)`],
	['Cork IV', String.raw`^cork IV$`],
	['Edinburgh Cup', String.raw`^edinburgh cup\b`],
	['Glasgow Ancients', String.raw`^glasgow ancients\b`],
	['KCL IV', String.raw`^king'?s college london intervarsity`],
	['UCL IV', String.raw`^UCL (clifford chance )?IV\b`],
	['Yale IV', String.raw`^yale (IV|intervarsity)\b`],
	['Princeton IV', String.raw`^princeton IV\b`],
	['Brandeis IV', String.raw`^brandeis IV\b`],
	['HWS Round Robin', String.raw`^HWS (round robin|RR)\b`],
	['Hart House IV', String.raw`^hart house (IV|inter-varsity)\b|^hart house 2022$`],
	['McGill IV', String.raw`^mcgill (IV|intervarsity)\b|^winter carnival`],
	['Columbia IV', String.raw`^columbia IV\b`],
	['SIDO', String.raw`^shanghai international debate open\b`]
].map(([group, pattern]) => [group, unicodeRegex(pattern, 'i')]);

// Named like ABP but not confirmed as the actual championship.
const EXCLUDE_NAMES = new Set(['malaysia abp', 'iium kuantan abp', 'krabi abp 2024']);

const EXCLUDE = unicodeRegex(
	String.raw`\bpre\b|pre-|fundraiser|challenge|novice|women|wom\*n|WGM|pro[- ]?am|mini|juniors|online open|peace invitational|uhuru|doxbridge|BDC`,
	'i'
);

export function majorGroup(name, styleGroup, levelGroup) {
	if (styleGroup !== 'BP' || !['University', 'Mixed'].includes(levelGroup)) return null;
	if (EXCLUDE_NAMES.has(name.trim().toLowerCase()) || EXCLUDE.test(name)) return null;
	for (const [group, pattern] of MAJORS) {
		if (pattern.test(name)) return group;
	}
	return null;
}
