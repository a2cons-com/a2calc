<script lang="ts">
	// The framing in 3D: every member as a box, where the plan puts its
	// wall, with glass in the windows. Drag to turn it, pinch or scroll to
	// zoom, two fingers to pan. three.js loads only when this view opens.
	// It draws on demand (when something moves or changes), not every frame.
	import { onMount } from 'svelte';
	import type { Role, RunFraming } from '$lib/takeoff/framing';
	import { at, type Plan } from '$lib/takeoff/plan';

	let {
		runs,
		plan,
		height,
		selected
	}: { runs: RunFraming[]; plan: Plan; height: number; selected: number } = $props();

	type Three = typeof import('three');
	let host: HTMLDivElement;
	let failed = $state(false);
	let ready = $state(false);
	let T: Three;
	let renderer: import('three').WebGLRenderer;
	let scene: import('three').Scene;
	let camera: import('three').PerspectiveCamera;
	let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
	let model: import('three').Group;
	let fitted = '';

	const draw = () => renderer?.render(scene, camera);

	onMount(() => {
		let alive = true;
		let ro: ResizeObserver | undefined;
		(async () => {
			try {
				T = await import('three');
				const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
				if (!alive) return;
				renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
				renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
				host.appendChild(renderer.domElement);
				scene = new T.Scene();
				camera = new T.PerspectiveCamera(38, 1, 1, 20000);
				scene.add(new T.HemisphereLight(0xffffff, 0x8a8070, 2.2));
				const sun = new T.DirectionalLight(0xffffff, 1.6);
				sun.position.set(-0.6, 1, 0.8);
				scene.add(sun);
				controls = new OrbitControls(camera, renderer.domElement);
				controls.maxPolarAngle = Math.PI * 0.49;
				controls.addEventListener('change', draw);
				model = new T.Group();
				scene.add(model);
				ro = new ResizeObserver(size);
				ro.observe(host);
				size();
				ready = true;
			} catch {
				failed = true;
			}
		})();
		return () => {
			alive = false;
			ro?.disconnect();
			controls?.dispose();
			clear();
			renderer?.dispose();
		};
	});

	function size() {
		if (!renderer) return;
		const w = host.clientWidth;
		const h = Math.round(Math.min(Math.max(w * 0.8, 260), 420));
		renderer.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		draw();
	}

	function clear() {
		if (!model) return;
		for (const c of [...model.children]) {
			model.remove(c);
			const m = c as import('three').Mesh;
			m.geometry?.dispose();
			const mat = m.material as import('three').Material | import('three').Material[] | undefined;
			(Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
		}
	}

	function css(name: string) {
		return getComputedStyle(host).getPropertyValue(name).trim() || '#999';
	}

	const COLOR: Record<Role, string> = {
		stud: '--wood',
		corner: '--wood',
		king: '--wood-king',
		jack: '--wood-king',
		cripple: '--wood',
		header: '--wood-header',
		sill: '--wood-header',
		'top plate': '--plate',
		'bottom plate': '--plate'
	};

	function build() {
		clear();
		const t = plan.depth;
		const unit = new T.BoxGeometry(1, 1, 1);
		const edges = new T.EdgesGeometry(unit);
		const mats = new Map<string, import('three').Material>();
		const mat = (key: string, make: () => import('three').Material) => {
			if (!mats.has(key)) mats.set(key, make());
			return mats.get(key)!;
		};
		const edgeMat = new T.LineBasicMaterial({ color: css('--wood-edge'), transparent: true, opacity: 0.55 });
		const accent = css('--primary');

		plan.walls.forEach((w, i) => {
			const rf = runs[i];
			if (!rf) return;
			const on = w.run.id === selected && plan.walls.length > 1;
			const rot = Math.atan2(-w.d[1], w.d[0]);
			const box = (x: number, y: number, len: number, h: number, depth: number, across: number, material: import('three').Material, outline = true) => {
				const p = at(w, x + len / 2, across);
				const mesh = new T.Mesh(unit, material);
				mesh.position.set(p[0], y + h / 2, p[1]);
				mesh.scale.set(len, h, depth);
				mesh.rotation.y = rot;
				model.add(mesh);
				if (outline) {
					const line = new T.LineSegments(edges, edgeMat);
					line.position.copy(mesh.position);
					line.scale.copy(mesh.scale);
					line.rotation.copy(mesh.rotation);
					model.add(line);
				}
			};
			for (const m of rf.members) {
				if (m.role === 'header' && m.plies === 0) continue;
				const material = mat(m.role + on, () => {
					const c = new T.Color(css(COLOR[m.role]));
					if (on) c.lerp(new T.Color(accent), 0.28);
					return new T.MeshLambertMaterial({ color: c });
				});
				box(m.x, m.y, m.w, m.h, t, t / 2, material);
			}
			const glass = mat('glass', () => new T.MeshLambertMaterial({ color: css('--opening-edge'), transparent: true, opacity: 0.35, depthWrite: false }));
			for (const p of rf.placed) if (p.o.kind === 'window') box(p.a, Math.max(0, p.o.sill), p.b - p.a, p.head - Math.max(0, p.o.sill), 0.5, t / 2, glass, false);
		});

		// The floor, a little past the walls.
		const [x0, y0, x1, y1] = plan.box;
		const pad = Math.max(x1 - x0, y1 - y0) * 0.12 + 12;
		const floor = new T.Mesh(new T.PlaneGeometry(x1 - x0 + pad * 2, y1 - y0 + pad * 2), new T.MeshLambertMaterial({ color: css('--surface-2') }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set((x0 + x1) / 2, -0.1, (y0 + y1) / 2);
		model.add(floor);

		// Aim the camera once per shape, so a turn the user made stays put
		// while they edit an opening.
		const shape = `${plan.walls.map((w) => w.length).join(',')}|${height}`;
		if (shape !== fitted) {
			fitted = shape;
			const cx = (x0 + x1) / 2;
			const cz = (y0 + y1) / 2;
			const r = Math.max(Math.hypot(x1 - x0, y1 - y0), height) * 0.5;
			const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
			controls.target.set(cx, height * 0.4, cz);
			camera.position.set(cx + dist * 0.45, height * 0.4 + dist * 0.55, cz + dist * 0.7);
			controls.minDistance = r * 0.3;
			controls.maxDistance = dist * 3;
			controls.update();
		}
		draw();
	}

	$effect(() => {
		// Rebuild when anything drawn changes.
		void [runs, plan, height, selected];
		if (ready) build();
	});
</script>

<div class="three" bind:this={host}>
	{#if failed}<p class="fine">3D needs WebGL, which this device doesn't offer.</p>{/if}
</div>

<style>
	.three {
		width: 100%;
		min-height: 260px;
		touch-action: none;
		border-radius: 12px;
		overflow: hidden;
	}
	.three :global(canvas) {
		display: block;
		touch-action: none;
	}
	p {
		padding: 20px;
		text-align: center;
	}
</style>
