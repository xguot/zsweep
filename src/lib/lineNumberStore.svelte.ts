import { browser } from '$app/environment';

export type LineNumberMode = 'off' | 'normal' | 'relative' | 'hybrid';

class LineNumberStore {
	value = $state<LineNumberMode>(
		browser ? ((localStorage.getItem('zsweep_linenumbers') as LineNumberMode) || 'off') : 'off'
	);

	set(mode: LineNumberMode) {
		this.value = mode;
		if (browser) localStorage.setItem('zsweep_linenumbers', mode);
	}
}

export const lineNumbers = new LineNumberStore();
