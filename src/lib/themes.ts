export type RGB = `${number} ${number} ${number}`;

export interface ThemeColors {
	bg: RGB;
	main: RGB;
	sub: RGB;
	text: RGB;
	error: RGB;
}

export interface Theme {
	name: string;
	label: string;
	colors: ThemeColors;
}

export const THEMES = [
	{
		name: 'z_modern',
		label: 'Z Modern',
		colors: {
			bg: '25 25 25',
			main: '216 180 254',
			sub: '161 161 170',
			text: '228 228 231',
			error: '239 68 68'
		}
	},
	{
		name: 'serika_dark',
		label: 'Serika Dark',
		colors: {
			bg: '50 52 55',
			main: '226 183 20',
			sub: '100 102 105',
			text: '209 208 197',
			error: '202 71 84'
		}
	},
	{
		name: 'carbon',
		label: 'Carbon',
		colors: {
			bg: '49 49 49',
			main: '246 109 0',
			sub: '170 170 170',
			text: '245 229 200',
			error: '235 69 95'
		}
	},
	{
		name: 'miami',
		label: 'Miami',
		colors: {
			bg: '24 24 24',
			main: '228 96 155',
			sub: '71 184 255',
			text: '240 240 240',
			error: '255 87 87'
		}
	},
	{
		name: 'dracula',
		label: 'Dracula',
		colors: {
			bg: '40 42 54',
			main: '189 147 249',
			sub: '139 233 253',
			text: '248 248 242',
			error: '255 85 85'
		}
	},
	{
		name: 'catppuccin_mocha',
		label: 'Catppuccin Mocha',
		colors: {
			bg: '30 30 46',
			main: '203 166 247',
			sub: '108 112 134',
			text: '205 214 244',
			error: '243 139 168'
		}
	},
	{
		name: 'rose_pine',
		label: 'Rosé Pine',
		colors: {
			bg: '25 23 36',
			main: '235 188 186',
			sub: '110 106 134',
			text: '224 222 244',
			error: '235 111 146'
		}
	},
	{
		name: 'nord',
		label: 'Nord',
		colors: {
			bg: '46 52 64',
			main: '136 192 208',
			sub: '216 222 233',
			text: '236 239 244',
			error: '191 97 106'
		}
	},
	{
		name: 'gruvbox_dark',
		label: 'Gruvbox Dark',
		colors: {
			bg: '40 40 40',
			main: '215 153 33',
			sub: '168 153 132',
			text: '235 219 178',
			error: '204 36 29'
		}
	},
	{
		name: 'everforest',
		label: 'Everforest',
		colors: {
			bg: '45 53 59',
			main: '167 192 128',
			sub: '133 146 137',
			text: '211 198 170',
			error: '230 126 128'
		}
	},
	{
		name: 'kanagawa',
		label: 'Kanagawa',
		colors: {
			bg: '31 31 40',
			main: '220 165 97',
			sub: '114 113 105',
			text: '220 215 186',
			error: '195 64 67'
		}
	},
	{
		name: 'one_dark',
		label: 'One Dark',
		colors: {
			bg: '40 44 52',
			main: '97 175 239',
			sub: '171 178 191',
			text: '220 223 228',
			error: '224 108 117'
		}
	},
	{
		name: 'tokyo_night',
		label: 'Tokyo Night',
		colors: {
			bg: '26 27 38',
			main: '122 162 247',
			sub: '169 177 214',
			text: '192 202 245',
			error: '247 118 142'
		}
	},
	{
		name: 'monokai',
		label: 'Monokai',
		colors: {
			bg: '39 40 34',
			main: '166 226 46',
			sub: '117 113 94',
			text: '248 248 242',
			error: '249 38 114'
		}
	},
	{
		name: 'solarized_dark',
		label: 'Solarized Dark',
		colors: {
			bg: '0 43 54',
			main: '181 137 0',
			sub: '88 110 117',
			text: '147 161 161',
			error: '220 50 47'
		}
	},
	{
		name: 'olivia',
		label: 'Olivia',
		colors: {
			bg: '28 27 29',
			main: '222 175 157',
			sub: '115 110 114',
			text: '242 239 237',
			error: '224 82 99'
		}
	},
	{
		name: '8008',
		label: 'GMK 8008',
		colors: {
			bg: '51 58 69',
			main: '244 76 127',
			sub: '147 158 174',
			text: '233 236 240',
			error: '218 51 51'
		}
	},
	{
		name: 'botanical',
		label: 'Botanical',
		colors: {
			bg: '123 156 152',
			main: '234 241 243',
			sub: '73 87 85',
			text: '234 241 243',
			error: '249 149 132'
		}
	},
	{
		name: 'bento',
		label: 'Bento',
		colors: {
			bg: '45 57 77',
			main: '255 122 144',
			sub: '74 118 141',
			text: '255 250 248',
			error: '238 42 58'
		}
	},
	{
		name: 'matrix',
		label: 'Matrix',
		colors: {
			bg: '0 0 0',
			main: '21 255 0',
			sub: '0 101 0',
			text: '209 255 205',
			error: '218 51 51'
		}
	},
	{
		name: 'void',
		label: 'Void',
		colors: {
			bg: '0 0 0',
			main: '255 255 255',
			sub: '160 160 160',
			text: '255 255 255',
			error: '255 100 100'
		}
	},
	{
		name: 'catppuccin_latte',
		label: 'Catppuccin Latte',
		colors: {
			bg: '239 241 245',
			main: '136 57 239',
			sub: '156 160 176',
			text: '76 79 105',
			error: '210 15 57'
		}
	},
	{
		name: 'solarized_light',
		label: 'Solarized Light',
		colors: {
			bg: '253 246 227',
			main: '133 153 0',
			sub: '147 161 161',
			text: '101 123 131',
			error: '220 50 47'
		}
	},
	{
		name: 'tomorrow',
		label: 'Tomorrow',
		colors: {
			bg: '255 255 255',
			main: '66 113 174',
			sub: '142 144 140',
			text: '77 77 76',
			error: '200 40 41'
		}
	},
	{
		name: 'paper',
		label: 'Paper',
		colors: {
			bg: '250 250 250',
			main: '30 30 30',
			sub: '120 120 120',
			text: '50 50 50',
			error: '200 50 50'
		}
	},
	{
		name: 'acme',
		label: 'Acme',
		colors: {
			bg: '255 255 234',
			main: '136 136 204',
			sub: '68 68 68',
			text: '0 0 0',
			error: '192 57 43'
		}
	},
	{
		name: 'ethereal',
		label: 'Ethereal',
		colors: {
			bg: '6 11 30',
			main: '125 130 217',
			sub: '255 206 173',
			text: '255 206 173',
			error: '231 76 60'
		}
	},
	{
		name: 'flexoki_light',
		label: 'Flexoki Light',
		colors: {
			bg: '255 252 240',
			main: '32 94 166',
			sub: '69 67 64',
			text: '16 15 15',
			error: '192 57 43'
		}
	},
	{
		name: 'hackerman',
		label: 'Hackerman',
		colors: {
			bg: '11 12 22',
			main: '130 251 156',
			sub: '221 247 255',
			text: '221 247 255',
			error: '231 76 60'
		}
	},
	{
		name: 'last_horizon',
		label: 'Last Horizon',
		colors: {
			bg: '12 11 12',
			main: '181 151 144',
			sub: '226 221 220',
			text: '250 252 251',
			error: '231 76 60'
		}
	},
	{
		name: 'lumon',
		label: 'Lumon',
		colors: {
			bg: '22 36 45',
			main: '139 201 235',
			sub: '214 226 238',
			text: '242 252 255',
			error: '231 76 60'
		}
	},
	{
		name: 'lupine',
		label: 'Lupine',
		colors: {
			bg: '250 250 250',
			main: '50 100 235',
			sub: '33 33 33',
			text: '0 0 0',
			error: '192 57 43'
		}
	},
	{
		name: 'matte_black',
		label: 'Matte Black',
		colors: {
			bg: '18 18 18',
			main: '230 142 13',
			sub: '190 190 190',
			text: '234 234 234',
			error: '231 76 60'
		}
	},
	{
		name: 'miasma',
		label: 'Miasma',
		colors: {
			bg: '34 34 34',
			main: '120 130 75',
			sub: '194 194 176',
			text: '194 194 176',
			error: '231 76 60'
		}
	},
	{
		name: 'modus_operandi',
		label: 'Modus Operandi',
		colors: {
			bg: '255 255 255',
			main: '0 49 169',
			sub: '89 89 89',
			text: '0 0 0',
			error: '192 57 43'
		}
	},
	{
		name: 'modus_vivendi',
		label: 'Modus Vivendi',
		colors: {
			bg: '0 0 0',
			main: '47 175 255',
			sub: '152 152 152',
			text: '255 255 255',
			error: '231 76 60'
		}
	},
	{
		name: 'osaka_jade',
		label: 'Osaka Jade',
		colors: {
			bg: '17 28 24',
			main: '80 148 117',
			sub: '193 196 151',
			text: '247 232 178',
			error: '231 76 60'
		}
	},
	{
		name: 'retro_82',
		label: 'Retro 82',
		colors: {
			bg: '5 24 46',
			main: '250 169 104',
			sub: '246 220 172',
			text: '246 220 172',
			error: '231 76 60'
		}
	},
	{
		name: 'ristretto',
		label: 'Ristretto',
		colors: {
			bg: '44 37 37',
			main: '243 141 112',
			sub: '230 217 219',
			text: '230 217 219',
			error: '231 76 60'
		}
	},
	{
		name: 'rose_pine_dawn',
		label: 'Rosé Pine Dawn',
		colors: {
			bg: '250 244 237',
			main: '86 148 159',
			sub: '94 88 125',
			text: '87 82 121',
			error: '192 57 43'
		}
	},
	{
		name: 'solitude',
		label: 'Solitude',
		colors: {
			bg: '16 19 21',
			main: '121 129 134',
			sub: '165 174 180',
			text: '202 204 204',
			error: '231 76 60'
		}
	},
	{
		name: 'vantablack',
		label: 'Vantablack',
		colors: {
			bg: '0 0 0',
			main: '141 141 141',
			sub: '255 255 255',
			text: '255 255 255',
			error: '231 76 60'
		}
	},
	{
		name: 'white',
		label: 'White',
		colors: {
			bg: '255 255 255',
			main: '110 110 110',
			sub: '56 56 56',
			text: '0 0 0',
			error: '192 57 43'
		}
	}
] satisfies Theme[];

/**
 * Helper: apply a theme’s colors to CSS variables.
 * Keeps the "rgb triplet" format so your CSS uses rgb(var(--bg)).
 */
export function applyThemeToRoot(theme: Theme): void {
	const root = document.documentElement;

	root.style.setProperty('--bg', theme.colors.bg);
	root.style.setProperty('--main', theme.colors.main);
	root.style.setProperty('--sub', theme.colors.sub);
	root.style.setProperty('--text', theme.colors.text);
	root.style.setProperty('--error', theme.colors.error);
}
