(function() {
	const w = [
		{
			axis: 0,
			sign: 1,
			uAxis: 1,
			vAxis: 2,
			normal: [
				1,
				0,
				0
			]
		},
		{
			axis: 0,
			sign: -1,
			uAxis: 2,
			vAxis: 1,
			normal: [
				-1,
				0,
				0
			]
		},
		{
			axis: 1,
			sign: 1,
			uAxis: 2,
			vAxis: 0,
			normal: [
				0,
				1,
				0
			]
		},
		{
			axis: 1,
			sign: -1,
			uAxis: 0,
			vAxis: 2,
			normal: [
				0,
				-1,
				0
			]
		},
		{
			axis: 2,
			sign: 1,
			uAxis: 0,
			vAxis: 1,
			normal: [
				0,
				0,
				1
			]
		},
		{
			axis: 2,
			sign: -1,
			uAxis: 1,
			vAxis: 0,
			normal: [
				0,
				0,
				-1
			]
		}
	];
	function C(m, c, o, s) {
		return m + s * (c + s * o);
	}
	function q() {
		return {
			positions: [],
			normals: [],
			uvs: [],
			indices: [],
			quadCount: 0
		};
	}
	function V(m) {
		const c = performance.now(), o = m.chunk, s = o.chunkSize, A = /* @__PURE__ */ new Map();
		function d(e, n, i) {
			return e >= 0 && e < s && n >= 0 && n < s && i >= 0 && i < s ? o.cells[C(e, n, i, s)] ?? 0 : e < 0 ? o.boundaries.negativeX[n + i * s] ? 1 : 0 : e >= s ? o.boundaries.positiveX[n + i * s] ? 1 : 0 : n < 0 ? o.boundaries.negativeY[e + i * s] ? 1 : 0 : n >= s ? o.boundaries.positiveY[e + i * s] ? 1 : 0 : i < 0 ? o.boundaries.negativeZ[e + n * s] ? 1 : 0 : i >= s && o.boundaries.positiveZ[e + n * s] ? 1 : 0;
		}
		function I(e, n, i, t, a, r, u) {
			const l = [
				0,
				0,
				0
			], f = [
				0,
				0,
				0
			], p = [
				0,
				0,
				0
			];
			l[n.axis] = i + (n.sign > 0 ? 1 : 0), l[n.uAxis] = t, l[n.vAxis] = a, f[n.uAxis] = r, p[n.vAxis] = u;
			const M = [
				o.chunkX * s,
				o.chunkY * s,
				o.chunkZ * s
			], g = e.positions.length / 3;
			for (let h = 0; h < 4; h += 1) {
				const S = h === 1 || h === 2, F = h >= 2;
				for (let x = 0; x < 3; x += 1) {
					const U = l[x] + (S ? f[x] : 0) + (F ? p[x] : 0);
					e.positions.push((M[x] + U) * o.cellSize), e.normals.push(n.normal[x]);
				}
			}
			e.uvs.push(0, 0, r, 0, r, u, 0, u), e.indices.push(g, g + 1, g + 2, g, g + 2, g + 3), e.quadCount += 1;
		}
		const v = new Int32Array(s * s);
		for (const e of w) for (let n = 0; n < s; n += 1) {
			v.fill(0);
			for (let i = 0; i < s; i += 1) for (let t = 0; t < s; t += 1) {
				let a = 0, r = 0, u = 0;
				e.axis === 0 ? a = n : e.axis === 1 ? r = n : u = n, e.uAxis === 0 ? a = t : e.uAxis === 1 ? r = t : u = t, e.vAxis === 0 ? a = i : e.vAxis === 1 ? r = i : u = i;
				const l = d(a, r, u);
				l <= 0 || d(a + (e.axis === 0 ? e.sign : 0), r + (e.axis === 1 ? e.sign : 0), u + (e.axis === 2 ? e.sign : 0)) > 0 || (v[t + i * s] = l);
			}
			for (let i = 0; i < s; i += 1) for (let t = 0; t < s;) {
				const a = v[t + i * s];
				if (a <= 0) {
					t += 1;
					continue;
				}
				let r = 1;
				for (; t + r < s && v[t + r + i * s] === a;) r += 1;
				let u = 1;
				s: for (; i + u < s;) {
					for (let f = 0; f < r; f += 1) if (v[t + f + (i + u) * s] !== a) break s;
					u += 1;
				}
				let l = A.get(a);
				l || (l = q(), A.set(a, l)), I(l, e, n, t, i, r, u);
				for (let f = 0; f < u; f += 1) for (let p = 0; p < r; p += 1) v[t + p + (i + f) * s] = 0;
				t += r;
			}
		}
		let b = 0;
		const k = [];
		for (const [e, n] of A.entries()) b += n.quadCount, k.push({
			cellValue: e,
			positions: new Float32Array(n.positions),
			normals: new Float32Array(n.normals),
			uvs: new Float32Array(n.uvs),
			indices: new Uint32Array(n.indices),
			quadCount: n.quadCount
		});
		return {
			chunkKey: o.chunkKey,
			buffers: k,
			quadCount: b,
			triangleCount: b * 2,
			buildMs: performance.now() - c
		};
	}
	self.onmessage = (m) => {
		const c = m.data;
		try {
			const o = V(c), s = {
				id: c.id,
				ok: !0,
				result: o
			}, A = [];
			for (const d of o.buffers) A.push(d.positions.buffer, d.normals.buffer, d.uvs.buffer, d.indices.buffer);
			self.postMessage(s, { transfer: A });
		} catch (o) {
			const s = {
				id: c.id,
				ok: !1,
				error: o instanceof Error ? o.message : String(o)
			};
			self.postMessage(s);
		}
	};
})();
