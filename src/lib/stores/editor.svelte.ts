// The one value editor every field opens: a sheet with the value keypad.
// A field says what it holds (a length in inches, or a plain number) and
// what a bare number means for a length ("12" in a Length field is feet,
// in a Thickness field inches).

export interface EditRequest {
	label: string;
	kind: 'length' | 'number';
	/** Inches for a length. */
	value: number;
	/** What a number typed without ′ or ″ means. */
	bare?: 'ft' | 'in';
	min?: number;
	max?: number;
	/** Whole numbers only (counts). */
	integer?: boolean;
	suffix?: string;
	set: (v: number) => void;
}

export const editor = $state<{ req: EditRequest | null }>({ req: null });

export function edit(req: EditRequest) {
	editor.req = req;
}
