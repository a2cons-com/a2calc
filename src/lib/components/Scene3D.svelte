<script lang="ts">
	// The 3D view of any takeoff: a list of boxes and cylinders (see
	// $lib/takeoff/scene) drawn with three.js, which loads only when a 3D
	// view opens. Solids that share a material are one instanced mesh and
	// their outlines one line set, so thousands of blocks stay quick. Drag
	// to turn, pinch or scroll to zoom, two fingers to pan; it draws only
	// when something moves or changes.
	import { onMount } from 'svelte';
	import type { Scene } from '$lib/takeoff/scene';

	let { scene: input }: { scene: Scene } = $props();

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
		let min = new T.Vector3(Infinity, 0, Infinity);
		let max = new T.Vector3(-Infinity, 1, -Infinity);
		for (const [key, list] of groups) {
			const [name, shape] = key.split('|') as [string, 'box' | 'cyl'];
			const spec = input.mats[name] ?? { color: '--faint' };
			const color = new T.Color(css(spec.color));
			if (spec.tint) color.lerp(accent, spec.tint);
			const see = spec.opacity !== undefined && spec.opacity < 1;
			const material = new T.MeshLambertMaterial({ color, transparent: see, opacity: spec.opacity ?? 1, depthWrite: !see });
			const mesh = new T.InstancedMesh(unit[shape], material, list.length);
			const src = edgePts[shape].getAttribute('position');
			const lines = spec.edges ? new Float32Array(list.length * src.count * 3) : null;
			list.forEach((s, i) => {
				q.setFromAxisAngle(up, s.ry);
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
		unit.box.dispose();
		unit.cyl.dispose();
		edgePts.box.dispose();
		edgePts.cyl.dispose();
		if (!input.solids.length) {
			draw();
			return;
		}

		// The floor, a little past the model.
		const span = Math.max(max.x - min.x, max.z - min.z);
		const pad = span * 0.12 + 12;
		const floor = new T.Mesh(new T.PlaneGeometry(max.x - min.x + pad * 2, max.z - min.z + pad * 2), new T.MeshLambertMaterial({ color: css('--surface-2') }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set((min.x + max.x) / 2, -0.1, (min.z + max.z) / 2);
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
			const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 0.9;
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
