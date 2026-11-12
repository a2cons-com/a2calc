<script lang="ts">
	// A handful of line icons drawn for this app (24-unit grid, 1.8 stroke).
	let { name, size = 22 }: { name: string; size?: number } = $props();
	const PATHS: Record<string, string> = {
		calc: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1.5 4h9M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
		convert: 'M4 8h13l-3.5-3.5M20 16H7l3.5 3.5',
		takeoff: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6',
		info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01',
		tape: 'M12 7v5l3 2M12 21a9 9 0 1 0-9-9M3 12l-1.5-1.5M3 12l1.5-1.5',
		back: 'M15 5l-7 7 7 7',
		folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
		share: 'M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
		more: 'M5 12h.01M12 12h.01M19 12h.01',
		pencil: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
		chevron: 'M9 5l7 7-7 7',
		plus: 'M12 5v14M5 12h14',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
		close: 'M6 6l12 12M18 6 6 18',
		backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Zm3 4 6 6m0-6-6 6',
		slab: 'M3 14l9 5 9-5-9-5-9 5Zm0 0v2l9 5 9-5v-2',
		brick: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
		studs: 'M4 4h16M4 20h16M6 4v16M10 4v16M14 4v16M18 4v16',
		stairs: 'M3 20h4v-4h4v-4h4V8h4V4h2',
		floor: 'M3 4h18v16H3zM3 9.3h18M3 14.7h18M10 4v5.3M15 9.3v5.4M8 14.7V20',
		walltile: 'M4 3v18M4 21h17M8 6h11v12H8zM8 10h11M8 14h11M13 6v4M16 10v4M12 14v4',
		copy: 'M9 9h10v10H9zM5 15V5h10',
		menu: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'
	};
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d={PATHS[name] ?? ''} />
</svg>
