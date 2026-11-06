// Native touches when running inside the iOS app; no-ops on the web.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { prefs } from '$lib/stores/app.svelte';

export const isNative = () => Capacitor.isNativePlatform();

export function tap(strong = false) {
	if (!prefs.haptics || !isNative()) return;
	Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
}
