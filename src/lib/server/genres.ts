// Motion genres, as shown in the sidebar's Motion genre filter: the main
// genres, then the secondary ones in groups. A secondary genre with a `main`
// also counts towards that main genre (picking Feminism implies Social
// Justice), and a group's `main` is the main genre it shows up under when
// picked (e.g. the Identity block under Social Justice). Motions are tagged
// with these names in the `types` column of data/motions.csv.
type Genre = { name: string; main?: string };

export const MAIN_GENRES: Genre[] = [
	{ name: 'Policy' },
	{ name: 'Politics' },
	{ name: 'Economics' },
	{ name: 'International Relations' },
	{ name: 'Social Justice' },
	{ name: 'Philosophy' },
	{ name: 'Tech / Science' },
	{ name: 'Narrative' },
	{ name: 'Actor' },
	{ name: 'Romance' },
	{ name: 'Religion' },
	{ name: 'Culture' }
];

// A group with a `main` pops up under that main genre when it's picked.
export const SECONDARY_GENRES: { group: string; main?: string; genres: Genre[] }[] = [
	{
		group: 'Policy',
		main: 'Policy',
		genres: [
			{ name: 'Criminal Justice', main: 'Policy' },
			{
				name: 'War & Terrorism',
				main: 'Policy'
			},
			{ name: 'Environment', main: 'Policy' },
			{ name: 'Energy', main: 'Policy' },
			{ name: 'Housing', main: 'Policy' },
			{ name: 'Cities', main: 'Policy' },
			{ name: 'Law', main: 'Policy' },
			{ name: 'Medical' },
			{ name: 'Mental Health' },
			{ name: 'Education' },
			{ name: 'Labor' },
			{ name: 'Children & Family' }
		]
	},
	{
		group: 'Economy',
		main: 'Economics',
		genres: [
			{ name: 'Finance', main: 'Economics' },
			{
				name: 'Business',
				main: 'Economics'
			},
			{ name: 'Trade', main: 'Economics' },
			{
				name: 'Developing nations',
				main: 'Economics'
			}
		]
	},
	{
		group: 'Identity',
		main: 'Social Justice',
		genres: [
			{ name: 'Queer', main: 'Social Justice' },
			{
				name: 'Feminism',
				main: 'Social Justice'
			},
			{ name: 'Race', main: 'Social Justice' },
			{
				name: 'Immigration',
				main: 'Social Justice'
			},
			{ name: 'Indigenous', main: 'Social Justice' },
			{ name: 'Disability', main: 'Social Justice' }
		]
	},
	{
		group: 'Tech',
		main: 'Tech / Science',
		genres: [
			{ name: 'AI', main: 'Tech / Science' },
			{
				name: 'Privacy & Surveillance',
				main: 'Tech / Science'
			},
			{ name: 'Space', main: 'Tech / Science' }
		]
	},
	{
		group: 'Culture',
		main: 'Culture',
		genres: [
			{ name: 'Art', main: 'Culture' },
			{ name: 'Film & TV', main: 'Culture' },
			{ name: 'Music', main: 'Culture' },
			{ name: 'Sports', main: 'Culture' },
			{ name: 'Media & Social Media', main: 'Culture' },
			{ name: 'Food', main: 'Culture' }
		]
	},
	{
		group: 'Society',
		genres: [
			{
				name: 'Activism',
				main: 'Social Justice'
			},
			{
				name: 'Free Speech',
				main: 'Politics'
			},
			{ name: 'Elections', main: 'Politics' },
			{ name: 'History' },
			{ name: 'Animals' },
			{ name: 'Hypothetical' }
		]
	},
	{
		group: 'Regions',
		main: 'International Relations',
		genres: [
			{ name: 'Africa' },
			{ name: 'East Asia' },
			{ name: 'South Asia' },
			{ name: 'Southeast Asia' },
			{ name: 'Europe' },
			{ name: 'Latin America' },
			{ name: 'North America' },
			{ name: 'Middle East' },
			{ name: 'Oceania' }
		]
	}
];

// Genre name -> the genre names it matches: itself, plus (for a main genre)
// the secondary genres that imply it.
export const GENRE_TAGS = new Map<string, string[]>();
for (const g of MAIN_GENRES) GENRE_TAGS.set(g.name, [g.name]);
for (const { genres } of SECONDARY_GENRES) {
	for (const g of genres) {
		GENRE_TAGS.set(g.name, [g.name]);
		if (g.main) GENRE_TAGS.get(g.main)!.push(g.name);
	}
}
