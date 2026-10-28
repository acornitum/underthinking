// PREVIEW (temporary): the sidebar's main/secondary genre layout. Counts and
// filtering borrow the old tags in data/motions.csv; nothing is relabelled.
// A secondary genre with a `main` also counts towards that main genre.
type Genre = { name: string; main?: string; legacy?: string[] };

export const MAIN_GENRES: Genre[] = [
	{ name: 'Policy' },
	{
		name: 'Politics',
		legacy: [
			'Democracy',
			'Politics',
			'Government',
			'Corruption',
			'Authoritarianism',
			'Nationalism',
			'United States Politics'
		]
	},
	{ name: 'Economics', legacy: ['Economics', 'Private Property', 'Taxation', 'Tax', 'Poverty'] },
	{ name: 'International Relations', legacy: ['International Relations'] },
	{
		name: 'Social Justice',
		legacy: ['Social Justice', 'Human Rights', 'Minority Communities', 'Elderly/Aging']
	},
	{ name: 'Philosophy', legacy: ['Philosophy', 'Ethics', 'Charity'] },
	{ name: 'Tech / Science', legacy: ['Science/Technology'] },
	{ name: 'Narrative' },
	{ name: 'Actor' },
	{ name: 'Romance', legacy: ['Relationships'] },
	{ name: 'Religion', legacy: ['Religion'] },
	{ name: 'Culture', legacy: ['Culture'] }
];

// A group with a `main` pops up under that main genre when it's picked.
export const SECONDARY_GENRES: { group: string; main?: string; genres: Genre[] }[] = [
	{
		group: 'Policy',
		main: 'Policy',
		genres: [
			{ name: 'Criminal Justice', main: 'Policy', legacy: ['Criminal Justice', 'Police', 'Crime'] },
			{
				name: 'War & Terrorism',
				main: 'Policy',
				legacy: ['Military', 'Terrorism', 'Security', 'War', 'War/Military', 'War/Conflict']
			},
			{ name: 'Environment', main: 'Policy', legacy: ['Environment', 'Climate Change'] },
			{ name: 'Energy', main: 'Policy', legacy: ['Energy'] },
			{ name: 'Housing', main: 'Policy', legacy: ['Housing'] },
			{ name: 'Cities', main: 'Policy', legacy: ['Cities', 'Rural/Urban', 'Transportation'] },
			{ name: 'Law', main: 'Policy', legacy: ['Law'] },
			{ name: 'Medical', legacy: ['Medical', 'Healthcare', 'HealthCare', 'Health', 'Drugs'] },
			{ name: 'Mental Health', legacy: ['Mental Health'] },
			{ name: 'Education', legacy: ['Education/Academia'] },
			{ name: 'Labor', legacy: ['Labor'] },
			{ name: 'Children & Family', legacy: ['Children', 'Family', 'Youth'] }
		]
	},
	{
		group: 'Economy',
		main: 'Economics',
		genres: [
			{ name: 'Finance', main: 'Economics', legacy: ['Finance'] },
			{
				name: 'Business',
				main: 'Economics',
				legacy: ['Business', 'Corporate Governance', 'Consumer Protection', 'Consumer Rights']
			},
			{ name: 'Trade', main: 'Economics', legacy: ['Trade', 'Globalization'] },
			{
				name: 'Developing nations',
				main: 'Economics',
				legacy: ['Development', 'Poverty/Development']
			}
		]
	},
	{
		group: 'Identity',
		main: 'Social Justice',
		genres: [
			{ name: 'Queer', main: 'Social Justice', legacy: ['LGBTQ+'] },
			{
				name: 'Feminism',
				main: 'Social Justice',
				legacy: [
					'Feminism',
					'Gender',
					'Women',
					'Women/Feminism',
					'Gender/Feminism',
					'Gender Equality'
				]
			},
			{ name: 'Race', main: 'Social Justice', legacy: ['Race', 'Racism', 'Race/Racism'] },
			{
				name: 'Immigration',
				main: 'Social Justice',
				legacy: ['Immigration', 'Migration', 'Refugees/Asylum']
			},
			{ name: 'Indigenous', main: 'Social Justice', legacy: ['Indigenous People'] },
			{ name: 'Disability', main: 'Social Justice', legacy: ['Disability Rights'] }
		]
	},
	{
		group: 'Tech',
		main: 'Tech / Science',
		genres: [
			{ name: 'AI', main: 'Tech / Science', legacy: ['Artificial Intelligence'] },
			{
				name: 'Privacy & Surveillance',
				main: 'Tech / Science',
				legacy: ['Privacy', 'Cybersecurity']
			},
			{ name: 'Space', main: 'Tech / Science', legacy: ['Space Exploration'] }
		]
	},
	{
		group: 'Culture',
		main: 'Culture',
		genres: [
			{ name: 'Art', main: 'Culture', legacy: ['Art'] },
			{ name: 'Film & TV', main: 'Culture' },
			{ name: 'Music', main: 'Culture' },
			{ name: 'Sports', main: 'Culture', legacy: ['Sports'] },
			{ name: 'Media & Social Media', main: 'Culture', legacy: ['Media', 'Social Media'] },
			{ name: 'Food', main: 'Culture', legacy: ['Food'] }
		]
	},
	{
		group: 'Society',
		genres: [
			{
				name: 'Activism',
				main: 'Social Justice',
				legacy: ['Social Movement', 'Social Movements', 'Social Movement Strategy', 'Protest']
			},
			{
				name: 'Free Speech',
				main: 'Politics',
				legacy: ['Free Speech', 'Freedom of Speech', 'Censorship']
			},
			{ name: 'Elections', main: 'Politics', legacy: ['Elections'] },
			{ name: 'History', legacy: ['Historical Memory', 'Colonialism'] },
			{ name: 'Animals', legacy: ['Animal Rights'] },
			{ name: 'Hypothetical' }
		]
	},
	{
		group: 'Regions',
		main: 'International Relations',
		genres: [
			{ name: 'Africa', legacy: ['Africa'] },
			{ name: 'East Asia' },
			{ name: 'South Asia', legacy: ['South Asia', 'India'] },
			{ name: 'Southeast Asia' },
			{ name: 'Europe', legacy: ['Europe'] },
			{ name: 'Latin America', legacy: ['Latin America'] },
			{
				name: 'North America',
				legacy: ['North America', 'United States', 'United States Politics', 'Canada']
			},
			{ name: 'Middle East', legacy: ['Middle East'] },
			{ name: 'Oceania', legacy: ['Australia', 'Australia/Oceania'] }
		]
	}
];

// Genre name -> the motion_types values it matches.
export const PREVIEW_TAGS = new Map<string, string[]>();
for (const g of MAIN_GENRES) PREVIEW_TAGS.set(g.name, [g.name, ...(g.legacy ?? [])]);
for (const { genres } of SECONDARY_GENRES) {
	for (const g of genres) {
		const tags = [g.name, ...(g.legacy ?? [])];
		PREVIEW_TAGS.set(g.name, tags);
		if (g.main) PREVIEW_TAGS.get(g.main)!.push(...tags);
	}
}
