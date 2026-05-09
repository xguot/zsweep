import { browser } from '$app/environment';

class ZenStore {
	value = $state(browser ? localStorage.getItem('zsweep_zen_mode') === 'true' : false);

	toggle() {
		this.value = !this.value;
		if (browser) localStorage.setItem('zsweep_zen_mode', this.value.toString());
	}

	set(v: boolean) {
		this.value = v;
		if (browser) localStorage.setItem('zsweep_zen_mode', this.value.toString());
	}
}

export const zenMode = new ZenStore();
