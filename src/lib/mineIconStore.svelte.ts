export type MineIcon = 'asterisk' | 'skull' | 'radiation' | 'flame';

class MineIconStore {
	value = $state<MineIcon>('asterisk');

	set(v: MineIcon) {
		this.value = v;
	}
}

export const mineIcon = new MineIconStore();
