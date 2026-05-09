/**
 * Runs the svelte-5 migration transforms directly, bypassing the interactive CLI.
 */
import { migrate } from 'svelte/compiler';
import {
	transform_module_code,
	transform_svelte_code,
	update_pkg_json
} from '/Users/addis/.npm/_npx/ca732f115159e57c/node_modules/svelte-migrate/migrations/svelte-5/migrate.js';
import {
	update_svelte_file,
	update_js_file
} from '/Users/addis/.npm/_npx/ca732f115159e57c/node_modules/svelte-migrate/utils.js';
import { transform_svelte_code as transform_app_state_code } from '/Users/addis/.npm/_npx/ca732f115159e57c/node_modules/svelte-migrate/migrations/app-state/migrate.js';
import glob from '/Users/addis/.npm/_npx/ca732f115159e57c/node_modules/tiny-glob/sync.js';
import fs from 'node:fs';

const folders = ['src'];
const svelte_extensions = ['.svelte'];
const extensions = [...svelte_extensions, '.ts', '.js'];
const use_ts = fs.existsSync('tsconfig.json');

const files = folders.flatMap((folder) =>
	glob(`${folder}/**`, { filesOnly: true, dot: true })
		.map((file) => file.replace(/\\/g, '/'))
		.filter((file) => !file.includes('/node_modules/'))
);

console.log(`Processing ${files.length} files...`);

for (const file of files) {
	if (extensions.some((ext) => file.endsWith(ext))) {
		if (svelte_extensions.some((ext) => file.endsWith(ext))) {
			console.log(`  [svelte] ${file}`);
			// app-state transform first (SvelteKit specific)
			update_svelte_file(file, (code) => code, (code) => transform_app_state_code(code));
			// main svelte-5 transform
			update_svelte_file(file, transform_module_code, (code) =>
				transform_svelte_code(code, migrate, { filename: file, use_ts })
			);
		} else {
			console.log(`  [js/ts]  ${file}`);
			update_js_file(file, transform_module_code);
		}
	}
}

console.log('\nUpdating package.json...');
update_pkg_json();

console.log('\nDone! Run `bun install` to update lockfile.');
