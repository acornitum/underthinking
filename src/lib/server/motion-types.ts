// The motion type categories shown in the sidebar, as parents with optional
// children. Selecting a parent matches it and all its children; selecting a
// child narrows to just that child.
//
// The motions are still tagged with the old types (data/motions.csv), so each
// category also lists the old tags it stands for. A motion matches a category
// if it has the category's own name or any of those old tags as a type, so
// the old tags can be dropped once the motions are relabelled.
type Category = { name: string; legacy?: string[]; children?: Category[] };

export const CATEGORIES: Category[] = [
	{
		name: 'Policy',
		children: [
			{ name: 'National' },
			{ name: 'Cities', legacy: ['Cities', 'Rural/Urban', 'Transportation'] },
			{ name: 'Law', legacy: ['Law'] },
			{ name: 'Environment', legacy: ['Environment', 'Climate Change'] },
			{ name: 'Housing', legacy: ['Housing'] },
			{ name: 'Energy', legacy: ['Energy'] },
			{ name: 'Criminal Justice', legacy: ['Criminal Justice', 'Police', 'Crime'] },
			{
				name: 'War',
				legacy: [
					'Military',
					'Terrorism',
					'Security',
					'War',
					'War/Military',
					'War/Conflict',
					'Peace',
					'Peace/Conflict'
				]
			}
		]
	},
	{
		name: 'Politics',
		legacy: [
			'Democracy',
			'Politics',
			'Elections',
			'Government',
			'Corruption',
			'Authoritarianism',
			'Nationalism',
			'United States Politics'
		]
	},
	{ name: 'Romance', legacy: ['Relationships'] },
	{ name: 'Hypothetical' },
	{
		name: 'Economics',
		legacy: [
			'Economics',
			'Trade',
			'Private Property',
			'Taxation',
			'Tax',
			'Poverty',
			'Business',
			'Corporate Governance',
			'Consumer Protection',
			'Consumer Rights'
		],
		children: [{ name: 'Finance', legacy: ['Finance'] }]
	},
	{ name: 'Labor', legacy: ['Labor'] },
	{ name: 'International Relations', legacy: ['International Relations', 'Globalization'] },
	{
		name: 'Social Justice',
		legacy: [
			'Social Justice',
			'Human Rights',
			'Minority Communities',
			'Indigenous People',
			'Disability Rights',
			'Elderly/Aging',
			'Immigration',
			'Migration',
			'Refugees/Asylum'
		],
		children: [
			{ name: 'Queer', legacy: ['LGBTQ+'] },
			{
				name: 'Feminism',
				legacy: [
					'Feminism',
					'Gender',
					'Women',
					'Women/Feminism',
					'Gender/Feminism',
					'Gender Equality'
				]
			},
			{ name: 'Race', legacy: ['Race', 'Racism', 'Race/Racism'] }
		]
	},
	{ name: 'Narrative' },
	{ name: 'Actor' },
	{ name: 'Children', legacy: ['Children', 'Family', 'Youth'] },
	{ name: 'Education', legacy: ['Education/Academia'] },
	{ name: 'Art', legacy: ['Art'], children: [{ name: 'Film' }, { name: 'Music' }] },
	{ name: 'Media', legacy: ['Media', 'Social Media'] },
	{ name: 'Developing nations', legacy: ['Development', 'Poverty/Development'] },
	{
		name: 'Tech / Science',
		legacy: ['Science/Technology', 'Privacy', 'Cybersecurity', 'Space Exploration'],
		children: [{ name: 'AI', legacy: ['Artificial Intelligence'] }]
	},
	{
		name: 'Regions',
		children: [
			{ name: 'Africa', legacy: ['Africa'] },
			{ name: 'Asia', legacy: ['Asia', 'South Asia', 'India'] },
			{ name: 'Europe', legacy: ['Europe'] },
			{ name: 'Latin America', legacy: ['Latin America'] },
			{
				name: 'North America',
				legacy: ['North America', 'United States', 'United States Politics', 'Canada']
			},
			{ name: 'Middle East', legacy: ['Middle East'] },
			{ name: 'Oceania', legacy: ['Australia', 'Australia/Oceania'] }
		]
	},
	{ name: 'Religion', legacy: ['Religion'] },
	{ name: 'History', legacy: ['Historical Memory', 'Colonialism'] },
	{ name: 'Philosophy', legacy: ['Philosophy', 'Ethics', 'Charity'] },
	{ name: 'Medical', legacy: ['Medical', 'Healthcare', 'HealthCare', 'Health', 'Drugs'] },
	{ name: 'Mental Health', legacy: ['Mental Health'] },
	{ name: 'Sports', legacy: ['Sports'] },
	{ name: 'Animals', legacy: ['Animal Rights'] }
];

// Every category name -> the motion_types values it matches: its own name and
// old tags, plus its children's.
export const CATEGORY_TAGS = new Map<string, string[]>();

function collect(category: Category): string[] {
	const tags = [category.name, ...(category.legacy ?? [])];
	for (const child of category.children ?? []) tags.push(...collect(child));
	const unique = [...new Set(tags)];
	CATEGORY_TAGS.set(category.name, unique);
	return unique;
}
CATEGORIES.forEach(collect);
