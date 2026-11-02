class ZenStore {
	value = $state(false);

	toggle() {
		this.value = !this.value;
	}
}

export const zenMode = new ZenStore();
