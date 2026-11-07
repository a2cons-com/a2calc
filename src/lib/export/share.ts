// Hand a file made in the app to the person: the share sheet on iPhone,
// iPad and Android (Mail, Messages, AirDrop, Files...), a Save dialog on the
// Mac, a download on Windows and the web. Nothing leaves the device unless
// they send it.

import { isNative } from '$lib/native';

const toBase64 = (bytes: Uint8Array) => {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
};

/** A safe file name: "Smith garage - Stud wall.pdf". */
export const fileName = (base: string, ext: string) =>
	`${base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'A2 Calc'}.${ext}`;

export async function shareFile(name: string, mime: string, data: Uint8Array | string): Promise<'shared' | 'saved' | 'cancelled'> {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

	if (isNative()) {
		const { Filesystem, Directory } = await import('@capacitor/filesystem');
		const { Share } = await import('@capacitor/share');
		const { uri } = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
		try {
			await Share.share({ title: name, files: [uri] });
			return 'shared';
		} catch {
			return 'cancelled'; // closed the share sheet
		}
	}

	// The Mac app: its native side shows a Save dialog.
	const mac = (window as unknown as { webkit?: { messageHandlers?: { saveFile?: { postMessage(m: unknown): void } } } }).webkit?.messageHandlers?.saveFile;
	if (mac) {
		mac.postMessage({ name, mime, base64: toBase64(bytes) });
		return 'saved';
	}

	const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 30_000);
	return 'saved';
}
