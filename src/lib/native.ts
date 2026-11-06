// Native touches when running inside the iOS app; no-ops on the web.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { prefs } from '$lib/stores/app.svelte';

export const isNative = () => Capacitor.isNativePlatform();

export function tap(strong = false) {
	if (!prefs.haptics || !isNative()) return;
	Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
}

/** Put text on the clipboard: the native clipboard in the apps, the
 *  browser's on the web (with an old-style fallback). True when it worked. */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (isNative()) {
			const { Clipboard } = await import('@capacitor/clipboard');
			await Clipboard.write({ string: text });
			return true;
		}
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const t = document.createElement('textarea');
			t.value = text;
			t.style.position = 'fixed';
			t.style.opacity = '0';
			document.body.appendChild(t);
			t.select();
			const ok = document.execCommand('copy');
			t.remove();
			return ok;
		} catch {
			return false;
		}
	}
}

/** An answer as plain text for other apps: straight quote marks (8' 2 1/4")
 *  and a plain minus. */
export const plainText = (s: string) => s.replace(/′/g, "'").replace(/″/g, '"').replace(/−/g, '-');
