// Small persisted state: a $state object saved to localStorage whenever it
// changes. Losing it is harmless (the tape, last inputs, preferences), so
// the browser store is enough; every access is guarded because storage can
// be unavailable (private mode, thumbnail renders).

const PREFIX = 'a2calc:';

function read<T>(key: string): T | undefined {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw ? (JSON.parse(raw) as T) : undefined;
	} catch {
		return undefined;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		/* storage full or blocked: keep working in memory */
	}
}

/** `version` bumps discard an incompatible saved shape. */
export function persisted<T extends object>(key: string, initial: T, version = 1): T {
	const saved = read<{ v: number; data: T }>(key);
	const start = saved && saved.v === version ? { ...initial, ...saved.data } : initial;
	const state = $state(start);
	$effect.root(() => {
		$effect(() => {
			write(key, { v: version, data: $state.snapshot(state) });
		});
	});
	return state;
}
