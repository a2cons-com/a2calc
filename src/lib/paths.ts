// The app's own links, under the base path it is served from: nothing in
// the native apps, /app on calc.a2cons.com (BASE_PATH at build time).
import { base } from '$app/paths';

export const p = (path: string) => base + path;
