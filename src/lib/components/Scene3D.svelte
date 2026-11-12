<script lang="ts">
	// The 3D view of any takeoff: a list of boxes and cylinders (see
	// $lib/takeoff/scene) drawn with three.js, which loads only when a 3D
	// view opens. Solids that share a material are one instanced mesh and
	// their outlines one line set, so thousands of blocks stay quick. Drag
	// to turn, pinch or scroll to zoom, two fingers to pan, tap to select a
	// wall or piece; it draws only when something moves or changes.
	import { onMount } from 'svelte';
	import type { Scene } from '$lib/takeoff/scene';

	let { scene: input, onpick }: { scene: Scene; /** A tap on a solid: its `pick` (a wall, a piece). */ onpick?: (id: number) => void } = $props();

	type T3 = typeof import('three');
	let host: HTMLDivElement;
	let failed = $state(false);
	let ready = $state(false);
	let T: T3;
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
				renderer.domElement.addEventListener('pointerdown', pointerDown);
				renderer.domElement.addEventListener('pointerup', pointerUp);
				scene = new T.Scene();
				camera = new T.PerspectiveCamera(38, 1, 1, 50000);
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

	// A tap (not a drag) on a solid selects what it belongs to.
	let downAt: { x: number; y: number; t: number } | null = null;
	function pointerDown(e: PointerEvent) {
		downAt = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
	}
	function pointerUp(e: PointerEvent) {
		const d = downAt;
		downAt = null;
		if (!d || !onpick || !renderer || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
		const r = renderer.domElement.getBoundingClientRect();
		const ray = new T.Raycaster();
		ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
		for (const hit of ray.intersectObjects(model.children, false)) {
			const list = hit.object.userData.solids as import('$lib/takeoff/scene').Solid[] | undefined;
			const s = list && hit.instanceId !== undefined ? list[hit.instanceId] : undefined;
			if (s?.pick !== undefined) {
				onpick(s.pick);
				return;
			}
		}
	}

	function size() {
		if (!renderer) return;
		const w = host.clientWidth;
		// A container may set the height (--scene-h); else it follows the width.
		const fixed = getComputedStyle(host).getPropertyValue('--scene-h').trim() !== '';
		const h = fixed ? Math.max(120, host.clientHeight) : Math.round(Math.min(Math.max(w * 0.8, 260), 420));
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

	const css = (name: string) => getComputedStyle(host).getPropertyValue(name).trim() || '#999';

	function build() {
		clear();
		const accent = new T.Color(css('--primary'));
		const unit = { box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 40) };
		const edgePts = { box: new T.EdgesGeometry(unit.box), cyl: new T.EdgesGeometry(unit.cyl, 30) };
		const groups = new Map<string, typeof input.solids>();
		for (const s of input.solids) {
			const key = `${s.mat}|${s.shape ?? 'box'}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(s);
		}
		const mtx = new T.Matrix4();
		const q = new T.Quaternion();
		const up = new T.Vector3(0, 1, 0);
		const v = new T.Vector3();
		const sc = new T.Vector3();
		const eu = new T.Euler();
		let min = new T.Vector3(Infinity, 0, Infinity);
		let max = new T.Vector3(-Infinity, 1, -Infinity);
		for (const [key, list] of groups) {
			const [name, shape] = key.split('|') as [string, 'box' | 'cyl' | 'prism'];
			const spec = input.mats[name] ?? { color: '--faint' };
			const color = new T.Color(css(spec.color));
			if (spec.tint) color.lerp(accent, spec.tint);
			const see = spec.opacity !== undefined && spec.opacity < 1;
			const material = new T.MeshLambertMaterial({ color, transparent: see, opacity: spec.opacity ?? 1, depthWrite: !see });
			if (shape === 'prism') {
				// Each its own outline: a mesh apiece, not instanced.
				for (const s of list) {
					const outline = new T.Shape(s.profile!.map(([x, y]) => new T.Vector2(x, y)));
					const g = new T.ExtrudeGeometry(outline, { depth: 1, bevelEnabled: false });
					g.translate(0, 0, -0.5);
					const m = new T.Mesh(g, material);
					q.setFromAxisAngle(up, s.ry);
					m.matrixAutoUpdate = false;
					m.matrix.compose(v.set(...s.c), q, sc.set(1, 1, s.s[2]));
					model.add(m);
					for (const [x, y] of s.profile!) {
						const p = new T.Vector3(x, y, 0).applyMatrix4(m.matrix);
						min = min.min(new T.Vector3(p.x, 0, p.z));
						max = max.max(p);
					}
					if (spec.edges) {
						const e = new T.LineSegments(new T.EdgesGeometry(g, 20), new T.LineBasicMaterial({ color: css(spec.edge ?? '--wood-edge'), transparent: true, opacity: 0.5 }));
						e.matrixAutoUpdate = false;
						e.matrix.copy(m.matrix);
						model.add(e);
					}
				}
				continue;
			}
			const mesh = new T.InstancedMesh(unit[shape as 'box' | 'cyl'], material, list.length);
			mesh.userData.solids = list;
			const src = edgePts[shape as 'box' | 'cyl'].getAttribute('position');
			const lines = spec.edges ? new Float32Array(list.length * src.count * 3) : null;
			list.forEach((s, i) => {
				if (s.rz) q.setFromEuler(eu.set(0, s.ry, s.rz, 'YZX'));
				else q.setFromAxisAngle(up, s.ry);
				mtx.compose(v.set(...s.c), q, sc.set(...s.s));
				mesh.setMatrixAt(i, mtx);
				const cs = Math.abs(Math.cos(s.ry));
				const sn = Math.abs(Math.sin(s.ry));
				const ex = (cs * s.s[0] + sn * s.s[2]) / 2;
				const ez = (sn * s.s[0] + cs * s.s[2]) / 2;
				min = min.min(new T.Vector3(s.c[0] - ex, 0, s.c[2] - ez));
				max = max.max(new T.Vector3(s.c[0] + ex, s.c[1] + s.s[1] / 2, s.c[2] + ez));
				if (lines)
					for (let k = 0; k < src.count; k++) {
						const p = new T.Vector3().fromBufferAttribute(src, k).applyMatrix4(mtx);
						lines.set([p.x, p.y, p.z], (i * src.count + k) * 3);
					}
			});
			mesh.instanceMatrix.needsUpdate = true;
			model.add(mesh);
			if (lines) {
				const g = new T.BufferGeometry();
				g.setAttribute('position', new T.BufferAttribute(lines, 3));
				model.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: css(spec.edge ?? '--wood-edge'), transparent: true, opacity: 0.5 })));
			}
		}
		// Slabs: flat outlines pushed up, all of one material in one mesh.
		let minY = 0;
		const slabGroups = new Map<string, NonNullable<typeof input.slabs>>();
		for (const sl of input.slabs ?? []) {
			if (sl.poly.length < 3 || sl.h <= 0) continue;
			if (!slabGroups.has(sl.mat)) slabGroups.set(sl.mat, []);
			slabGroups.get(sl.mat)!.push(sl);
		}
		for (const [name, list] of slabGroups) {
			const spec = input.mats[name] ?? { color: '--faint' };
			const color = new T.Color(css(spec.color));
			if (spec.tint) color.lerp(accent, spec.tint);
			const see = spec.opacity !== undefined && spec.opacity < 1;
			const pos: number[] = [];
			const edge: number[] = [];
			for (const sl of list) {
				let area = 0;
				const P = sl.poly;
				for (let i = 0; i < P.length; i++) area += P[i][0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * P[i][1];
				const poly = area > 0 ? [...P].reverse() : P;
				const y0 = sl.y0;
				const y1 = sl.y0 + sl.h;
				minY = Math.min(minY, y0);
				for (let i = 1; i + 1 < poly.length; i++) pos.push(poly[0][0], y1, poly[0][1], poly[i][0], y1, poly[i][1], poly[i + 1][0], y1, poly[i + 1][1]);
				for (let i = 0; i < poly.length; i++) {
					const a = poly[i];
					const b = poly[(i + 1) % poly.length];
					pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
					if (spec.edges) edge.push(a[0], y1 + 0.01, a[1], b[0], y1 + 0.01, b[1]);
					min = min.min(new T.Vector3(a[0], 0, a[1]));
					max = max.max(new T.Vector3(a[0], y1, a[1]));
				}
			}
			const g = new T.BufferGeometry();
			g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
			g.computeVertexNormals();
			model.add(new T.Mesh(g, new T.MeshLambertMaterial({ color, transparent: see, opacity: spec.opacity ?? 1, depthWrite: !see, side: T.DoubleSide })));
			if (edge.length) {
				const eg = new T.BufferGeometry();
				eg.setAttribute('position', new T.Float32BufferAttribute(edge, 3));
				model.add(new T.LineSegments(eg, new T.LineBasicMaterial({ color: css(spec.edge ?? '--wood-edge'), transparent: true, opacity: 0.6 })));
			}
		}

		unit.box.dispose();
		unit.cyl.dispose();
		edgePts.box.dispose();
		edgePts.cyl.dispose();
		if (!input.solids.length && !input.slabs?.length) {
			draw();
			return;
		}

		// The floor, a little past the model.
		const span = Math.max(max.x - min.x, max.z - min.z);
		const pad = span * 0.12 + 12;
		const floor = new T.Mesh(new T.PlaneGeometry(max.x - min.x + pad * 2, max.z - min.z + pad * 2), new T.MeshLambertMaterial({ color: css('--surface-2') }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set((min.x + max.x) / 2, minY - 0.1, (min.z + max.z) / 2);
		model.add(floor);

		// Aim the camera when the model's size changes, not on every edit,
		// so a view the user turned stays put.
		const r6 = (n: number) => Math.round(n / 6);
		const shape = [min.x, min.z, max.x, max.y, max.z].map(r6).join(',');
		if (shape !== fitted) {
			fitted = shape;
			const cx = (min.x + max.x) / 2;
			const cz = (min.z + max.z) / 2;
			const r = Math.max(Math.hypot(max.x - min.x, max.z - min.z), max.y) * 0.5;
			// A tall view (a phone) sees less across: back off to fit the width.
			const dist = ((r / Math.sin((camera.fov * Math.PI) / 360)) * 0.9) / Math.min(1, Math.max(0.5, camera.aspect));
			controls.target.set(cx, max.y * 0.4, cz);
			camera.position.set(cx + dist * 0.45, max.y * 0.4 + dist * 0.55, cz + dist * 0.7);
			controls.minDistance = r * 0.2;
			controls.maxDistance = dist * 3;
			controls.update();
		}
		draw();
	}

	$effect(() => {
		void input;
		if (ready) build();
	});

	// Light / dark switched: the colors come from the theme, so repaint.
	$effect(() => {
		const obs = new MutationObserver(() => ready && build());
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => obs.disconnect();
	});
</script>

<div class="three" bind:this={host}>
	{#if failed}<p class="fine">3D needs WebGL, which this device doesn't offer.</p>{/if}
</div>

<style>
	.three {
		width: 100%;
		height: var(--scene-h, auto);
		min-height: var(--scene-min, 260px);
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
