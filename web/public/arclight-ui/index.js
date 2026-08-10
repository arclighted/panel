import * as e from "react";
import t, { createContext as n, createElement as r, forwardRef as i, useContext as a, useLayoutEffect as o } from "react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
import * as l from "react-dom";
//#region \0rolldown/runtime.js
var u = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), d = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
});
//#endregion
//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function f(e) {
	var t, n, r = "";
	if (typeof e == "string" || typeof e == "number") r += e;
	else if (typeof e == "object") if (Array.isArray(e)) {
		var i = e.length;
		for (t = 0; t < i; t++) e[t] && (n = f(e[t])) && (r && (r += " "), r += n);
	} else for (n in e) e[n] && (r && (r += " "), r += n);
	return r;
}
function p() {
	for (var e, t, n = 0, r = "", i = arguments.length; n < i; n++) (e = arguments[n]) && (t = f(e)) && (r && (r += " "), r += t);
	return r;
}
//#endregion
//#region ../../node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge/dist/bundle-mjs.mjs
var m = (e, t) => {
	let n = Array(e.length + t.length);
	for (let t = 0; t < e.length; t++) n[t] = e[t];
	for (let r = 0; r < t.length; r++) n[e.length + r] = t[r];
	return n;
}, h = (e, t) => ({
	classGroupId: e,
	validator: t
}), g = (e = /* @__PURE__ */ new Map(), t = null, n) => ({
	nextPart: e,
	validators: t,
	classGroupId: n
}), _ = "-", v = [], y = "arbitrary..", b = (e) => {
	let t = C(e), { conflictingClassGroups: n, conflictingClassGroupModifiers: r } = e;
	return {
		getClassGroupId: (e) => {
			if (e.startsWith("[") && e.endsWith("]")) return S(e);
			let n = e.split(_);
			return x(n, +(n[0] === "" && n.length > 1), t);
		},
		getConflictingClassGroupIds: (e, t) => {
			if (t) {
				let t = r[e], i = n[e];
				return t ? i ? m(i, t) : t : i || v;
			}
			return n[e] || v;
		}
	};
}, x = (e, t, n) => {
	if (e.length - t === 0) return n.classGroupId;
	let r = e[t], i = n.nextPart.get(r);
	if (i) {
		let n = x(e, t + 1, i);
		if (n) return n;
	}
	let a = n.validators;
	if (a === null) return;
	let o = t === 0 ? e.join(_) : e.slice(t).join(_), s = a.length;
	for (let e = 0; e < s; e++) {
		let t = a[e];
		if (t.validator(o)) return t.classGroupId;
	}
}, S = (e) => e.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
	let t = e.slice(1, -1), n = t.indexOf(":"), r = t.slice(0, n);
	return r ? y + r : void 0;
})(), C = (e) => {
	let { theme: t, classGroups: n } = e;
	return w(n, t);
}, w = (e, t) => {
	let n = g();
	for (let r in e) {
		let i = e[r];
		T(i, n, r, t);
	}
	return n;
}, T = (e, t, n, r) => {
	let i = e.length;
	for (let a = 0; a < i; a++) {
		let i = e[a];
		E(i, t, n, r);
	}
}, E = (e, t, n, r) => {
	if (typeof e == "string") {
		D(e, t, n);
		return;
	}
	if (typeof e == "function") {
		O(e, t, n, r);
		return;
	}
	k(e, t, n, r);
}, D = (e, t, n) => {
	let r = e === "" ? t : A(t, e);
	r.classGroupId = n;
}, O = (e, t, n, r) => {
	if (j(e)) {
		T(e(r), t, n, r);
		return;
	}
	t.validators === null && (t.validators = []), t.validators.push(h(n, e));
}, k = (e, t, n, r) => {
	let i = Object.entries(e), a = i.length;
	for (let e = 0; e < a; e++) {
		let [a, o] = i[e];
		T(o, A(t, a), n, r);
	}
}, A = (e, t) => {
	let n = e, r = t.split(_), i = r.length;
	for (let e = 0; e < i; e++) {
		let t = r[e], i = n.nextPart.get(t);
		i || (i = g(), n.nextPart.set(t, i)), n = i;
	}
	return n;
}, j = (e) => "isThemeGetter" in e && e.isThemeGetter === !0, M = (e) => {
	if (e < 1) return {
		get: () => void 0,
		set: () => {}
	};
	let t = 0, n = Object.create(null), r = Object.create(null), i = (i, a) => {
		n[i] = a, t++, t > e && (t = 0, r = n, n = Object.create(null));
	};
	return {
		get(e) {
			let t = n[e];
			if (t !== void 0) return t;
			if ((t = r[e]) !== void 0) return i(e, t), t;
		},
		set(e, t) {
			e in n ? n[e] = t : i(e, t);
		}
	};
}, N = "!", P = ":", F = [], I = (e, t, n, r, i) => ({
	modifiers: e,
	hasImportantModifier: t,
	baseClassName: n,
	maybePostfixModifierPosition: r,
	isExternal: i
}), L = (e) => {
	let { prefix: t, experimentalParseClassName: n } = e, r = (e) => {
		let t = [], n = 0, r = 0, i = 0, a, o = e.length;
		for (let s = 0; s < o; s++) {
			let o = e[s];
			if (n === 0 && r === 0) {
				if (o === P) {
					t.push(e.slice(i, s)), i = s + 1;
					continue;
				}
				if (o === "/") {
					a = s;
					continue;
				}
			}
			o === "[" ? n++ : o === "]" ? n-- : o === "(" ? r++ : o === ")" && r--;
		}
		let s = t.length === 0 ? e : e.slice(i), c = s, l = !1;
		s.endsWith(N) ? (c = s.slice(0, -1), l = !0) : s.startsWith(N) && (c = s.slice(1), l = !0);
		let u = a && a > i ? a - i : void 0;
		return I(t, l, c, u);
	};
	if (t) {
		let e = t + P, n = r;
		r = (t) => t.startsWith(e) ? n(t.slice(e.length)) : I(F, !1, t, void 0, !0);
	}
	if (n) {
		let e = r;
		r = (t) => n({
			className: t,
			parseClassName: e
		});
	}
	return r;
}, R = (e) => {
	let t = /* @__PURE__ */ new Map();
	return e.orderSensitiveModifiers.forEach((e, n) => {
		t.set(e, 1e6 + n);
	}), (e) => {
		let n = [], r = [];
		for (let i = 0; i < e.length; i++) {
			let a = e[i], o = a[0] === "[", s = t.has(a);
			o || s ? (r.length > 0 && (r.sort(), n.push(...r), r = []), n.push(a)) : r.push(a);
		}
		return r.length > 0 && (r.sort(), n.push(...r)), n;
	};
}, z = (e) => ({
	cache: M(e.cacheSize),
	parseClassName: L(e),
	sortModifiers: R(e),
	postfixLookupClassGroupIds: ee(e),
	...b(e)
}), ee = (e) => {
	let t = Object.create(null), n = e.postfixLookupClassGroups;
	if (n) for (let e = 0; e < n.length; e++) t[n[e]] = !0;
	return t;
}, B = /\s+/, V = (e, t) => {
	let { parseClassName: n, getClassGroupId: r, getConflictingClassGroupIds: i, sortModifiers: a, postfixLookupClassGroupIds: o } = t, s = [], c = e.trim().split(B), l = "";
	for (let e = c.length - 1; e >= 0; --e) {
		let t = c[e], { isExternal: u, modifiers: d, hasImportantModifier: f, baseClassName: p, maybePostfixModifierPosition: m } = n(t);
		if (u) {
			l = t + (l.length > 0 ? " " + l : l);
			continue;
		}
		let h = !!m, g;
		if (h) {
			g = r(p.substring(0, m));
			let e = g && o[g] ? r(p) : void 0;
			e && e !== g && (g = e, h = !1);
		} else g = r(p);
		if (!g) {
			if (!h) {
				l = t + (l.length > 0 ? " " + l : l);
				continue;
			}
			if (g = r(p), !g) {
				l = t + (l.length > 0 ? " " + l : l);
				continue;
			}
			h = !1;
		}
		let _ = d.length === 0 ? "" : d.length === 1 ? d[0] : a(d).join(":"), v = f ? _ + N : _, y = v + g;
		if (s.indexOf(y) > -1) continue;
		s.push(y);
		let b = i(g, h);
		for (let e = 0; e < b.length; ++e) {
			let t = b[e];
			s.push(v + t);
		}
		l = t + (l.length > 0 ? " " + l : l);
	}
	return l;
}, H = (...e) => {
	let t = 0, n, r, i = "";
	for (; t < e.length;) (n = e[t++]) && (r = te(n)) && (i && (i += " "), i += r);
	return i;
}, te = (e) => {
	if (typeof e == "string") return e;
	let t, n = "";
	for (let r = 0; r < e.length; r++) e[r] && (t = te(e[r])) && (n && (n += " "), n += t);
	return n;
}, U = (e, ...t) => {
	let n, r, i, a, o = (o) => (n = z(t.reduce((e, t) => t(e), e())), r = n.cache.get, i = n.cache.set, a = s, s(o)), s = (e) => {
		let t = r(e);
		if (t) return t;
		let a = V(e, n);
		return i(e, a), a;
	};
	return a = o, (...e) => a(H(...e));
}, ne = [], W = (e) => {
	let t = (t) => t[e] || ne;
	return t.isThemeGetter = !0, t;
}, re = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, ie = /^\((?:(\w[\w-]*):)?(.+)\)$/i, ae = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, oe = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, se = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, ce = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, le = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, ue = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, de = (e) => ae.test(e), G = (e) => !!e && !Number.isNaN(Number(e)), fe = (e) => !!e && Number.isInteger(Number(e)), pe = (e) => e.endsWith("%") && G(e.slice(0, -1)), me = (e) => oe.test(e), he = () => !0, ge = (e) => se.test(e) && !ce.test(e), _e = () => !1, ve = (e) => le.test(e), ye = (e) => ue.test(e), be = (e) => !K(e) && !q(e), xe = (e) => e.startsWith("@container") && (e[10] === "/" && e[11] !== void 0 || e[11] === "s" && e[16] !== void 0 && e.startsWith("-size/", 10) || e[11] === "n" && e[18] !== void 0 && e.startsWith("-normal/", 10)), Se = (e) => Le(e, Ve, _e), K = (e) => re.test(e), Ce = (e) => Le(e, He, ge), we = (e) => Le(e, Ue, G), Te = (e) => Le(e, Ge, he), Ee = (e) => Le(e, We, _e), De = (e) => Le(e, ze, _e), Oe = (e) => Le(e, Be, ye), ke = (e) => Le(e, Ke, ve), q = (e) => ie.test(e), Ae = (e) => Re(e, He), je = (e) => Re(e, We), Me = (e) => Re(e, ze), Ne = (e) => Re(e, Ve), Pe = (e) => Re(e, Be), Fe = (e) => Re(e, Ke, !0), Ie = (e) => Re(e, Ge, !0), Le = (e, t, n) => {
	let r = re.exec(e);
	return r ? r[1] ? t(r[1]) : n(r[2]) : !1;
}, Re = (e, t, n = !1) => {
	let r = ie.exec(e);
	return r ? r[1] ? t(r[1]) : n : !1;
}, ze = (e) => e === "position" || e === "percentage", Be = (e) => e === "image" || e === "url", Ve = (e) => e === "length" || e === "size" || e === "bg-size", He = (e) => e === "length", Ue = (e) => e === "number", We = (e) => e === "family-name", Ge = (e) => e === "number" || e === "weight", Ke = (e) => e === "shadow", qe = /*#__PURE__*/ U(() => {
	let e = W("color"), t = W("font"), n = W("text"), r = W("font-weight"), i = W("tracking"), a = W("leading"), o = W("breakpoint"), s = W("container"), c = W("spacing"), l = W("radius"), u = W("shadow"), d = W("inset-shadow"), f = W("text-shadow"), p = W("drop-shadow"), m = W("blur"), h = W("perspective"), g = W("aspect"), _ = W("ease"), v = W("animate"), y = () => [
		"auto",
		"avoid",
		"all",
		"avoid-page",
		"page",
		"left",
		"right",
		"column"
	], b = () => [
		"center",
		"top",
		"bottom",
		"left",
		"right",
		"top-left",
		"left-top",
		"top-right",
		"right-top",
		"bottom-right",
		"right-bottom",
		"bottom-left",
		"left-bottom"
	], x = () => [
		...b(),
		q,
		K
	], S = () => [
		"auto",
		"hidden",
		"clip",
		"visible",
		"scroll"
	], C = () => [
		"auto",
		"contain",
		"none"
	], w = () => [
		q,
		K,
		c
	], T = () => [
		de,
		"full",
		"auto",
		...w()
	], E = () => [
		fe,
		"none",
		"subgrid",
		q,
		K
	], D = () => [
		"auto",
		{ span: [
			"full",
			fe,
			q,
			K
		] },
		fe,
		q,
		K
	], O = () => [
		fe,
		"auto",
		q,
		K
	], k = () => [
		"auto",
		"min",
		"max",
		"fr",
		q,
		K
	], A = () => [
		"start",
		"end",
		"center",
		"between",
		"around",
		"evenly",
		"stretch",
		"baseline",
		"center-safe",
		"end-safe"
	], j = () => [
		"start",
		"end",
		"center",
		"stretch",
		"center-safe",
		"end-safe"
	], M = () => ["auto", ...w()], N = () => [
		de,
		"auto",
		"full",
		"dvw",
		"dvh",
		"lvw",
		"lvh",
		"svw",
		"svh",
		"min",
		"max",
		"fit",
		...w()
	], P = () => [
		de,
		"screen",
		"full",
		"dvw",
		"lvw",
		"svw",
		"min",
		"max",
		"fit",
		...w()
	], F = () => [
		de,
		"screen",
		"full",
		"lh",
		"dvh",
		"lvh",
		"svh",
		"min",
		"max",
		"fit",
		...w()
	], I = () => [
		e,
		q,
		K
	], L = () => [
		...b(),
		Me,
		De,
		{ position: [q, K] }
	], R = () => ["no-repeat", { repeat: [
		"",
		"x",
		"y",
		"space",
		"round"
	] }], z = () => [
		"auto",
		"cover",
		"contain",
		Ne,
		Se,
		{ size: [q, K] }
	], ee = () => [
		pe,
		Ae,
		Ce
	], B = () => [
		"",
		"none",
		"full",
		l,
		q,
		K
	], V = () => [
		"",
		G,
		Ae,
		Ce
	], H = () => [
		"solid",
		"dashed",
		"dotted",
		"double"
	], te = () => [
		"normal",
		"multiply",
		"screen",
		"overlay",
		"darken",
		"lighten",
		"color-dodge",
		"color-burn",
		"hard-light",
		"soft-light",
		"difference",
		"exclusion",
		"hue",
		"saturation",
		"color",
		"luminosity"
	], U = () => [
		G,
		pe,
		Me,
		De
	], ne = () => [
		"",
		"none",
		m,
		q,
		K
	], re = () => [
		"none",
		G,
		q,
		K
	], ie = () => [
		"none",
		G,
		q,
		K
	], ae = () => [
		G,
		q,
		K
	], oe = () => [
		de,
		"full",
		...w()
	];
	return {
		cacheSize: 500,
		theme: {
			animate: [
				"spin",
				"ping",
				"pulse",
				"bounce"
			],
			aspect: ["video"],
			blur: [me],
			breakpoint: [me],
			color: [he],
			container: [me],
			"drop-shadow": [me],
			ease: [
				"in",
				"out",
				"in-out"
			],
			font: [be],
			"font-weight": [
				"thin",
				"extralight",
				"light",
				"normal",
				"medium",
				"semibold",
				"bold",
				"extrabold",
				"black"
			],
			"inset-shadow": [me],
			leading: [
				"none",
				"tight",
				"snug",
				"normal",
				"relaxed",
				"loose"
			],
			perspective: [
				"dramatic",
				"near",
				"normal",
				"midrange",
				"distant",
				"none"
			],
			radius: [me],
			shadow: [me],
			spacing: ["px", G],
			text: [me],
			"text-shadow": [me],
			tracking: [
				"tighter",
				"tight",
				"normal",
				"wide",
				"wider",
				"widest"
			]
		},
		classGroups: {
			aspect: [{ aspect: [
				"auto",
				"square",
				de,
				K,
				q,
				g
			] }],
			container: ["container"],
			"container-type": [{ "@container": [
				"",
				"normal",
				"size",
				q,
				K
			] }],
			"container-named": [xe],
			columns: [{ columns: [
				G,
				K,
				q,
				s
			] }],
			"break-after": [{ "break-after": y() }],
			"break-before": [{ "break-before": y() }],
			"break-inside": [{ "break-inside": [
				"auto",
				"avoid",
				"avoid-page",
				"avoid-column"
			] }],
			"box-decoration": [{ "box-decoration": ["slice", "clone"] }],
			box: [{ box: ["border", "content"] }],
			display: [
				"block",
				"inline-block",
				"inline",
				"flex",
				"inline-flex",
				"table",
				"inline-table",
				"table-caption",
				"table-cell",
				"table-column",
				"table-column-group",
				"table-footer-group",
				"table-header-group",
				"table-row-group",
				"table-row",
				"flow-root",
				"grid",
				"inline-grid",
				"contents",
				"list-item",
				"hidden"
			],
			sr: ["sr-only", "not-sr-only"],
			float: [{ float: [
				"right",
				"left",
				"none",
				"start",
				"end"
			] }],
			clear: [{ clear: [
				"left",
				"right",
				"both",
				"none",
				"start",
				"end"
			] }],
			isolation: ["isolate", "isolation-auto"],
			"object-fit": [{ object: [
				"contain",
				"cover",
				"fill",
				"none",
				"scale-down"
			] }],
			"object-position": [{ object: x() }],
			overflow: [{ overflow: S() }],
			"overflow-x": [{ "overflow-x": S() }],
			"overflow-y": [{ "overflow-y": S() }],
			overscroll: [{ overscroll: C() }],
			"overscroll-x": [{ "overscroll-x": C() }],
			"overscroll-y": [{ "overscroll-y": C() }],
			position: [
				"static",
				"fixed",
				"absolute",
				"relative",
				"sticky"
			],
			inset: [{ inset: T() }],
			"inset-x": [{ "inset-x": T() }],
			"inset-y": [{ "inset-y": T() }],
			start: [{
				"inset-s": T(),
				start: T()
			}],
			end: [{
				"inset-e": T(),
				end: T()
			}],
			"inset-bs": [{ "inset-bs": T() }],
			"inset-be": [{ "inset-be": T() }],
			top: [{ top: T() }],
			right: [{ right: T() }],
			bottom: [{ bottom: T() }],
			left: [{ left: T() }],
			visibility: [
				"visible",
				"invisible",
				"collapse"
			],
			z: [{ z: [
				fe,
				"auto",
				q,
				K
			] }],
			basis: [{ basis: [
				de,
				"full",
				"auto",
				s,
				...w()
			] }],
			"flex-direction": [{ flex: [
				"row",
				"row-reverse",
				"col",
				"col-reverse"
			] }],
			"flex-wrap": [{ flex: [
				"nowrap",
				"wrap",
				"wrap-reverse"
			] }],
			flex: [{ flex: [
				G,
				de,
				"auto",
				"initial",
				"none",
				K
			] }],
			grow: [{ grow: [
				"",
				G,
				q,
				K
			] }],
			shrink: [{ shrink: [
				"",
				G,
				q,
				K
			] }],
			order: [{ order: [
				fe,
				"first",
				"last",
				"none",
				q,
				K
			] }],
			"grid-cols": [{ "grid-cols": E() }],
			"col-start-end": [{ col: D() }],
			"col-start": [{ "col-start": O() }],
			"col-end": [{ "col-end": O() }],
			"grid-rows": [{ "grid-rows": E() }],
			"row-start-end": [{ row: D() }],
			"row-start": [{ "row-start": O() }],
			"row-end": [{ "row-end": O() }],
			"grid-flow": [{ "grid-flow": [
				"row",
				"col",
				"dense",
				"row-dense",
				"col-dense"
			] }],
			"auto-cols": [{ "auto-cols": k() }],
			"auto-rows": [{ "auto-rows": k() }],
			gap: [{ gap: w() }],
			"gap-x": [{ "gap-x": w() }],
			"gap-y": [{ "gap-y": w() }],
			"justify-content": [{ justify: [...A(), "normal"] }],
			"justify-items": [{ "justify-items": [...j(), "normal"] }],
			"justify-self": [{ "justify-self": ["auto", ...j()] }],
			"align-content": [{ content: ["normal", ...A()] }],
			"align-items": [{ items: [...j(), { baseline: ["", "last"] }] }],
			"align-self": [{ self: [
				"auto",
				...j(),
				{ baseline: ["", "last"] }
			] }],
			"place-content": [{ "place-content": A() }],
			"place-items": [{ "place-items": [...j(), "baseline"] }],
			"place-self": [{ "place-self": ["auto", ...j()] }],
			p: [{ p: w() }],
			px: [{ px: w() }],
			py: [{ py: w() }],
			ps: [{ ps: w() }],
			pe: [{ pe: w() }],
			pbs: [{ pbs: w() }],
			pbe: [{ pbe: w() }],
			pt: [{ pt: w() }],
			pr: [{ pr: w() }],
			pb: [{ pb: w() }],
			pl: [{ pl: w() }],
			m: [{ m: M() }],
			mx: [{ mx: M() }],
			my: [{ my: M() }],
			ms: [{ ms: M() }],
			me: [{ me: M() }],
			mbs: [{ mbs: M() }],
			mbe: [{ mbe: M() }],
			mt: [{ mt: M() }],
			mr: [{ mr: M() }],
			mb: [{ mb: M() }],
			ml: [{ ml: M() }],
			"space-x": [{ "space-x": w() }],
			"space-x-reverse": ["space-x-reverse"],
			"space-y": [{ "space-y": w() }],
			"space-y-reverse": ["space-y-reverse"],
			size: [{ size: N() }],
			"inline-size": [{ inline: ["auto", ...P()] }],
			"min-inline-size": [{ "min-inline": ["auto", ...P()] }],
			"max-inline-size": [{ "max-inline": ["none", ...P()] }],
			"block-size": [{ block: ["auto", ...F()] }],
			"min-block-size": [{ "min-block": ["auto", ...F()] }],
			"max-block-size": [{ "max-block": ["none", ...F()] }],
			w: [{ w: [
				s,
				"screen",
				...N()
			] }],
			"min-w": [{ "min-w": [
				s,
				"screen",
				"none",
				...N()
			] }],
			"max-w": [{ "max-w": [
				s,
				"screen",
				"none",
				"prose",
				{ screen: [o] },
				...N()
			] }],
			h: [{ h: [
				"screen",
				"lh",
				...N()
			] }],
			"min-h": [{ "min-h": [
				"screen",
				"lh",
				"none",
				...N()
			] }],
			"max-h": [{ "max-h": [
				"screen",
				"lh",
				...N()
			] }],
			"font-size": [{ text: [
				"base",
				n,
				Ae,
				Ce
			] }],
			"font-smoothing": ["antialiased", "subpixel-antialiased"],
			"font-style": ["italic", "not-italic"],
			"font-weight": [{ font: [
				r,
				Ie,
				Te
			] }],
			"font-stretch": [{ "font-stretch": [
				"ultra-condensed",
				"extra-condensed",
				"condensed",
				"semi-condensed",
				"normal",
				"semi-expanded",
				"expanded",
				"extra-expanded",
				"ultra-expanded",
				pe,
				K
			] }],
			"font-family": [{ font: [
				je,
				Ee,
				t
			] }],
			"font-features": [{ "font-features": [K] }],
			"fvn-normal": ["normal-nums"],
			"fvn-ordinal": ["ordinal"],
			"fvn-slashed-zero": ["slashed-zero"],
			"fvn-figure": ["lining-nums", "oldstyle-nums"],
			"fvn-spacing": ["proportional-nums", "tabular-nums"],
			"fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
			tracking: [{ tracking: [
				i,
				q,
				K
			] }],
			"line-clamp": [{ "line-clamp": [
				G,
				"none",
				q,
				we
			] }],
			leading: [{ leading: [a, ...w()] }],
			"list-image": [{ "list-image": [
				"none",
				q,
				K
			] }],
			"list-style-position": [{ list: ["inside", "outside"] }],
			"list-style-type": [{ list: [
				"disc",
				"decimal",
				"none",
				q,
				K
			] }],
			"text-alignment": [{ text: [
				"left",
				"center",
				"right",
				"justify",
				"start",
				"end"
			] }],
			"placeholder-color": [{ placeholder: I() }],
			"text-color": [{ text: I() }],
			"text-decoration": [
				"underline",
				"overline",
				"line-through",
				"no-underline"
			],
			"text-decoration-style": [{ decoration: [...H(), "wavy"] }],
			"text-decoration-thickness": [{ decoration: [
				G,
				"from-font",
				"auto",
				q,
				Ce
			] }],
			"text-decoration-color": [{ decoration: I() }],
			"underline-offset": [{ "underline-offset": [
				G,
				"auto",
				q,
				K
			] }],
			"text-transform": [
				"uppercase",
				"lowercase",
				"capitalize",
				"normal-case"
			],
			"text-overflow": [
				"truncate",
				"text-ellipsis",
				"text-clip"
			],
			"text-wrap": [{ text: [
				"wrap",
				"nowrap",
				"balance",
				"pretty"
			] }],
			indent: [{ indent: w() }],
			"tab-size": [{ tab: [
				fe,
				q,
				K
			] }],
			"vertical-align": [{ align: [
				"baseline",
				"top",
				"middle",
				"bottom",
				"text-top",
				"text-bottom",
				"sub",
				"super",
				q,
				K
			] }],
			whitespace: [{ whitespace: [
				"normal",
				"nowrap",
				"pre",
				"pre-line",
				"pre-wrap",
				"break-spaces"
			] }],
			break: [{ break: [
				"normal",
				"words",
				"all",
				"keep"
			] }],
			wrap: [{ wrap: [
				"break-word",
				"anywhere",
				"normal"
			] }],
			hyphens: [{ hyphens: [
				"none",
				"manual",
				"auto"
			] }],
			content: [{ content: [
				"none",
				q,
				K
			] }],
			"bg-attachment": [{ bg: [
				"fixed",
				"local",
				"scroll"
			] }],
			"bg-clip": [{ "bg-clip": [
				"border",
				"padding",
				"content",
				"text"
			] }],
			"bg-origin": [{ "bg-origin": [
				"border",
				"padding",
				"content"
			] }],
			"bg-position": [{ bg: L() }],
			"bg-repeat": [{ bg: R() }],
			"bg-size": [{ bg: z() }],
			"bg-image": [{ bg: [
				"none",
				{
					linear: [
						{ to: [
							"t",
							"tr",
							"r",
							"br",
							"b",
							"bl",
							"l",
							"tl"
						] },
						fe,
						q,
						K
					],
					radial: [
						"",
						q,
						K
					],
					conic: [
						fe,
						q,
						K
					]
				},
				Pe,
				Oe
			] }],
			"bg-color": [{ bg: I() }],
			"gradient-from-pos": [{ from: ee() }],
			"gradient-via-pos": [{ via: ee() }],
			"gradient-to-pos": [{ to: ee() }],
			"gradient-from": [{ from: I() }],
			"gradient-via": [{ via: I() }],
			"gradient-to": [{ to: I() }],
			rounded: [{ rounded: B() }],
			"rounded-s": [{ "rounded-s": B() }],
			"rounded-e": [{ "rounded-e": B() }],
			"rounded-t": [{ "rounded-t": B() }],
			"rounded-r": [{ "rounded-r": B() }],
			"rounded-b": [{ "rounded-b": B() }],
			"rounded-l": [{ "rounded-l": B() }],
			"rounded-ss": [{ "rounded-ss": B() }],
			"rounded-se": [{ "rounded-se": B() }],
			"rounded-ee": [{ "rounded-ee": B() }],
			"rounded-es": [{ "rounded-es": B() }],
			"rounded-tl": [{ "rounded-tl": B() }],
			"rounded-tr": [{ "rounded-tr": B() }],
			"rounded-br": [{ "rounded-br": B() }],
			"rounded-bl": [{ "rounded-bl": B() }],
			"border-w": [{ border: V() }],
			"border-w-x": [{ "border-x": V() }],
			"border-w-y": [{ "border-y": V() }],
			"border-w-s": [{ "border-s": V() }],
			"border-w-e": [{ "border-e": V() }],
			"border-w-bs": [{ "border-bs": V() }],
			"border-w-be": [{ "border-be": V() }],
			"border-w-t": [{ "border-t": V() }],
			"border-w-r": [{ "border-r": V() }],
			"border-w-b": [{ "border-b": V() }],
			"border-w-l": [{ "border-l": V() }],
			"divide-x": [{ "divide-x": V() }],
			"divide-x-reverse": ["divide-x-reverse"],
			"divide-y": [{ "divide-y": V() }],
			"divide-y-reverse": ["divide-y-reverse"],
			"border-style": [{ border: [
				...H(),
				"hidden",
				"none"
			] }],
			"divide-style": [{ divide: [
				...H(),
				"hidden",
				"none"
			] }],
			"border-color": [{ border: I() }],
			"border-color-x": [{ "border-x": I() }],
			"border-color-y": [{ "border-y": I() }],
			"border-color-s": [{ "border-s": I() }],
			"border-color-e": [{ "border-e": I() }],
			"border-color-bs": [{ "border-bs": I() }],
			"border-color-be": [{ "border-be": I() }],
			"border-color-t": [{ "border-t": I() }],
			"border-color-r": [{ "border-r": I() }],
			"border-color-b": [{ "border-b": I() }],
			"border-color-l": [{ "border-l": I() }],
			"divide-color": [{ divide: I() }],
			"outline-style": [{ outline: [
				...H(),
				"none",
				"hidden"
			] }],
			"outline-offset": [{ "outline-offset": [
				G,
				q,
				K
			] }],
			"outline-w": [{ outline: [
				"",
				G,
				Ae,
				Ce
			] }],
			"outline-color": [{ outline: I() }],
			shadow: [{ shadow: [
				"",
				"none",
				u,
				Fe,
				ke
			] }],
			"shadow-color": [{ shadow: I() }],
			"inset-shadow": [{ "inset-shadow": [
				"none",
				d,
				Fe,
				ke
			] }],
			"inset-shadow-color": [{ "inset-shadow": I() }],
			"ring-w": [{ ring: V() }],
			"ring-w-inset": ["ring-inset"],
			"ring-color": [{ ring: I() }],
			"ring-offset-w": [{ "ring-offset": [G, Ce] }],
			"ring-offset-color": [{ "ring-offset": I() }],
			"inset-ring-w": [{ "inset-ring": V() }],
			"inset-ring-color": [{ "inset-ring": I() }],
			"text-shadow": [{ "text-shadow": [
				"none",
				f,
				Fe,
				ke
			] }],
			"text-shadow-color": [{ "text-shadow": I() }],
			opacity: [{ opacity: [
				G,
				q,
				K
			] }],
			"mix-blend": [{ "mix-blend": [
				...te(),
				"plus-darker",
				"plus-lighter"
			] }],
			"bg-blend": [{ "bg-blend": te() }],
			"mask-clip": [{ "mask-clip": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }, "mask-no-clip"],
			"mask-composite": [{ mask: [
				"add",
				"subtract",
				"intersect",
				"exclude"
			] }],
			"mask-image-linear-pos": [{ "mask-linear": [G] }],
			"mask-image-linear-from-pos": [{ "mask-linear-from": U() }],
			"mask-image-linear-to-pos": [{ "mask-linear-to": U() }],
			"mask-image-linear-from-color": [{ "mask-linear-from": I() }],
			"mask-image-linear-to-color": [{ "mask-linear-to": I() }],
			"mask-image-t-from-pos": [{ "mask-t-from": U() }],
			"mask-image-t-to-pos": [{ "mask-t-to": U() }],
			"mask-image-t-from-color": [{ "mask-t-from": I() }],
			"mask-image-t-to-color": [{ "mask-t-to": I() }],
			"mask-image-r-from-pos": [{ "mask-r-from": U() }],
			"mask-image-r-to-pos": [{ "mask-r-to": U() }],
			"mask-image-r-from-color": [{ "mask-r-from": I() }],
			"mask-image-r-to-color": [{ "mask-r-to": I() }],
			"mask-image-b-from-pos": [{ "mask-b-from": U() }],
			"mask-image-b-to-pos": [{ "mask-b-to": U() }],
			"mask-image-b-from-color": [{ "mask-b-from": I() }],
			"mask-image-b-to-color": [{ "mask-b-to": I() }],
			"mask-image-l-from-pos": [{ "mask-l-from": U() }],
			"mask-image-l-to-pos": [{ "mask-l-to": U() }],
			"mask-image-l-from-color": [{ "mask-l-from": I() }],
			"mask-image-l-to-color": [{ "mask-l-to": I() }],
			"mask-image-x-from-pos": [{ "mask-x-from": U() }],
			"mask-image-x-to-pos": [{ "mask-x-to": U() }],
			"mask-image-x-from-color": [{ "mask-x-from": I() }],
			"mask-image-x-to-color": [{ "mask-x-to": I() }],
			"mask-image-y-from-pos": [{ "mask-y-from": U() }],
			"mask-image-y-to-pos": [{ "mask-y-to": U() }],
			"mask-image-y-from-color": [{ "mask-y-from": I() }],
			"mask-image-y-to-color": [{ "mask-y-to": I() }],
			"mask-image-radial": [{ "mask-radial": [q, K] }],
			"mask-image-radial-from-pos": [{ "mask-radial-from": U() }],
			"mask-image-radial-to-pos": [{ "mask-radial-to": U() }],
			"mask-image-radial-from-color": [{ "mask-radial-from": I() }],
			"mask-image-radial-to-color": [{ "mask-radial-to": I() }],
			"mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
			"mask-image-radial-size": [{ "mask-radial": [{
				closest: ["side", "corner"],
				farthest: ["side", "corner"]
			}] }],
			"mask-image-radial-pos": [{ "mask-radial-at": b() }],
			"mask-image-conic-pos": [{ "mask-conic": [G] }],
			"mask-image-conic-from-pos": [{ "mask-conic-from": U() }],
			"mask-image-conic-to-pos": [{ "mask-conic-to": U() }],
			"mask-image-conic-from-color": [{ "mask-conic-from": I() }],
			"mask-image-conic-to-color": [{ "mask-conic-to": I() }],
			"mask-mode": [{ mask: [
				"alpha",
				"luminance",
				"match"
			] }],
			"mask-origin": [{ "mask-origin": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }],
			"mask-position": [{ mask: L() }],
			"mask-repeat": [{ mask: R() }],
			"mask-size": [{ mask: z() }],
			"mask-type": [{ "mask-type": ["alpha", "luminance"] }],
			"mask-image": [{ mask: [
				"none",
				q,
				K
			] }],
			filter: [{ filter: [
				"",
				"none",
				q,
				K
			] }],
			blur: [{ blur: ne() }],
			brightness: [{ brightness: [
				G,
				q,
				K
			] }],
			contrast: [{ contrast: [
				G,
				q,
				K
			] }],
			"drop-shadow": [{ "drop-shadow": [
				"",
				"none",
				p,
				Fe,
				ke
			] }],
			"drop-shadow-color": [{ "drop-shadow": I() }],
			grayscale: [{ grayscale: [
				"",
				G,
				q,
				K
			] }],
			"hue-rotate": [{ "hue-rotate": [
				G,
				q,
				K
			] }],
			invert: [{ invert: [
				"",
				G,
				q,
				K
			] }],
			saturate: [{ saturate: [
				G,
				q,
				K
			] }],
			sepia: [{ sepia: [
				"",
				G,
				q,
				K
			] }],
			"backdrop-filter": [{ "backdrop-filter": [
				"",
				"none",
				q,
				K
			] }],
			"backdrop-blur": [{ "backdrop-blur": ne() }],
			"backdrop-brightness": [{ "backdrop-brightness": [
				G,
				q,
				K
			] }],
			"backdrop-contrast": [{ "backdrop-contrast": [
				G,
				q,
				K
			] }],
			"backdrop-grayscale": [{ "backdrop-grayscale": [
				"",
				G,
				q,
				K
			] }],
			"backdrop-hue-rotate": [{ "backdrop-hue-rotate": [
				G,
				q,
				K
			] }],
			"backdrop-invert": [{ "backdrop-invert": [
				"",
				G,
				q,
				K
			] }],
			"backdrop-opacity": [{ "backdrop-opacity": [
				G,
				q,
				K
			] }],
			"backdrop-saturate": [{ "backdrop-saturate": [
				G,
				q,
				K
			] }],
			"backdrop-sepia": [{ "backdrop-sepia": [
				"",
				G,
				q,
				K
			] }],
			"border-collapse": [{ border: ["collapse", "separate"] }],
			"border-spacing": [{ "border-spacing": w() }],
			"border-spacing-x": [{ "border-spacing-x": w() }],
			"border-spacing-y": [{ "border-spacing-y": w() }],
			"table-layout": [{ table: ["auto", "fixed"] }],
			caption: [{ caption: ["top", "bottom"] }],
			transition: [{ transition: [
				"",
				"all",
				"colors",
				"opacity",
				"shadow",
				"transform",
				"none",
				q,
				K
			] }],
			"transition-behavior": [{ transition: ["normal", "discrete"] }],
			duration: [{ duration: [
				G,
				"initial",
				q,
				K
			] }],
			ease: [{ ease: [
				"linear",
				"initial",
				_,
				q,
				K
			] }],
			delay: [{ delay: [
				G,
				q,
				K
			] }],
			animate: [{ animate: [
				"none",
				v,
				q,
				K
			] }],
			backface: [{ backface: ["hidden", "visible"] }],
			perspective: [{ perspective: [
				h,
				q,
				K
			] }],
			"perspective-origin": [{ "perspective-origin": x() }],
			rotate: [{ rotate: re() }],
			"rotate-x": [{ "rotate-x": re() }],
			"rotate-y": [{ "rotate-y": re() }],
			"rotate-z": [{ "rotate-z": re() }],
			scale: [{ scale: ie() }],
			"scale-x": [{ "scale-x": ie() }],
			"scale-y": [{ "scale-y": ie() }],
			"scale-z": [{ "scale-z": ie() }],
			"scale-3d": ["scale-3d"],
			skew: [{ skew: ae() }],
			"skew-x": [{ "skew-x": ae() }],
			"skew-y": [{ "skew-y": ae() }],
			transform: [{ transform: [
				q,
				K,
				"",
				"none",
				"gpu",
				"cpu"
			] }],
			"transform-origin": [{ origin: x() }],
			"transform-style": [{ transform: ["3d", "flat"] }],
			translate: [{ translate: oe() }],
			"translate-x": [{ "translate-x": oe() }],
			"translate-y": [{ "translate-y": oe() }],
			"translate-z": [{ "translate-z": oe() }],
			"translate-none": ["translate-none"],
			zoom: [{ zoom: [
				fe,
				q,
				K
			] }],
			accent: [{ accent: I() }],
			appearance: [{ appearance: ["none", "auto"] }],
			"caret-color": [{ caret: I() }],
			"color-scheme": [{ scheme: [
				"normal",
				"dark",
				"light",
				"light-dark",
				"only-dark",
				"only-light"
			] }],
			cursor: [{ cursor: [
				"auto",
				"default",
				"pointer",
				"wait",
				"text",
				"move",
				"help",
				"not-allowed",
				"none",
				"context-menu",
				"progress",
				"cell",
				"crosshair",
				"vertical-text",
				"alias",
				"copy",
				"no-drop",
				"grab",
				"grabbing",
				"all-scroll",
				"col-resize",
				"row-resize",
				"n-resize",
				"e-resize",
				"s-resize",
				"w-resize",
				"ne-resize",
				"nw-resize",
				"se-resize",
				"sw-resize",
				"ew-resize",
				"ns-resize",
				"nesw-resize",
				"nwse-resize",
				"zoom-in",
				"zoom-out",
				q,
				K
			] }],
			"field-sizing": [{ "field-sizing": ["fixed", "content"] }],
			"pointer-events": [{ "pointer-events": ["auto", "none"] }],
			resize: [{ resize: [
				"none",
				"",
				"y",
				"x"
			] }],
			"scroll-behavior": [{ scroll: ["auto", "smooth"] }],
			"scrollbar-thumb-color": [{ "scrollbar-thumb": I() }],
			"scrollbar-track-color": [{ "scrollbar-track": I() }],
			"scrollbar-gutter": [{ "scrollbar-gutter": [
				"auto",
				"stable",
				"both"
			] }],
			"scrollbar-w": [{ scrollbar: [
				"auto",
				"thin",
				"none"
			] }],
			"scroll-m": [{ "scroll-m": w() }],
			"scroll-mx": [{ "scroll-mx": w() }],
			"scroll-my": [{ "scroll-my": w() }],
			"scroll-ms": [{ "scroll-ms": w() }],
			"scroll-me": [{ "scroll-me": w() }],
			"scroll-mbs": [{ "scroll-mbs": w() }],
			"scroll-mbe": [{ "scroll-mbe": w() }],
			"scroll-mt": [{ "scroll-mt": w() }],
			"scroll-mr": [{ "scroll-mr": w() }],
			"scroll-mb": [{ "scroll-mb": w() }],
			"scroll-ml": [{ "scroll-ml": w() }],
			"scroll-p": [{ "scroll-p": w() }],
			"scroll-px": [{ "scroll-px": w() }],
			"scroll-py": [{ "scroll-py": w() }],
			"scroll-ps": [{ "scroll-ps": w() }],
			"scroll-pe": [{ "scroll-pe": w() }],
			"scroll-pbs": [{ "scroll-pbs": w() }],
			"scroll-pbe": [{ "scroll-pbe": w() }],
			"scroll-pt": [{ "scroll-pt": w() }],
			"scroll-pr": [{ "scroll-pr": w() }],
			"scroll-pb": [{ "scroll-pb": w() }],
			"scroll-pl": [{ "scroll-pl": w() }],
			"snap-align": [{ snap: [
				"start",
				"end",
				"center",
				"align-none"
			] }],
			"snap-stop": [{ snap: ["normal", "always"] }],
			"snap-type": [{ snap: [
				"none",
				"x",
				"y",
				"both"
			] }],
			"snap-strictness": [{ snap: ["mandatory", "proximity"] }],
			touch: [{ touch: [
				"auto",
				"none",
				"manipulation"
			] }],
			"touch-x": [{ "touch-pan": [
				"x",
				"left",
				"right"
			] }],
			"touch-y": [{ "touch-pan": [
				"y",
				"up",
				"down"
			] }],
			"touch-pz": ["touch-pinch-zoom"],
			select: [{ select: [
				"none",
				"text",
				"all",
				"auto"
			] }],
			"will-change": [{ "will-change": [
				"auto",
				"scroll",
				"contents",
				"transform",
				q,
				K
			] }],
			fill: [{ fill: ["none", ...I()] }],
			"stroke-w": [{ stroke: [
				G,
				Ae,
				Ce,
				we
			] }],
			stroke: [{ stroke: ["none", ...I()] }],
			"forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }]
		},
		conflictingClassGroups: {
			"container-named": ["container-type"],
			overflow: ["overflow-x", "overflow-y"],
			overscroll: ["overscroll-x", "overscroll-y"],
			inset: [
				"inset-x",
				"inset-y",
				"inset-bs",
				"inset-be",
				"start",
				"end",
				"top",
				"right",
				"bottom",
				"left"
			],
			"inset-x": ["right", "left"],
			"inset-y": ["top", "bottom"],
			flex: [
				"basis",
				"grow",
				"shrink"
			],
			gap: ["gap-x", "gap-y"],
			p: [
				"px",
				"py",
				"ps",
				"pe",
				"pbs",
				"pbe",
				"pt",
				"pr",
				"pb",
				"pl"
			],
			px: ["pr", "pl"],
			py: ["pt", "pb"],
			m: [
				"mx",
				"my",
				"ms",
				"me",
				"mbs",
				"mbe",
				"mt",
				"mr",
				"mb",
				"ml"
			],
			mx: ["mr", "ml"],
			my: ["mt", "mb"],
			size: ["w", "h"],
			"font-size": ["leading"],
			"fvn-normal": [
				"fvn-ordinal",
				"fvn-slashed-zero",
				"fvn-figure",
				"fvn-spacing",
				"fvn-fraction"
			],
			"fvn-ordinal": ["fvn-normal"],
			"fvn-slashed-zero": ["fvn-normal"],
			"fvn-figure": ["fvn-normal"],
			"fvn-spacing": ["fvn-normal"],
			"fvn-fraction": ["fvn-normal"],
			"line-clamp": ["display", "overflow"],
			rounded: [
				"rounded-s",
				"rounded-e",
				"rounded-t",
				"rounded-r",
				"rounded-b",
				"rounded-l",
				"rounded-ss",
				"rounded-se",
				"rounded-ee",
				"rounded-es",
				"rounded-tl",
				"rounded-tr",
				"rounded-br",
				"rounded-bl"
			],
			"rounded-s": ["rounded-ss", "rounded-es"],
			"rounded-e": ["rounded-se", "rounded-ee"],
			"rounded-t": ["rounded-tl", "rounded-tr"],
			"rounded-r": ["rounded-tr", "rounded-br"],
			"rounded-b": ["rounded-br", "rounded-bl"],
			"rounded-l": ["rounded-tl", "rounded-bl"],
			"border-spacing": ["border-spacing-x", "border-spacing-y"],
			"border-w": [
				"border-w-x",
				"border-w-y",
				"border-w-s",
				"border-w-e",
				"border-w-bs",
				"border-w-be",
				"border-w-t",
				"border-w-r",
				"border-w-b",
				"border-w-l"
			],
			"border-w-x": ["border-w-r", "border-w-l"],
			"border-w-y": ["border-w-t", "border-w-b"],
			"border-color": [
				"border-color-x",
				"border-color-y",
				"border-color-s",
				"border-color-e",
				"border-color-bs",
				"border-color-be",
				"border-color-t",
				"border-color-r",
				"border-color-b",
				"border-color-l"
			],
			"border-color-x": ["border-color-r", "border-color-l"],
			"border-color-y": ["border-color-t", "border-color-b"],
			translate: [
				"translate-x",
				"translate-y",
				"translate-none"
			],
			"translate-none": [
				"translate",
				"translate-x",
				"translate-y",
				"translate-z"
			],
			"scroll-m": [
				"scroll-mx",
				"scroll-my",
				"scroll-ms",
				"scroll-me",
				"scroll-mbs",
				"scroll-mbe",
				"scroll-mt",
				"scroll-mr",
				"scroll-mb",
				"scroll-ml"
			],
			"scroll-mx": ["scroll-mr", "scroll-ml"],
			"scroll-my": ["scroll-mt", "scroll-mb"],
			"scroll-p": [
				"scroll-px",
				"scroll-py",
				"scroll-ps",
				"scroll-pe",
				"scroll-pbs",
				"scroll-pbe",
				"scroll-pt",
				"scroll-pr",
				"scroll-pb",
				"scroll-pl"
			],
			"scroll-px": ["scroll-pr", "scroll-pl"],
			"scroll-py": ["scroll-pt", "scroll-pb"],
			touch: [
				"touch-x",
				"touch-y",
				"touch-pz"
			],
			"touch-x": ["touch"],
			"touch-y": ["touch"],
			"touch-pz": ["touch"]
		},
		conflictingClassGroupModifiers: { "font-size": ["leading"] },
		postfixLookupClassGroups: ["container-type"],
		orderSensitiveModifiers: [
			"*",
			"**",
			"after",
			"backdrop",
			"before",
			"details-content",
			"file",
			"first-letter",
			"first-line",
			"marker",
			"placeholder",
			"selection"
		]
	};
});
//#endregion
//#region src/lib/utils.ts
function J(...e) {
	return qe(p(e));
}
//#endregion
//#region ../../node_modules/.pnpm/class-variance-authority@0.7.1/node_modules/class-variance-authority/dist/index.mjs
var Je = (e) => typeof e == "boolean" ? `${e}` : e === 0 ? "0" : e, Ye = p, Xe = (e, t) => (n) => {
	if (t?.variants == null) return Ye(e, n?.class, n?.className);
	let { variants: r, defaultVariants: i } = t, a = Object.keys(r).map((e) => {
		let t = n?.[e], a = i?.[e];
		if (t === null) return null;
		let o = Je(t) || Je(a);
		return r[e][o];
	}), o = n && Object.entries(n).reduce((e, t) => {
		let [n, r] = t;
		return r === void 0 || (e[n] = r), e;
	}, {});
	return Ye(e, a, t?.compoundVariants?.reduce((e, t) => {
		let { class: n, className: r, ...a } = t;
		return Object.entries(a).every((e) => {
			let [t, n] = e;
			return Array.isArray(n) ? n.includes({
				...i,
				...o
			}[t]) : {
				...i,
				...o
			}[t] === n;
		}) ? [
			...e,
			n,
			r
		] : e;
	}, []), n?.class, n?.className);
}, Ze = /* @__PURE__ */ u(((e) => {
	e.Fragment = Symbol.for("react.fragment"), e.jsxDEV = void 0;
})), Qe = /* @__PURE__ */ u(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e) {
			if (e == null) return null;
			if (typeof e == "function") return e.$$typeof === k ? null : e.displayName || e.name || null;
			if (typeof e == "string") return e;
			switch (e) {
				case v: return "Fragment";
				case b: return "Profiler";
				case y: return "StrictMode";
				case w: return "Suspense";
				case T: return "SuspenseList";
				case O: return "Activity";
			}
			if (typeof e == "object") switch (typeof e.tag == "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), e.$$typeof) {
				case _: return "Portal";
				case S: return e.displayName || "Context";
				case x: return (e._context.displayName || "Context") + ".Consumer";
				case C:
					var n = e.render;
					return e = e.displayName, e ||= (e = n.displayName || n.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
				case E: return n = e.displayName || null, n === null ? t(e.type) || "Memo" : n;
				case D:
					n = e._payload, e = e._init;
					try {
						return t(e(n));
					} catch {}
			}
			return null;
		}
		function n(e) {
			return "" + e;
		}
		function r(e) {
			try {
				n(e);
				var t = !1;
			} catch {
				t = !0;
			}
			if (t) {
				t = console;
				var r = t.error, i = typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
				return r.call(t, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", i), n(e);
			}
		}
		function i(e) {
			if (e === v) return "<>";
			if (typeof e == "object" && e && e.$$typeof === D) return "<...>";
			try {
				var n = t(e);
				return n ? "<" + n + ">" : "<...>";
			} catch {
				return "<...>";
			}
		}
		function a() {
			var e = A.A;
			return e === null ? null : e.getOwner();
		}
		function o() {
			return Error("react-stack-top-frame");
		}
		function s(e) {
			if (j.call(e, "key")) {
				var t = Object.getOwnPropertyDescriptor(e, "key").get;
				if (t && t.isReactWarning) return !1;
			}
			return e.key !== void 0;
		}
		function c(e, t) {
			function n() {
				P || (P = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", t));
			}
			n.isReactWarning = !0, Object.defineProperty(e, "key", {
				get: n,
				configurable: !0
			});
		}
		function l() {
			var e = t(this.type);
			return F[e] || (F[e] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.")), e = this.props.ref, e === void 0 ? null : e;
		}
		function u(e, t, n, r, i, a) {
			var o = n.ref;
			return e = {
				$$typeof: g,
				type: e,
				key: t,
				props: n,
				_owner: r
			}, (o === void 0 ? null : o) === null ? Object.defineProperty(e, "ref", {
				enumerable: !1,
				value: null
			}) : Object.defineProperty(e, "ref", {
				enumerable: !1,
				get: l
			}), e._store = {}, Object.defineProperty(e._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			}), Object.defineProperty(e, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			}), Object.defineProperty(e, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: i
			}), Object.defineProperty(e, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: a
			}), Object.freeze && (Object.freeze(e.props), Object.freeze(e)), e;
		}
		function f(e, n, i, o, l, d) {
			var f = n.children;
			if (f !== void 0) if (o) if (M(f)) {
				for (o = 0; o < f.length; o++) p(f[o]);
				Object.freeze && Object.freeze(f);
			} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
			else p(f);
			if (j.call(n, "key")) {
				f = t(e);
				var m = Object.keys(n).filter(function(e) {
					return e !== "key";
				});
				o = 0 < m.length ? "{key: someKey, " + m.join(": ..., ") + ": ...}" : "{key: someKey}", R[f + o] || (m = 0 < m.length ? "{" + m.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", o, f, m, f), R[f + o] = !0);
			}
			if (f = null, i !== void 0 && (r(i), f = "" + i), s(n) && (r(n.key), f = "" + n.key), "key" in n) for (var h in i = {}, n) h !== "key" && (i[h] = n[h]);
			else i = n;
			return f && c(i, typeof e == "function" ? e.displayName || e.name || "Unknown" : e), u(e, f, i, a(), l, d);
		}
		function p(e) {
			m(e) ? e._store && (e._store.validated = 1) : typeof e == "object" && e && e.$$typeof === D && (e._payload.status === "fulfilled" ? m(e._payload.value) && e._payload.value._store && (e._payload.value._store.validated = 1) : e._store && (e._store.validated = 1));
		}
		function m(e) {
			return typeof e == "object" && !!e && e.$$typeof === g;
		}
		var h = d("react"), g = Symbol.for("react.transitional.element"), _ = Symbol.for("react.portal"), v = Symbol.for("react.fragment"), y = Symbol.for("react.strict_mode"), b = Symbol.for("react.profiler"), x = Symbol.for("react.consumer"), S = Symbol.for("react.context"), C = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), T = Symbol.for("react.suspense_list"), E = Symbol.for("react.memo"), D = Symbol.for("react.lazy"), O = Symbol.for("react.activity"), k = Symbol.for("react.client.reference"), A = h.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, j = Object.prototype.hasOwnProperty, M = Array.isArray, N = console.createTask ? console.createTask : function() {
			return null;
		};
		h = { react_stack_bottom_frame: function(e) {
			return e();
		} };
		var P, F = {}, I = h.react_stack_bottom_frame.bind(h, o)(), L = N(i(o)), R = {};
		e.Fragment = v, e.jsxDEV = function(e, t, n, r) {
			var a = 1e4 > A.recentlyCreatedOwnerStacks++;
			return f(e, t, n, r, a ? Error("react-stack-top-frame") : I, a ? N(i(e)) : L);
		};
	})();
})), Y = (/* @__PURE__ */ u(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? Ze() : Qe();
})))(), $e = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/alert.tsx", et = Xe("group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4", {
	variants: { variant: {
		default: "bg-card text-card-foreground",
		destructive: "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current"
	} },
	defaultVariants: { variant: "default" }
});
function tt({ className: e, variant: t, ...n }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "alert",
		role: "alert",
		className: J(et({ variant: t }), e),
		...n
	}, void 0, !1, {
		fileName: $e,
		lineNumber: 28,
		columnNumber: 5
	}, this);
}
function nt({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "alert-title",
		className: J("font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground", e),
		...t
	}, void 0, !1, {
		fileName: $e,
		lineNumber: 39,
		columnNumber: 5
	}, this);
}
function rt({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "alert-description",
		className: J("text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4", e),
		...t
	}, void 0, !1, {
		fileName: $e,
		lineNumber: 55,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/mergeObjects.mjs
function it(e, t) {
	if (e && !t) return e;
	if (!e && t) return t;
	if (e || t) return {
		...e,
		...t
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/merge-props/mergeProps.mjs
var at = {};
function ot(e, t, n, r, i) {
	if (!n && !r && !i && !e) return ct(t);
	let a = ct(e);
	return t && (a = lt(a, t)), n && (a = lt(a, n)), r && (a = lt(a, r)), i && (a = lt(a, i)), a;
}
function st(e) {
	if (e.length === 0) return at;
	if (e.length === 1) return ct(e[0]);
	let t = ct(e[0]);
	for (let n = 1; n < e.length; n += 1) t = lt(t, e[n]);
	return t;
}
function ct(e) {
	return pt(e) ? { ...mt(e, at) } : ut(e);
}
function lt(e, t) {
	return pt(t) ? mt(t, e) : dt(e, t);
}
function ut(e) {
	let t = { ...e };
	for (let e in t) {
		let n = t[e];
		ft(e, n) && (t[e] = gt(n));
	}
	return t;
}
function dt(e, t) {
	if (!t) return e;
	for (let n in t) {
		let r = t[n];
		switch (n) {
			case "style":
				e[n] = it(e.style, r);
				break;
			case "className":
				e[n] = vt(e.className, r);
				break;
			default: e[n] = ft(n, r) ? ht(e[n], r) : r;
		}
	}
	return e;
}
function ft(e, t) {
	let n = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2);
	return n === 111 && r === 110 && i >= 65 && i <= 90 && (typeof t == "function" || t === void 0);
}
function pt(e) {
	return typeof e == "function";
}
function mt(e, t) {
	return pt(e) ? e(t) : e ?? at;
}
function ht(e, t) {
	return t ? e ? (...n) => {
		let r = n[0];
		if (yt(r)) {
			let i = r;
			_t(i);
			let a = t(...n);
			return i.baseUIHandlerPrevented || e?.(...n), a;
		}
		let i = t(...n);
		return e?.(...n), i;
	} : gt(t) : e;
}
function gt(e) {
	return e && ((...t) => {
		let n = t[0];
		return yt(n) && _t(n), e(...t);
	});
}
function _t(e) {
	return e.preventBaseUIHandler = () => {
		e.baseUIHandlerPrevented = !0;
	}, e;
}
function vt(e, t) {
	return t ? e ? t + " " + e : t : e;
}
function yt(e) {
	return typeof e == "object" && !!e && "nativeEvent" in e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/formatErrorMessage.mjs
function bt(e, t) {
	return function(n, ...r) {
		let i = new URL(e);
		return i.searchParams.set("code", n.toString()), r.forEach((e) => i.searchParams.append("args[]", e)), `${t} error #${n}; visit ${i} for the full message.`;
	};
}
var xt = bt("https://base-ui.com/production-error", "Base UI"), St = {};
function Ct(t, n) {
	let r = e.useRef(St);
	return r.current === St && (r.current = t(n)), r;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useMergedRefs.mjs
function wt(e, t, n, r) {
	let i = Ct(Et).current;
	return Dt(i, e, t, n, r) && kt(i, [
		e,
		t,
		n,
		r
	]), i.callback;
}
function Tt(e) {
	let t = Ct(Et).current;
	return Ot(t, e) && kt(t, e), t.callback;
}
function Et() {
	return {
		callback: null,
		cleanup: null,
		refs: []
	};
}
function Dt(e, t, n, r, i) {
	return e.refs[0] !== t || e.refs[1] !== n || e.refs[2] !== r || e.refs[3] !== i;
}
function Ot(e, t) {
	return e.refs.length !== t.length || e.refs.some((e, n) => e !== t[n]);
}
function kt(e, t) {
	if (e.refs = t, t.every((e) => e == null)) {
		e.callback = null;
		return;
	}
	e.callback = (n) => {
		if (e.cleanup &&= (e.cleanup(), null), n != null) {
			let r = Array(t.length).fill(null);
			for (let e = 0; e < t.length; e += 1) {
				let i = t[e];
				if (i != null) switch (typeof i) {
					case "function": {
						let t = i(n);
						typeof t == "function" && (r[e] = t);
						break;
					}
					case "object": i.current = n;
				}
			}
			e.cleanup = () => {
				for (let e = 0; e < t.length; e += 1) {
					let n = t[e];
					if (n != null) switch (typeof n) {
						case "function": {
							let t = r[e];
							typeof t == "function" ? t() : n(null);
							break;
						}
						case "object": n.current = null;
					}
				}
			};
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/reactVersion.mjs
var At = parseInt(e.version, 10);
function jt(e) {
	return At >= e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/getReactElementRef.mjs
function Mt(t) {
	if (!/*#__PURE__*/ e.isValidElement(t)) return null;
	let n = t, r = n.props;
	return (jt(19) ? r?.ref : n.ref) ?? null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/warn.mjs
var Nt;
process.env.NODE_ENV !== "production" && (Nt = /* @__PURE__ */ new Set());
function Pt(...e) {
	if (process.env.NODE_ENV !== "production") {
		let t = e.join(" ");
		Nt.has(t) || (Nt.add(t), console.warn(`Base UI: ${t}`));
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/empty.mjs
function Ft() {}
var It = Object.freeze([]), Lt = Object.freeze({});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/getStateAttributesProps.mjs
function Rt(e, t) {
	let n = {};
	for (let r in e) {
		let i = e[r];
		if (t?.hasOwnProperty(r)) {
			let e = t[r](i);
			e != null && Object.assign(n, e);
			continue;
		}
		i === !0 ? n[`data-${r.toLowerCase()}`] = "" : i && (n[`data-${r.toLowerCase()}`] = i.toString());
	}
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/resolveClassName.mjs
function zt(e, t) {
	return typeof e == "function" ? e(t) : e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/resolveStyle.mjs
function Bt(e, t) {
	return typeof e == "function" ? e(t) : e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useRenderElement.mjs
function Vt(e, t, n = {}) {
	let r = t.render, i = Ht(t, n);
	return n.enabled === !1 ? null : qt(e, r, i, n.state ?? Lt);
}
function Ht(e, t = {}) {
	let { className: n, style: r, render: i } = e, { state: a = Lt, ref: o, props: s, stateAttributesMapping: c, enabled: l = !0 } = t, u = l ? zt(n, a) : void 0, d = l ? Bt(r, a) : void 0, f = l ? Rt(a, c) : Lt, p = l && s ? Ut(s) : void 0, m = l ? it(f, p) ?? {} : Lt;
	return typeof document < "u" && (l ? m.ref = Array.isArray(o) ? Tt([
		m.ref,
		Mt(i),
		...o
	]) : wt(m.ref, Mt(i), o) : wt(null, null)), l ? (u !== void 0 && (m.className = vt(m.className, u)), d !== void 0 && (m.style = it(m.style, d)), m) : Lt;
}
function Ut(e) {
	return Array.isArray(e) ? st(e) : ot(void 0, e);
}
var Wt = Symbol.for("react.lazy"), Gt = /^[A-Z][A-Za-z0-9$]*$/, Kt = /[a-z]/;
function qt(t, n, r, i) {
	if (n) {
		if (typeof n == "function") return process.env.NODE_ENV !== "production" && Jt(n), n(r, i);
		let t = ot(r, n.props);
		t.ref = r.ref;
		let a = n;
		if (a?.$$typeof === Wt && (a = e.Children.toArray(n)[0]), process.env.NODE_ENV !== "production" && !/*#__PURE__*/ e.isValidElement(a)) throw Error([
			"Base UI: The `render` prop was provided an invalid React element as `React.isValidElement(render)` is `false`.",
			"A valid React element must be provided to the `render` prop because it is cloned with props to replace the default element.",
			"https://base-ui.com/r/invalid-render-prop"
		].join("\n"));
		return /*#__PURE__*/ e.cloneElement(a, t);
	}
	if (t && typeof t == "string") return Yt(t, r);
	throw Error(process.env.NODE_ENV === "production" ? xt(8) : "Base UI: Render element or function are not defined.");
}
function Jt(e) {
	let t = e.name;
	t.length !== 0 && Gt.test(t) && Kt.test(t) && Pt(`The \`render\` prop received a function named \`${t}\` that starts with an uppercase letter.`, "This usually means a React component was passed directly as `render={Component}`.", "Base UI calls `render` as a plain function, which can break the Rules of Hooks during reconciliation.", "If this is an intentional render callback, rename it to start with a lowercase letter.", "Use `render={<Component />}` or `render={(props) => <Component {...props} />}` instead.", "https://base-ui.com/r/invalid-render-prop");
}
function Yt(t, n) {
	return t === "button" ? /*#__PURE__*/ r("button", {
		type: "button",
		...n,
		key: n.key
	}) : t === "img" ? /*#__PURE__*/ r("img", {
		alt: "",
		...n,
		key: n.key
	}) : /*#__PURE__*/ e.createElement(t, n);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/use-render/useRender.mjs
function Xt(e) {
	return Vt(e.defaultTagName ?? "div", e, e);
}
//#endregion
//#region src/components/ui/badge.tsx
var Zt = Xe("group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!", {
	variants: { variant: {
		default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
		secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
		destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
		outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
		ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
		link: "text-primary underline-offset-4 hover:underline"
	} },
	defaultVariants: { variant: "default" }
});
function Qt({ className: e, variant: t = "default", render: n, ...r }) {
	return Xt({
		defaultTagName: "span",
		props: ot({ className: J(Zt({ variant: t }), e) }, r),
		render: n,
		state: {
			slot: "badge",
			variant: t
		}
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function $t() {
	return typeof window < "u";
}
function en(e) {
	return rn(e) ? (e.nodeName || "").toLowerCase() : "#document";
}
function tn(e) {
	var t;
	return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window;
}
function nn(e) {
	return ((rn(e) ? e.ownerDocument : e.document) || window.document)?.documentElement;
}
function rn(e) {
	return $t() ? e instanceof Node || e instanceof tn(e).Node : !1;
}
function an(e) {
	return $t() ? e instanceof Element || e instanceof tn(e).Element : !1;
}
function on(e) {
	return $t() ? e instanceof HTMLElement || e instanceof tn(e).HTMLElement : !1;
}
function sn(e) {
	return !$t() || typeof ShadowRoot > "u" ? !1 : e instanceof ShadowRoot || e instanceof tn(e).ShadowRoot;
}
function cn(e) {
	let { overflow: t, overflowX: n, overflowY: r, display: i } = yn(e);
	return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && i !== "inline" && i !== "contents";
}
function ln(e) {
	return /^(table|td|th)$/.test(en(e));
}
function un(e) {
	try {
		if (e.matches(":popover-open")) return !0;
	} catch {}
	try {
		return e.matches(":modal");
	} catch {
		return !1;
	}
}
var dn = /transform|translate|scale|rotate|perspective|filter/, fn = /paint|layout|strict|content/, pn = (e) => !!e && e !== "none", mn;
function hn(e) {
	let t = an(e) ? yn(e) : e;
	return pn(t.transform) || pn(t.translate) || pn(t.scale) || pn(t.rotate) || pn(t.perspective) || !_n() && (pn(t.backdropFilter) || pn(t.filter)) || dn.test(t.willChange || "") || fn.test(t.contain || "");
}
function gn(e) {
	let t = xn(e);
	for (; on(t) && !vn(t);) {
		if (hn(t)) return t;
		if (un(t)) return null;
		t = xn(t);
	}
	return null;
}
function _n() {
	return mn ??= typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none"), mn;
}
function vn(e) {
	return /^(html|body|#document)$/.test(en(e));
}
function yn(e) {
	return tn(e).getComputedStyle(e);
}
function bn(e) {
	return an(e) ? {
		scrollLeft: e.scrollLeft,
		scrollTop: e.scrollTop
	} : {
		scrollLeft: e.scrollX,
		scrollTop: e.scrollY
	};
}
function xn(e) {
	if (en(e) === "html") return e;
	let t = e.assignedSlot || e.parentNode || sn(e) && e.host || nn(e);
	return sn(t) ? t.host : t;
}
function Sn(e) {
	let t = xn(e);
	return vn(t) ? (e.ownerDocument || e).body : on(t) && cn(t) ? t : Sn(t);
}
function Cn(e, t, n) {
	t === void 0 && (t = []), n === void 0 && (n = !0);
	let r = Sn(e), i = r === e.ownerDocument?.body, a = tn(r);
	if (i) {
		let e = wn(a);
		return t.concat(a, a.visualViewport || [], cn(r) ? r : [], e && n ? Cn(e) : []);
	}
	return t.concat(r, Cn(r, [], n));
}
function wn(e) {
	return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/safeReact.mjs
var Tn = { ...e }, En = Tn.useInsertionEffect, Dn = En && En !== Tn.useLayoutEffect ? En : (e) => e();
function X(e) {
	let t = Ct(On).current;
	return t.next = e, Dn(t.effect), t.trampoline;
}
function On() {
	let e = {
		next: void 0,
		callback: kn,
		trampoline: (...t) => e.callback?.(...t),
		effect: () => {
			e.callback = e.next;
		}
	};
	return e;
}
function kn() {
	if (process.env.NODE_ENV !== "production") throw Error("Base UI: Cannot call an event handler while rendering.");
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/error.mjs
var An;
process.env.NODE_ENV !== "production" && (An = /* @__PURE__ */ new Set());
function jn(...e) {
	if (process.env.NODE_ENV !== "production") {
		let t = e.join(" ");
		An.has(t) || (An.add(t), console.error(`Base UI: ${t}`));
	}
}
var Z = typeof document < "u" ? e.useLayoutEffect : () => {}, Mn = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Mn.displayName = "CompositeRootContext");
function Nn(t = !1) {
	let n = e.useContext(Mn);
	if (n === void 0 && !t) throw Error(process.env.NODE_ENV === "production" ? xt(16) : "Base UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs
function Pn(t) {
	let { focusableWhenDisabled: n, disabled: r, composite: i = !1, tabIndex: a = 0, isNativeButton: o } = t, s = i && n !== !1, c = i && n === !1;
	return { props: e.useMemo(() => {
		let e = { onKeyDown(e) {
			r && n && e.key !== "Tab" && e.preventDefault();
		} };
		return i || (e.tabIndex = a, !o && r && (e.tabIndex = n ? a : -1)), (o && (n || s) || !o && r) && (e["aria-disabled"] = r), o && (!n || c) && (e.disabled = r), e;
	}, [
		i,
		r,
		n,
		s,
		c,
		o,
		a
	]) };
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/owner.mjs
function Fn(e) {
	return e?.ownerDocument || document;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/dispatchClickWithModifiers.mjs
function In(e, t, { detail: n = 0 } = {}) {
	e.dispatchEvent(new (tn(e)).PointerEvent("click", {
		bubbles: !0,
		cancelable: !0,
		composed: !0,
		detail: n,
		shiftKey: t.shiftKey,
		ctrlKey: t.ctrlKey,
		altKey: t.altKey,
		metaKey: t.metaKey
	}));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/use-button/useButton.mjs
function Ln(t = {}) {
	let { disabled: n = !1, focusableWhenDisabled: r, tabIndex: i = 0, native: a = !0, composite: o } = t, s = e.useRef(null), c = Nn(!0), l = o ?? c !== void 0, { props: u } = Pn({
		focusableWhenDisabled: r,
		disabled: n,
		composite: l,
		tabIndex: i,
		isNativeButton: a
	});
	process.env.NODE_ENV !== "production" && e.useEffect(() => {
		if (!s.current) return;
		let e = Rn(s.current);
		a ? e || jn(`A component that acts as a button expected a native <button> because the \`nativeButton\` prop is true. Rendering a non-<button> removes native button semantics, which can impact forms and accessibility. Use a real <button> in the \`render\` prop, or set \`nativeButton\` to \`false\`.${Tn.captureOwnerStack?.() || ""}`) : e && jn(`A component that acts as a button expected a non-<button> because the \`nativeButton\` prop is false. Rendering a <button> keeps native behavior while Base UI applies non-native attributes and handlers, which can add unintended extra attributes (such as \`role\` or \`aria-disabled\`). Use a non-<button> in the \`render\` prop, or set \`nativeButton\` to \`true\`.${Tn.captureOwnerStack?.() || ""}`);
	}, [a]);
	let d = e.useCallback(() => {
		let e = s.current;
		Rn(e) && l && n && u.disabled === void 0 && e.disabled && (e.disabled = !1);
	}, [
		n,
		u.disabled,
		l
	]);
	return Z(d, [d]), {
		getButtonProps: e.useCallback((e = {}) => {
			let { onClick: t, onMouseDown: r, onKeyUp: i, onKeyDown: o, onPointerDown: s, ...c } = e;
			return ot({
				onClick(e) {
					if (n) {
						e.preventDefault();
						return;
					}
					t?.(e);
				},
				onMouseDown(e) {
					n || r?.(e);
				},
				onKeyDown(e) {
					if (n || (_t(e), o?.(e), e.baseUIHandlerPrevented)) return;
					let t = e.target === e.currentTarget, r = e.currentTarget, i = Rn(r), s = !a && zn(r), c = t && (a ? i : !s), u = e.key === "Enter", d = e.key === " ", f = r.getAttribute("role"), p = f?.startsWith("menuitem") || f === "option" || f === "gridcell";
					if (t && l && d) {
						if (e.defaultPrevented && p) return;
						e.preventDefault(), (!a || i) && (e.preventBaseUIHandler(), In(r, e));
						return;
					}
					if (!c || a || !d && !u) {
						t && s && d && e.preventDefault();
						return;
					}
					e.defaultPrevented || (e.preventDefault(), u && (e.preventBaseUIHandler(), In(r, e)));
				},
				onKeyUp(e) {
					if (!n) {
						if (_t(e), i?.(e), e.target === e.currentTarget && a && l && Rn(e.currentTarget) && e.key === " ") {
							e.preventDefault();
							return;
						}
						e.baseUIHandlerPrevented || e.target === e.currentTarget && !a && !l && !e.defaultPrevented && e.key === " " && (e.preventBaseUIHandler(), In(e.currentTarget, e));
					}
				},
				onPointerDown(e) {
					if (n) {
						e.preventDefault();
						return;
					}
					s?.(e);
				}
			}, a ? { type: "button" } : { role: "button" }, u, c);
		}, [
			n,
			u,
			l,
			a
		]),
		buttonRef: X((e) => {
			s.current = e, d();
		})
	};
}
function Rn(e) {
	return on(e) && e.tagName === "BUTTON";
}
function zn(e) {
	return on(e) && e.tagName === "A" && !!e.href;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/button/Button.mjs
var Bn = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, disabled: i = !1, focusableWhenDisabled: a = !1, nativeButton: o = !0, style: s, ...c } = e, { getButtonProps: l, buttonRef: u } = Ln({
		disabled: i,
		focusableWhenDisabled: a,
		native: o
	});
	return Vt("button", e, {
		state: { disabled: i },
		ref: [t, u],
		props: [c, l]
	});
});
process.env.NODE_ENV !== "production" && (Bn.displayName = "Button");
//#endregion
//#region src/components/ui/button.tsx
var Vn = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/button.tsx", Hn = Xe("group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/80",
			outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
			secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
			ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
			destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
			success: "bg-emerald-600 text-white hover:bg-emerald-500",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
			sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
			lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			icon: "size-8",
			"icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
			"icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
			"icon-lg": "size-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Un({ className: e, variant: t = "default", size: n = "default", ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Bn, {
		"data-slot": "button",
		className: J(Hn({
			variant: t,
			size: n,
			className: e
		})),
		...r
	}, void 0, !1, {
		fileName: Vn,
		lineNumber: 52,
		columnNumber: 5
	}, this);
}
//#endregion
//#region src/components/ui/card.tsx
var Wn = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/card.tsx";
function Gn({ className: e, size: t = "default", ...n }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card",
		"data-size": t,
		className: J("group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl", e),
		...n
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 11,
		columnNumber: 5
	}, this);
}
function Kn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-header",
		className: J("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 25,
		columnNumber: 5
	}, this);
}
function qn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-title",
		className: J("font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 38,
		columnNumber: 5
	}, this);
}
function Jn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-description",
		className: J("text-sm text-muted-foreground", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 51,
		columnNumber: 5
	}, this);
}
function Yn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-action",
		className: J("col-start-2 row-span-2 row-start-1 self-start justify-self-end", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 61,
		columnNumber: 5
	}, this);
}
function Xn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-content",
		className: J("px-(--card-spacing)", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 74,
		columnNumber: 5
	}, this);
}
function Zn({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "card-footer",
		className: J("flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)", e),
		...t
	}, void 0, !1, {
		fileName: Wn,
		lineNumber: 84,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useControlled.mjs
function Qn({ controlled: t, default: n, name: r, state: i = "value" }) {
	let { current: a } = e.useRef(t !== void 0), [o, s] = e.useState(n), c = a ? t : o;
	if (process.env.NODE_ENV !== "production") {
		e.useEffect(() => {
			a !== (t !== void 0) && jn([
				`A component is changing the ${a ? "" : "un"}controlled ${i} state of ${r} to be ${a ? "un" : ""}controlled.`,
				"Elements should not switch from uncontrolled to controlled (or vice versa).",
				`Decide between using a controlled or uncontrolled ${r} element for the lifetime of the component.`,
				"The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
				"More info: https://fb.me/react-controlled-components"
			].join("\n"));
		}, [
			i,
			r,
			t
		]);
		let { current: o } = e.useRef(n);
		e.useEffect(() => {
			!a && $n(o) !== $n(n) && jn([`A component is changing the default ${i} state of an uncontrolled ${r} after being initialized. To suppress this warning opt to use a controlled ${r}.`].join("\n"));
		}, [n]);
	}
	return [c, e.useCallback((e) => {
		a || s(e);
	}, [])];
}
function $n(e) {
	let t = 0, n = /* @__PURE__ */ new WeakMap();
	try {
		return JSON.stringify(e, function(e, r) {
			if (!(e === "_owner" && this != null && typeof this == "object" && "$$typeof" in this)) {
				if (typeof r == "bigint") return `__bigint__:${r}`;
				if (typeof r == "object" && r) {
					let e = n.get(r);
					if (e !== void 0) return `__object__:${e}`;
					n.set(r, t), t += 1;
				}
				return r;
			}
		}) ?? `__top__:${typeof e}`;
	} catch {
		return "__unserializable__";
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/visuallyHidden.mjs
var er = {
	clipPath: "inset(50%)",
	overflow: "hidden",
	whiteSpace: "nowrap",
	border: 0,
	padding: 0,
	width: 1,
	height: 1,
	margin: -1
}, tr = {
	...er,
	position: "fixed",
	top: 0,
	left: 0
}, nr = {
	...er,
	position: "absolute"
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/getDefaultFormSubmitter.mjs
function rr(e) {
	if (!e) return null;
	for (let t of e.elements) {
		let e = t.tagName;
		if (e === "BUTTON" || e === "INPUT") {
			let e = t;
			if (e.type === "submit") return e;
		}
	}
	return null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/field-constants/constants.mjs
var ir = {
	badInput: !1,
	customError: !1,
	patternMismatch: !1,
	rangeOverflow: !1,
	rangeUnderflow: !1,
	stepMismatch: !1,
	tooLong: !1,
	tooShort: !1,
	typeMismatch: !1,
	valid: null,
	valueMissing: !1
}, ar = {
	disabled: !1,
	valid: null,
	touched: !1,
	dirty: !1,
	filled: !1,
	focused: !1
}, or = { valid(e) {
	return e === null ? null : e ? { "data-valid": "" } : { "data-invalid": "" };
} };
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/checkbox/utils/getCheckboxStateAttributesMapping.mjs
function sr(e) {
	return {
		checked(t) {
			return e.indeterminate ? {} : t ? { "data-checked": "" } : { "data-unchecked": "" };
		},
		...or
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useId.mjs
var cr = 0;
function lr(t, n = "mui") {
	let [r, i] = e.useState(t), a = t || r;
	return e.useEffect(() => {
		r ?? (cr += 1, i(`${n}-${cr}`));
	}, [r, n]), a;
}
var ur = Tn.useId;
function dr(e, t) {
	if (ur !== void 0) {
		let n = ur();
		return e ?? (t ? `${t}-${n}` : n);
	}
	return lr(e, t);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useBaseUiId.mjs
function fr(e) {
	return dr(e, "base-ui");
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs
var pr = {
	invalid: void 0,
	name: void 0,
	validityData: {
		state: ir,
		errors: [],
		error: "",
		value: "",
		initialValue: null
	},
	setValidityData: Ft,
	disabled: void 0,
	setTouched: Ft,
	setDirty: Ft,
	setFilled: Ft,
	setFocused: Ft,
	validationMode: "onSubmit",
	shouldValidateOnChange: () => !1,
	state: ar,
	registerFieldControl: Ft,
	validation: {
		getValidationProps: (e, t = Lt) => t,
		inputRef: { current: null },
		registeredInputs: /* @__PURE__ */ new Map(),
		registerInput: Ft,
		getInputControl: () => null,
		commit: async () => {},
		change: Ft
	}
}, mr = /*#__PURE__*/ e.createContext(pr);
process.env.NODE_ENV !== "production" && (mr.displayName = "FieldRootContext");
function hr(t = !0) {
	let n = e.useContext(mr);
	if (n.setValidityData === Ft && !t) throw Error(process.env.NODE_ENV === "production" ? xt(28) : "Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs
function gr(e, t, n, r, i = !0, a) {
	let { registerFieldControl: o } = hr(), s = Ct(() => Symbol());
	Z(() => {
		let c = s.current;
		if (!i) {
			o(c, void 0);
			return;
		}
		o(c, {
			controlRef: e,
			getValue: r,
			id: t,
			name: a,
			value: n
		});
	}, [
		e,
		i,
		r,
		t,
		a,
		o,
		s,
		n
	]), Z(() => {
		let e = s.current;
		return () => {
			o(e, void 0);
		};
	}, [o, s]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/field/item/FieldItemContext.mjs
var _r = /*#__PURE__*/ e.createContext({ disabled: !1 });
process.env.NODE_ENV !== "production" && (_r.displayName = "FieldItemContext");
function vr() {
	return e.useContext(_r);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/form-context/FormContext.mjs
var yr = /*#__PURE__*/ e.createContext({
	elementRef: { current: null },
	formRef: { current: { fields: /* @__PURE__ */ new Map() } },
	errors: {},
	clearErrors: Ft,
	validationMode: "onSubmit",
	submitAttemptedRef: { current: !1 }
});
process.env.NODE_ENV !== "production" && (yr.displayName = "FormContext");
function br() {
	return e.useContext(yr);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs
var xr = /*#__PURE__*/ e.createContext({
	controlId: void 0,
	registerControlId: Ft,
	labelId: void 0,
	setLabelId: Ft,
	messageIds: [],
	setMessageIds: Ft,
	getDescriptionProps: (e) => e
});
process.env.NODE_ENV !== "production" && (xr.displayName = "LabelableContext");
function Sr() {
	return e.useContext(xr);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/labelable-provider/useAriaLabelledBy.mjs
function Cr(t, n, r, i = !0, a) {
	let [o, s] = e.useState(), c = fr(a ? `${a}-label` : void 0), l = t ?? n ?? o;
	return Z(() => {
		let e = t || n || !i ? void 0 : wr(r.current, c);
		o !== e && s(e);
	}), l;
}
function wr(e, t) {
	let n = Tr(e);
	if (n) return !n.id && t && (n.id = t), n.id || void 0;
}
function Tr(e) {
	if (!e) return;
	let t = e.parentElement;
	if (t && t.tagName === "LABEL") return t;
	let n = e.id;
	if (n) {
		let t = e.nextElementSibling;
		if (t && t.htmlFor === n) return t;
	}
	let r = e.labels;
	return r && r[0];
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/checkbox-group/CheckboxGroupContext.mjs
var Er = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Er.displayName = "CheckboxGroupContext");
function Dr() {
	return e.useContext(Er);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/checkbox/root/CheckboxRootContext.mjs
var Or = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Or.displayName = "CheckboxRootContext");
function kr() {
	let t = e.useContext(Or);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(14) : "Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/reason-parts.mjs
var Ar = "none", jr = "trigger-press", Mr = "trigger-hover", Nr = "trigger-focus", Pr = "outside-press", Fr = "item-press", Ir = "close-press", Lr = "focus-out", Rr = "escape-key", zr = "list-navigation", Br = "cancel-open", Vr = "sibling-open", Hr = "imperative-action";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/createBaseUIEventDetails.mjs
function Ur(e, t, n, r) {
	let i = !1, a = !1, o = r ?? Lt;
	return {
		reason: e,
		event: t ?? new Event("base-ui"),
		cancel() {
			i = !0;
		},
		allowPropagation() {
			a = !0;
		},
		get isCanceled() {
			return i;
		},
		get isPropagationAllowed() {
			return a;
		},
		trigger: n,
		...o
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useValueChanged.mjs
function Wr(t, n) {
	let r = e.useRef(t), i = X(n);
	Z(() => {
		r.current !== t && i(r.current), r.current = t;
	}, [t, i]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/checkbox/root/CheckboxRoot.mjs
var Gr = "data-parent", Kr = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { checked: r, className: i, defaultChecked: a = !1, "aria-labelledby": o, disabled: l = !1, form: u, id: d, indeterminate: f = !1, inputRef: p, name: m, onCheckedChange: h, parent: g = !1, readOnly: _ = !1, render: v, required: y = !1, uncheckedValue: b, value: x, nativeButton: S = !1, style: C, ...w } = t, { clearErrors: T } = br(), { disabled: E, name: D, setDirty: O, setFilled: k, setFocused: A, setTouched: j, state: M, validationMode: N, validityData: P, validation: F } = hr(), I = vr(), { labelId: L, controlId: R, registerControlId: z, getDescriptionProps: ee } = Sr(), B = Dr(), V = B?.allValues === void 0 ? void 0 : B.parent, H = V !== void 0, te = E || I.disabled || B?.disabled || l, U = D ?? m, ne = x ?? U, W = fr(), re = fr(), ie = d || R;
	H && (g ? ie = re : ne === void 0 ? ie ||= re : ie = `${V.id}-${ne}`);
	let ae = {};
	H && (g ? ae = V.getParentProps() : ne !== void 0 && (ae = V.getChildProps(ne)));
	let { checked: oe = r, indeterminate: se = f, onCheckedChange: ce, ...le } = ae, ue = B?.value, de = e.useRef(null), G = Ct(() => Symbol()), fe = e.useRef(!1), { getButtonProps: pe, buttonRef: me } = Ln({
		disabled: te,
		native: S
	}), he = B?.validation ?? F, [ge, _e] = Qn({
		controlled: ne !== void 0 && ue !== void 0 && !g ? ue.includes(ne) : oe,
		default: a,
		name: "Checkbox",
		state: "checked"
	}), ve = H ? !!oe : ge, ye = H && se || f;
	Z(() => {
		z !== Ft && (fe.current = !0, z(G.current, ie));
	}, [
		ie,
		z,
		G
	]), e.useEffect(() => {
		let e = G.current;
		return () => {
			!fe.current || z === Ft || (fe.current = !1, z(e, void 0));
		};
	}, [z, G]), gr(de, W, ge, void 0, !B && !te, m);
	let be = e.useRef(null), xe = he.registerInput, Se = B ? ne : void 0, K = e.useCallback((e) => xe(e, {
		controlRef: de,
		value: Se
	}), [xe, Se]), Ce = wt(p, be, g ? void 0 : K), we = Cr(o, L, be, !S, ie ?? void 0);
	Z(() => {
		be.current && (be.current.indeterminate = ye, ge && k(!0));
	}, [
		ge,
		ye,
		k
	]), Wr(ge, () => {
		B || (T(U), k(ge), O(ge !== P.initialValue), he.change(ge));
	});
	let Te = ot({
		checked: ge,
		disabled: te,
		form: u,
		name: g ? void 0 : U,
		id: S ? void 0 : ie ?? void 0,
		required: y,
		ref: Ce,
		style: U ? nr : tr,
		tabIndex: -1,
		type: "checkbox",
		"aria-hidden": !0,
		onChange(e) {
			if (e.nativeEvent.defaultPrevented) return;
			if (_) {
				e.preventDefault();
				return;
			}
			let t = e.currentTarget.checked, n = Ur(Ar, e.nativeEvent);
			if (h?.(t, n), !n.isCanceled && (ce?.(t, n), !n.isCanceled && (_e(t), ne !== void 0 && B !== void 0 && !g && !H))) {
				let e = t ? [...B.value, ne] : B.value.filter((e) => e !== ne);
				B.setValue(e, n);
			}
		},
		onClick(e) {
			e.stopPropagation();
		},
		onFocus() {
			de.current?.focus();
		}
	}, x === void 0 ? Lt : { value: (B ? ge && x : x) || "" }, ee, (e) => he.getValidationProps(te, e));
	e.useEffect(() => {
		if (!V || ne === void 0) return;
		let e = V.disabledStatesRef.current;
		return e.set(ne, te), () => {
			e.delete(ne);
		};
	}, [
		V,
		te,
		ne
	]);
	let Ee = e.useMemo(() => ({
		...M,
		checked: ve,
		disabled: te,
		readOnly: _,
		required: y,
		indeterminate: ye
	}), [
		M,
		ve,
		te,
		_,
		y,
		ye
	]), De = sr(Ee), Oe = Vt("span", t, {
		state: Ee,
		ref: [
			me,
			de,
			n
		],
		props: [
			{
				id: S ? ie ?? void 0 : W,
				role: "checkbox",
				"aria-checked": ye ? "mixed" : ve,
				"aria-readonly": _ || void 0,
				"aria-required": y || void 0,
				"aria-labelledby": we,
				[Gr]: g ? "" : void 0,
				onFocus() {
					te || A(!0);
				},
				onBlur() {
					let e = be.current;
					e && (j(!0), A(!1), N === "onBlur" && he.commit(B ? ue : e.checked));
				},
				onKeyDown(e) {
					if (e.key !== "Enter" || (e.preventBaseUIHandler(), e.defaultPrevented)) return;
					let t = be.current?.form ?? null, n = e.currentTarget, r = e.nativeEvent, i = e.preventDefault, a = r.preventDefault, o = !1;
					e.preventDefault = () => {
						o = !0, i.call(e);
					}, r.preventDefault = () => {
						o = !0, a.call(r);
					}, a.call(r), tn(n).queueMicrotask(() => {
						e.preventDefault = i, r.preventDefault = a, o || rr(t)?.click();
					});
				},
				onClick(e) {
					if (_ || te) return;
					e.preventDefault();
					let t = be.current;
					t && In(t, e);
				}
			},
			w,
			le,
			pe,
			ee,
			(e) => he.getValidationProps(te, e)
		],
		stateAttributesMapping: De
	});
	return /*#__PURE__*/ c(Or.Provider, {
		value: Ee,
		children: [
			Oe,
			!ge && !B && U && !g && b !== void 0 && /*#__PURE__*/ s("input", {
				type: "hidden",
				form: u,
				name: U,
				value: b,
				disabled: te
			}),
			/*#__PURE__*/ s("input", {
				...Te,
				suppressHydrationWarning: !0
			})
		]
	});
});
process.env.NODE_ENV !== "production" && (Kr.displayName = "CheckboxRoot");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useOnMount.mjs
function qr(t) {
	e.useEffect(t, It);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useAnimationFrame.mjs
var Jr = null, Yr = globalThis.requestAnimationFrame, Xr = new class {
	callbacks = [];
	callbacksCount = 0;
	nextId = 1;
	startId = 1;
	isScheduled = !1;
	tick = (e) => {
		this.isScheduled = !1;
		let t = this.callbacks, n = this.callbacksCount;
		if (this.callbacks = [], this.callbacksCount = 0, this.startId = this.nextId, n > 0) for (let n = 0; n < t.length; n += 1) t[n]?.(e);
	};
	request(e) {
		let t = this.nextId;
		this.nextId += 1, this.callbacks.push(e), this.callbacksCount += 1;
		let n = process.env.NODE_ENV !== "production" && Yr !== requestAnimationFrame && (Yr = requestAnimationFrame, !0);
		return (!this.isScheduled || n) && (requestAnimationFrame(this.tick), this.isScheduled = !0), t;
	}
	cancel(e) {
		let t = e - this.startId;
		t < 0 || t >= this.callbacks.length || (this.callbacks[t] = null, --this.callbacksCount);
	}
}(), Zr = class e {
	static create() {
		return new e();
	}
	static request(e) {
		return Xr.request(e);
	}
	static cancel(e) {
		return Xr.cancel(e);
	}
	currentId = Jr;
	request(e) {
		this.cancel(), this.currentId = Xr.request(() => {
			this.currentId = Jr, e();
		});
	}
	cancel = () => {
		this.currentId !== Jr && (Xr.cancel(this.currentId), this.currentId = Jr);
	};
	disposeEffect = () => this.cancel;
};
function Qr() {
	let e = Ct(Zr.create).current;
	return qr(e.disposeEffect), e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/resolveRef.mjs
function $r(e) {
	return e == null ? e : "current" in e ? e.current : e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useAnimationsFinished.mjs
function ei(e, t = !1) {
	let n = Qr();
	return X((r, i = null) => {
		n.cancel();
		let a = $r(e);
		if (a == null) return;
		let o = a, s = () => {
			l.flushSync(r);
		};
		if (typeof o.getAnimations != "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
			r();
			return;
		}
		function c() {
			Promise.all(o.getAnimations().map((e) => e.finished)).then(() => {
				i?.aborted || s();
			}, () => {
				if (!i?.aborted) {
					if (o.getAnimations().some((e) => e.pending || e.playState !== "finished")) {
						c();
						return;
					}
					s();
				}
			});
		}
		if (t) {
			let e = "data-starting-style";
			if (!o.hasAttribute(e)) {
				n.request(c);
				return;
			}
			let t = new MutationObserver(() => {
				o.hasAttribute(e) || (t.disconnect(), c());
			});
			t.observe(o, {
				attributes: !0,
				attributeFilter: [e]
			}), i?.addEventListener("abort", () => t.disconnect(), { once: !0 });
			return;
		}
		n.request(c);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useOpenChangeComplete.mjs
function ti(t) {
	let { enabled: n = !0, open: r, ref: i, onComplete: a } = t, o = X(a), s = ei(i, r);
	e.useEffect(() => {
		if (!n) return;
		let e = new AbortController();
		return s(o, e.signal), () => {
			e.abort();
		};
	}, [
		n,
		r,
		o,
		s
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/useTransitionStatus.mjs
function ni(t, n = !1, r = !1) {
	let [i, a] = e.useState(t && n ? "idle" : void 0), [o, s] = e.useState(t);
	return t && !o && (s(!0), a("starting")), !t && o && i !== "ending" && !r && a("ending"), !t && !o && i === "ending" && a(void 0), Z(() => {
		if (!t && o && i !== "ending" && r) {
			let e = Zr.request(() => {
				a("ending");
			});
			return () => {
				Zr.cancel(e);
			};
		}
	}, [
		t,
		o,
		i,
		r
	]), Z(() => {
		if (!t || n) return;
		let e = Zr.request(() => {
			a(void 0);
		});
		return () => {
			Zr.cancel(e);
		};
	}, [n, t]), Z(() => {
		if (!t || !n) return;
		t && o && i !== "idle" && a("starting");
		let e = Zr.request(() => {
			a("idle");
		});
		return () => {
			Zr.cancel(e);
		};
	}, [
		n,
		t,
		o,
		i
	]), {
		mounted: o,
		setMounted: s,
		transitionStatus: i
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/stateAttributesMapping.mjs
var ri = /*#__PURE__*/ function(e) {
	return e.startingStyle = "data-starting-style", e.endingStyle = "data-ending-style", e;
}({}), ii = { "data-starting-style": "" }, ai = { "data-ending-style": "" }, oi = { transitionStatus(e) {
	return e === "starting" ? ii : e === "ending" ? ai : null;
} }, si = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, keepMounted: o = !1, ...s } = t, c = kr(), l = c.checked || c.indeterminate, { mounted: u, transitionStatus: d, setMounted: f } = ni(l), p = e.useRef(null), m = {
		...c,
		transitionStatus: d
	};
	ti({
		open: l,
		ref: p,
		onComplete() {
			l || f(!1);
		}
	});
	let h = {
		...sr(c),
		...oi
	}, g = o || u, _ = Vt("span", t, {
		ref: [n, p],
		state: m,
		stateAttributesMapping: h,
		props: s
	});
	return g ? _ : null;
});
process.env.NODE_ENV !== "production" && (si.displayName = "CheckboxIndicator");
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.31.0_react@19.2.8/node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
var ci = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), li = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), ui = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), di = (e) => {
	let t = ui(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, fi = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, pi = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, mi = n({}), hi = () => a(mi), gi = i(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: i, className: a = "", children: o, iconNode: s, ...c }, l) => {
	let { size: u = 24, strokeWidth: d = 2, absoluteStrokeWidth: f = !1, color: p = "currentColor", className: m = "" } = hi() ?? {}, h = i ?? f ? Number(n ?? d) * 24 / Number(t ?? u) : n ?? d;
	return r("svg", {
		ref: l,
		...fi,
		width: t ?? u ?? fi.width,
		height: t ?? u ?? fi.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: ci("lucide", m, a),
		...!o && !pi(c) && { "aria-hidden": "true" },
		...c
	}, [...s.map(([e, t]) => r(e, t)), ...Array.isArray(o) ? o : [o]]);
}), _i = (e, t) => {
	let n = i(({ className: n, ...i }, a) => r(gi, {
		ref: a,
		iconNode: t,
		className: ci(`lucide-${li(di(e))}`, `lucide-${e}`, n),
		...i
	}));
	return n.displayName = di(e), n;
}, vi = _i("check", [["path", {
	d: "M20 6 9 17l-5-5",
	key: "1gmf2c"
}]]), yi = _i("chevron-right", [["path", {
	d: "m9 18 6-6-6-6",
	key: "mthhwq"
}]]), bi = _i("x", [["path", {
	d: "M18 6 6 18",
	key: "1bl5f8"
}], ["path", {
	d: "m6 6 12 12",
	key: "d8bk6v"
}]]), xi = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/checkbox.tsx";
function Si({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Kr, {
		"data-slot": "checkbox",
		className: J("peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary", e),
		...t,
		children: /* @__PURE__ */ (0, Y.jsxDEV)(si, {
			"data-slot": "checkbox-indicator",
			className: "grid place-content-center text-current transition-none [&>svg]:size-3.5",
			children: /* @__PURE__ */ (0, Y.jsxDEV)(vi, {}, void 0, !1, {
				fileName: xi,
				lineNumber: 23,
				columnNumber: 9
			}, this)
		}, void 0, !1, {
			fileName: xi,
			lineNumber: 19,
			columnNumber: 7
		}, this)
	}, void 0, !1, {
		fileName: xi,
		lineNumber: 11,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/root/DialogRootContext.mjs
var Ci = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ci.displayName = "DialogRootContext");
function wi(t) {
	let n = e.useContext(Ci);
	if (!t && n === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(27) : "Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.");
	return n;
}
(function(e) {
	return e.open = "data-open", e.closed = "data-closed", e[e.startingStyle = ri.startingStyle] = "startingStyle", e[e.endingStyle = ri.endingStyle] = "endingStyle", e.anchorHidden = "data-anchor-hidden", e.side = "data-side", e.align = "data-align", e;
})({});
var Ti = { "data-popup-open": "" }, Ei = {
	"data-popup-open": "",
	"data-pressed": ""
}, Di = { "data-open": "" }, Oi = { "data-closed": "" }, ki = { "data-anchor-hidden": "" }, Ai = { open(e) {
	return e ? Ti : null;
} }, ji = { open(e) {
	return e ? Ei : null;
} }, Mi = {
	open(e) {
		return e ? Di : Oi;
	},
	anchorHidden(e) {
		return e ? ki : null;
	}
}, Ni = {
	...Mi,
	...oi
}, Pi = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, forceRender: a = !1, ...o } = e, s = wi(), c = s.useState("open"), l = s.useState("nested"), u = s.useState("mounted");
	return Vt("div", e, {
		state: {
			open: c,
			transitionStatus: s.useState("transitionStatus")
		},
		ref: [s.context.backdropRef, t],
		stateAttributesMapping: Ni,
		props: [{
			role: "presentation",
			hidden: !u,
			style: {
				userSelect: "none",
				WebkitUserSelect: "none"
			}
		}, o],
		enabled: a || !l
	});
});
process.env.NODE_ENV !== "production" && (Pi.displayName = "DialogBackdrop");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/close/DialogClose.mjs
var Fi = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, disabled: a = !1, nativeButton: o = !0, ...s } = e, c = wi(), l = c.useState("open"), { getButtonProps: u, buttonRef: d } = Ln({
		disabled: a,
		native: o
	}), f = { disabled: a };
	function p(e) {
		l && c.setOpen(!1, Ur(Ir, e.nativeEvent));
	}
	return Vt("button", e, {
		state: f,
		ref: [t, d],
		props: [
			{ onClick: p },
			s,
			u
		]
	});
});
process.env.NODE_ENV !== "production" && (Fi.displayName = "DialogClose");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/description/DialogDescription.mjs
var Ii = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, id: a, ...o } = e, s = wi(), c = fr(a);
	return s.useSyncedValueWithCleanup("descriptionElementId", c), Vt("p", e, {
		ref: t,
		props: [{ id: c }, o]
	});
});
process.env.NODE_ENV !== "production" && (Ii.displayName = "DialogDescription");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useTimeout.mjs
var Li = 0, Ri = class e {
	static create() {
		return new e();
	}
	currentId = Li;
	start(e, t) {
		this.clear(), this.currentId = setTimeout(() => {
			this.currentId = Li, t();
		}, e);
	}
	isStarted() {
		return this.currentId !== Li;
	}
	clear = () => {
		this.currentId !== Li && (clearTimeout(this.currentId), this.currentId = Li);
	};
	disposeEffect = () => this.clear;
};
function zi() {
	let e = Ct(Ri.create).current;
	return qr(e.disposeEffect), e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/platform/shared.mjs
function Bi() {
	if (typeof navigator > "u") return {
		userAgent: "",
		platform: "",
		maxTouchPoints: 0
	};
	if (process.env.NODE_ENV !== "production") {
		let e = navigator.userAgentData;
		if (e && Array.isArray(e.brands)) return {
			userAgent: e.brands.map(({ brand: e, version: t }) => `${e}/${t}`).join(" "),
			platform: e.platform ?? navigator.platform ?? "",
			maxTouchPoints: navigator.maxTouchPoints ?? 0
		};
	}
	return {
		userAgent: navigator.userAgent,
		platform: navigator.platform ?? "",
		maxTouchPoints: navigator.maxTouchPoints ?? 0
	};
}
var { userAgent: Vi, platform: Hi, maxTouchPoints: Ui } = Bi(), Wi = Vi.toLowerCase(), Gi = Hi.toLowerCase(), Ki = /^i(os$|p)/.test(Gi) || Gi === "macintel" && Ui > 1, qi = "android", Ji = Gi === qi || Wi.includes(qi), Yi = !Ki && Gi.startsWith("mac");
Gi.startsWith("win"), !Ji && /^(linux|chrome os)/.test(Gi);
var Xi = Yi || Ki, Zi = typeof CSS < "u" && !!CSS.supports?.("-webkit-backdrop-filter:none");
!Zi && Wi.includes("firefox"), !Zi && Wi.includes("chrom");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/platform/screen-reader.mjs
var Qi = Xi, $i = /jsdom|happydom/.test(Wi);
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/event.mjs
function ea(e) {
	e.preventDefault(), e.stopPropagation();
}
function ta(e) {
	return "nativeEvent" in e;
}
function na(e) {
	return e.pointerType === "" && e.isTrusted ? !0 : Ji && e.pointerType ? e.type === "click" && e.buttons === 1 : e.detail === 0 && !e.pointerType;
}
function ra(e) {
	return $i ? !1 : !Ji && e.width === 0 && e.height === 0 || Ji && e.width === 1 && e.height === 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "mouse" || e.width < 1 && e.height < 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "touch";
}
function ia(e, t) {
	let n = ["mouse", "pen"];
	return t || n.push("", void 0), n.includes(e);
}
function aa(e) {
	let t = e.type;
	return t === "click" || t === "mousedown" || t === "keydown" || t === "keyup";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/constants.mjs
var oa = "data-base-ui-focusable", sa = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])", ca = "ArrowLeft", la = "ArrowRight", ua = "ArrowUp", da = "ArrowDown";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/shadowDom.mjs
function fa(e) {
	let t = e.activeElement;
	for (; t?.shadowRoot?.activeElement != null;) t = t.shadowRoot.activeElement;
	return t;
}
function Q(e, t) {
	if (!e || !t) return !1;
	let n = t.getRootNode?.();
	if (e.contains(t)) return !0;
	if (n && sn(n)) {
		let n = t;
		for (; n;) {
			if (e === n) return !0;
			n = n.parentNode || n.host;
		}
	}
	return !1;
}
function pa(e) {
	return "composedPath" in e ? e.composedPath()[0] : e.target;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/element.mjs
function ma(e, t) {
	if (!an(e)) return !1;
	let n = e;
	if (t.hasElement(n)) return !n.hasAttribute("data-trigger-disabled");
	for (let [, e] of t.entries()) if (Q(e, n)) return !e.hasAttribute("data-trigger-disabled");
	return !1;
}
function ha(e, t) {
	if (t == null) return !1;
	if ("composedPath" in e) return e.composedPath().includes(t);
	let n = e;
	return n.target != null && t.contains(n.target);
}
function ga(e) {
	return e.matches("html,body");
}
function _a(e) {
	return on(e) && e.matches("input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])");
}
function va(e) {
	return e?.closest(`button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${sa}`) != null;
}
function ya(e) {
	return e ? e.getAttribute("role") === "combobox" && _a(e) : !1;
}
function ba(e) {
	if (!e || $i) return !0;
	try {
		return e.matches(":focus-visible");
	} catch {
		return !0;
	}
}
function xa(e) {
	return e ? e.hasAttribute("data-base-ui-focusable") ? e : e.querySelector("[data-base-ui-focusable]") || e : null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverShared.mjs
function Sa(e, t) {
	return t != null && !ia(t) ? 0 : typeof e == "function" ? e() : e;
}
function Ca(e, t, n) {
	let r = Sa(e, n);
	return typeof r == "number" ? r : r?.[t];
}
function wa(e) {
	return typeof e == "function" ? e() : e;
}
function Ta(e, t) {
	return t || e === "click" || e === "mousedown";
}
function Ea(e) {
	return e?.includes("mouse") && e !== "mousedown";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/addEventListener.mjs
function $(e, t, n, r) {
	return e.addEventListener(t, n, r), () => {
		e.removeEventListener(t, n, r);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/mergeCleanups.mjs
function Da(...e) {
	return () => {
		for (let t = 0; t < e.length; t += 1) {
			let n = e[t];
			n && n();
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useValueAsRef.mjs
function Oa(e) {
	let t = Ct(ka, e).current;
	return t.next = e, Z(t.effect), t;
}
function ka(e) {
	let t = {
		current: e,
		next: e,
		effect: () => {
			t.current = t.next;
		}
	};
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/FocusGuard.mjs
var Aa = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let [r, i] = e.useState();
	Z(() => {
		Qi && Zi && i("button");
	}, []);
	let a = {
		tabIndex: 0,
		role: r
	};
	return /*#__PURE__*/ s("span", {
		...t,
		ref: n,
		style: tr,
		"aria-hidden": !r || void 0,
		...a,
		"data-base-ui-focus-guard": ""
	});
});
process.env.NODE_ENV !== "production" && (Aa.displayName = "FocusGuard");
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
var ja = Math.min, Ma = Math.max, Na = Math.round, Pa = Math.floor, Fa = (e) => ({
	x: e,
	y: e
}), Ia = {
	left: "right",
	right: "left",
	bottom: "top",
	top: "bottom"
};
function La(e, t, n) {
	return Ma(e, ja(t, n));
}
function Ra(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function za(e) {
	return e.split("-")[0];
}
function Ba(e) {
	return e.split("-")[1];
}
function Va(e) {
	return e === "x" ? "y" : "x";
}
function Ha(e) {
	return e === "y" ? "height" : "width";
}
function Ua(e) {
	let t = e[0];
	return t === "t" || t === "b" ? "y" : "x";
}
function Wa(e) {
	return Va(Ua(e));
}
function Ga(e, t, n) {
	n === void 0 && (n = !1);
	let r = Ba(e), i = Wa(e), a = Ha(i), o = i === "x" ? r === (n ? "end" : "start") ? "right" : "left" : r === "start" ? "bottom" : "top";
	return t.reference[a] > t.floating[a] && (o = eo(o)), [o, eo(o)];
}
function Ka(e) {
	let t = eo(e);
	return [
		qa(e),
		t,
		qa(t)
	];
}
function qa(e) {
	return e.includes("start") ? e.replace("start", "end") : e.replace("end", "start");
}
var Ja = ["left", "right"], Ya = ["right", "left"], Xa = ["top", "bottom"], Za = ["bottom", "top"];
function Qa(e, t, n) {
	switch (e) {
		case "top":
		case "bottom": return n ? t ? Ya : Ja : t ? Ja : Ya;
		case "left":
		case "right": return t ? Xa : Za;
		default: return [];
	}
}
function $a(e, t, n, r) {
	let i = Ba(e), a = Qa(za(e), n === "start", r);
	return i && (a = a.map((e) => e + "-" + i), t && (a = a.concat(a.map(qa)))), a;
}
function eo(e) {
	let t = za(e);
	return Ia[t] + e.slice(t.length);
}
function to(e) {
	return {
		top: e.top ?? 0,
		right: e.right ?? 0,
		bottom: e.bottom ?? 0,
		left: e.left ?? 0
	};
}
function no(e) {
	return typeof e == "number" ? {
		top: e,
		right: e,
		bottom: e,
		left: e
	} : to(e);
}
function ro(e) {
	let { x: t, y: n, width: r, height: i } = e;
	return {
		width: r,
		height: i,
		top: n,
		left: t,
		right: t + r,
		bottom: n + i,
		x: t,
		y: n
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/composite.mjs
function io(e, t) {
	return t < 0 || t >= e.length;
}
function ao(e, t) {
	return so(e.current, { disabledIndices: t });
}
function oo(e, t) {
	return so(e.current, {
		decrement: !0,
		startingIndex: e.current.length,
		disabledIndices: t
	});
}
function so(e, { startingIndex: t = -1, decrement: n = !1, disabledIndices: r, amount: i = 1 } = {}) {
	let a = t;
	do
		a += n ? -i : i;
	while (a >= 0 && a <= e.length - 1 && co(e, a, r));
	return a;
}
function co(e, t, n) {
	if (typeof n == "function" ? n(t) : n?.includes(t) ?? !1) return !0;
	let r = e[t];
	return r ? !uo(r) || r.matches(":disabled") ? !0 : !n && (r.hasAttribute("disabled") || r.getAttribute("aria-disabled") === "true") : !1;
}
function lo(e) {
	return e.visibility === "hidden" || e.visibility === "collapse";
}
function uo(e, t = e ? yn(e) : null) {
	return !e || !e.isConnected || !t || lo(t) ? !1 : typeof e.checkVisibility == "function" ? e.checkVisibility() : t.display !== "none" && t.display !== "contents";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/tabbable.mjs
var fo = "a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable=\"false\"]),audio[controls],video[controls]";
function po(e) {
	let t = e.assignedSlot;
	if (t) return t;
	if (e.parentElement) return e.parentElement;
	let n = e.getRootNode();
	return sn(n) ? n.host : null;
}
function mo(e) {
	for (let t of Array.from(e.children)) if (en(t) === "summary") return t;
	return null;
}
function ho(e, t) {
	let n = mo(t);
	return !!n && (e === n || Q(n, e));
}
function go(e) {
	let t = e ? en(e) : "";
	return e != null && e.matches(fo) && (t !== "summary" || e.parentElement != null && en(e.parentElement) === "details" && mo(e.parentElement) === e) && (t !== "details" || mo(e) == null) && (t !== "input" || e.type !== "hidden");
}
function _o(e) {
	if (!go(e) || !e.isConnected || e.matches(":disabled")) return !1;
	for (let t = e; t; t = po(t)) {
		let n = t !== e, r = en(t) === "slot";
		if (t.hasAttribute("inert") || n && en(t) === "details" && !t.open && !ho(e, t) || t.hasAttribute("hidden") || !r && !vo(t, n)) return !1;
	}
	return !0;
}
function vo(e, t) {
	let n = yn(e);
	return t ? n.display !== "none" : uo(e, n);
}
function yo(e) {
	let t = e.tabIndex;
	if (t < 0) {
		let t = en(e);
		if (t === "details" || t === "audio" || t === "video" || on(e) && e.isContentEditable) return 0;
	}
	return t;
}
function bo(e) {
	if (en(e) !== "input") return null;
	let t = e;
	return t.type === "radio" && t.name !== "" ? t : null;
}
function xo(e, t) {
	let n = bo(e);
	if (!n) return !0;
	let r = t.find((e) => {
		let t = bo(e);
		return t?.name === n.name && t.form === n.form && t.checked;
	});
	return r ? r === n : t.find((e) => {
		let t = bo(e);
		return t?.name === n.name && t.form === n.form;
	}) === n;
}
function So(e) {
	if (on(e) && en(e) === "slot") {
		let t = e.assignedElements({ flatten: !0 });
		if (t.length > 0) return t;
	}
	return on(e) && e.shadowRoot ? Array.from(e.shadowRoot.children) : Array.from(e.children);
}
function Co(e, t) {
	So(e).forEach((e) => {
		go(e) && t.push(e), Co(e, t);
	});
}
function wo(e, t, n) {
	So(e).forEach((e) => {
		on(e) && e.matches(t) && n.push(e), wo(e, t, n);
	});
}
function To(e) {
	return _o(e) && yo(e) >= 0;
}
function Eo(e) {
	let t = [];
	return Co(e, t), t.filter(_o);
}
function Do(e) {
	let t = Eo(e);
	return t.filter((e) => yo(e) >= 0 && xo(e, t));
}
function Oo(e, t) {
	let n = Do(e), r = n.length;
	if (r === 0) return;
	let i = fa(Fn(e)), a = n.indexOf(i);
	return n[a === -1 ? t === 1 ? 0 : r - 1 : a + t];
}
function ko(e) {
	return Oo(Fn(e).body, 1) || e;
}
function Ao(e) {
	return Oo(Fn(e).body, -1) || e;
}
function jo(e, t) {
	if (!e) return null;
	let n = Do(Fn(e).body), r = n.length;
	if (r === 0) return null;
	let i = n.indexOf(e);
	return i === -1 ? null : n[(i + t + r) % r];
}
function Mo(e) {
	return jo(e, 1);
}
function No(e) {
	return jo(e, -1);
}
function Po(e, t) {
	let n = t || e.currentTarget, r = e.relatedTarget;
	return !r || !Q(n, r);
}
function Fo(e) {
	Do(e).forEach((e) => {
		e.dataset.tabindex = e.getAttribute("tabindex") || "", e.setAttribute("tabindex", "-1");
	});
}
function Io(e) {
	let t = [];
	wo(e, "[data-tabindex]", t), t.forEach((e) => {
		let t = e.dataset.tabindex;
		delete e.dataset.tabindex, t ? e.setAttribute("tabindex", t) : e.removeAttribute("tabindex");
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/nodes.mjs
function Lo(e, t, n = !0) {
	return e.filter((e) => e.parentId === t).flatMap((t) => [...!n || t.context?.open ? [t] : [], ...Lo(e, t.id, n)]);
}
function Ro(e, t) {
	let n = [], r = e.find((e) => e.id === t)?.parentId;
	for (; r;) {
		let t = e.find((e) => e.id === r);
		r = t?.parentId, t && (n = n.concat(t));
	}
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/createAttribute.mjs
function zo(e) {
	return `data-base-ui-${e}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/enqueueFocus.mjs
var Bo = 0;
function Vo(e, t = {}) {
	let { preventScroll: n = !1, sync: r = !1, shouldFocus: i } = t;
	cancelAnimationFrame(Bo);
	function a() {
		i && !i() || e?.focus({ preventScroll: n });
	}
	if (r) return a(), Ft;
	let o = requestAnimationFrame(a);
	return Bo = o, () => {
		Bo === o && (cancelAnimationFrame(o), Bo = 0);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/markOthers.mjs
var Ho = {
	inert: /* @__PURE__ */ new WeakMap(),
	"aria-hidden": /* @__PURE__ */ new WeakMap()
}, Uo = "data-base-ui-inert", Wo = {
	inert: /* @__PURE__ */ new WeakSet(),
	"aria-hidden": /* @__PURE__ */ new WeakSet()
}, Go = /* @__PURE__ */ new WeakMap(), Ko = 0;
function qo(e) {
	return Wo[e];
}
function Jo(e) {
	return e ? sn(e) ? e.host : Jo(e.parentNode) : null;
}
var Yo = (e, t) => t.map((t) => {
	if (e.contains(t)) return t;
	let n = Jo(t);
	return e.contains(n) ? n : null;
}).filter((e) => e != null), Xo = (e) => {
	let t = /* @__PURE__ */ new Set();
	return e.forEach((e) => {
		let n = e;
		for (; n && !t.has(n);) t.add(n), n = n.parentNode;
	}), t;
}, Zo = (e, t, n) => {
	let r = [], i = (e) => {
		!e || n.has(e) || Array.from(e.children).forEach((e) => {
			en(e) !== "script" && (t.has(e) ? i(e) : r.push(e));
		});
	};
	return i(e), r;
};
function Qo(e, t, n, r, { mark: i = !0 }) {
	let a = null;
	r ? a = "inert" : n && (a = "aria-hidden");
	let o = null, s = null, c = Yo(t, e), l = i ? Zo(t, Xo(c), new Set(c)) : [], u = [], d = [];
	if (a) {
		let e = Ho[a], n = qo(a);
		s = n, o = e;
		let r = Yo(t, Array.from(t.querySelectorAll("[aria-live]"))), i = c.concat(r);
		Zo(t, Xo(i), new Set(i)).forEach((t) => {
			let r = t.getAttribute(a), i = r !== null && r !== "false", o = (e.get(t) || 0) + 1;
			e.set(t, o), u.push(t), o === 1 && i && n.add(t), i || t.setAttribute(a, a === "inert" ? "" : "true");
		});
	}
	return i && l.forEach((e) => {
		let t = (Go.get(e) || 0) + 1;
		Go.set(e, t), d.push(e), t === 1 && e.setAttribute(Uo, "");
	}), Ko += 1, () => {
		o && u.forEach((e) => {
			let t = (o.get(e) || 0) - 1;
			o.set(e, t), t || (!s?.has(e) && a && e.removeAttribute(a), s?.delete(e));
		}), i && d.forEach((e) => {
			let t = (Go.get(e) || 0) - 1;
			Go.set(e, t), t || e.removeAttribute(Uo);
		}), --Ko, Ko || (Ho.inert = /* @__PURE__ */ new WeakMap(), Ho["aria-hidden"] = /* @__PURE__ */ new WeakMap(), Wo.inert = /* @__PURE__ */ new WeakSet(), Wo["aria-hidden"] = /* @__PURE__ */ new WeakSet(), Go = /* @__PURE__ */ new WeakMap());
	};
}
function $o(e, t = {}) {
	let { ariaHidden: n = !1, inert: r = !1, mark: i = !0 } = t, a = Fn(e[0]).body;
	return Qo(e, a, n, r, { mark: i });
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/constants.mjs
var es = { style: { transition: "none" } }, ts = "data-base-ui-click-trigger", ns = { fallbackAxisSide: "none" }, rs = { fallbackAxisSide: "end" }, is = {
	clipPath: "inset(50%)",
	position: "fixed",
	top: 0,
	left: 0
}, as = /*#__PURE__*/ e.createContext(null);
process.env.NODE_ENV !== "production" && (as.displayName = "PortalContext");
var os = () => e.useContext(as), ss = zo("portal");
function cs(t = {}) {
	let { ref: n, container: r, componentProps: i = Lt, elementProps: a } = t, o = dr(), s = os()?.portalNode, [c, u] = e.useState(null), [d, f] = e.useState(null), p = X((e) => {
		e !== null && f(e);
	}), m = e.useRef(null);
	Z(() => {
		if (r === null) {
			m.current && (m.current = null, f(null), u(null));
			return;
		}
		let e = (r && (rn(r) ? r : r.current)) ?? s ?? document.body;
		if (e == null) {
			m.current && (m.current = null, f(null), u(null));
			return;
		}
		m.current !== e && (m.current = e, f(null), u(e));
	}, [r, s]);
	let h = Vt("div", i, {
		ref: [n, p],
		props: [{
			id: o,
			[ss]: ""
		}, a]
	}), g = c && h ? /*#__PURE__*/ l.createPortal(h, c) : null;
	return {
		node: d,
		nodeId: /*#__PURE__*/ e.isValidElement(h) ? h.props.id : void 0,
		subtree: g
	};
}
var ls = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, children: o, container: u, ...d } = t, { node: f, nodeId: p, subtree: m } = cs({
		container: u,
		ref: n,
		componentProps: t,
		elementProps: d
	}), h = e.useRef(null), g = e.useRef(null), _ = e.useRef(null), v = e.useRef(null), [y, b] = e.useState(null), x = e.useRef(!1), S = y?.modal, C = y?.open, w = !!y && !y.modal && y.open && !!f;
	e.useEffect(() => {
		if (!f || S) return;
		function e(e) {
			f && e.relatedTarget && Po(e) && (e.type === "focusin" ? x.current &&= (Io(f), !1) : (Fo(f), x.current = !0));
		}
		return Da($(f, "focusin", e, !0), $(f, "focusout", e, !0));
	}, [f, S]), Z(() => {
		!f || C !== !0 || !x.current || (Io(f), x.current = !1);
	}, [C, f]);
	let T = e.useMemo(() => ({
		beforeOutsideRef: h,
		afterOutsideRef: g,
		beforeInsideRef: _,
		afterInsideRef: v,
		portalNode: f,
		setFocusManagerState: b
	}), [f]);
	return /*#__PURE__*/ c(e.Fragment, { children: [m, /*#__PURE__*/ c(as.Provider, {
		value: T,
		children: [
			w && f && /*#__PURE__*/ s(Aa, {
				"data-type": "outside",
				ref: h,
				onFocus: (e) => {
					Po(e, f) ? _.current?.focus() : Ao(y ? y.domReference : null)?.focus();
				}
			}),
			w && f && /*#__PURE__*/ s("span", {
				"aria-owns": p,
				style: is
			}),
			f && /*#__PURE__*/ l.createPortal(o, f),
			w && f && /*#__PURE__*/ s(Aa, {
				"data-type": "outside",
				ref: g,
				onFocus: (e) => {
					Po(e, f) ? v.current?.focus() : (ko(y ? y.domReference : null)?.focus(), y?.closeOnFocusOut && y?.onOpenChange(!1, Ur("focus-out", e.nativeEvent)));
				}
			})
		]
	})] });
});
process.env.NODE_ENV !== "production" && (ls.displayName = "FloatingPortal");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/createEventEmitter.mjs
function us() {
	let e = /* @__PURE__ */ new Map();
	return {
		emit(t, n) {
			e.get(t)?.forEach((e) => e(n));
		},
		on(t, n) {
			e.has(t) || e.set(t, /* @__PURE__ */ new Set()), e.get(t).add(n);
		},
		off(t, n) {
			e.get(t)?.delete(n);
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/components/FloatingTreeStore.mjs
var ds = class {
	nodesRef = { current: [] };
	events = us();
	addNode(e) {
		this.nodesRef.current.push(e);
	}
	removeNode(e) {
		let t = this.nodesRef.current.findIndex((t) => t === e);
		t !== -1 && this.nodesRef.current.splice(t, 1);
	}
}, fs = /*#__PURE__*/ e.createContext(null);
process.env.NODE_ENV !== "production" && (fs.displayName = "FloatingNodeContext");
var ps = /*#__PURE__*/ e.createContext(null);
process.env.NODE_ENV !== "production" && (ps.displayName = "FloatingTreeContext");
var ms = () => e.useContext(fs)?.id || null, hs = (t) => {
	let n = e.useContext(ps);
	return t ?? n;
};
function gs(e) {
	let t = dr(), n = hs(e), r = ms();
	return Z(() => {
		if (!t) return;
		let e = {
			id: t,
			parentId: r
		};
		return n?.addNode(e), () => {
			n?.removeNode(e);
		};
	}, [
		n,
		t,
		r
	]), t;
}
function _s(t) {
	let { children: n, id: r } = t, i = ms();
	return /*#__PURE__*/ s(fs.Provider, {
		value: e.useMemo(() => ({
			id: r,
			parentId: i
		}), [r, i]),
		children: n
	});
}
function vs(e) {
	let { children: t, externalTree: n } = e, r = Ct(() => n ?? new ds()).current;
	return /*#__PURE__*/ s(ps.Provider, {
		value: r,
		children: t
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/components/FloatingFocusManager.mjs
function ys(e, t) {
	let n = tn(pa(e));
	return e instanceof n.KeyboardEvent ? "keyboard" : e instanceof n.FocusEvent ? t || "keyboard" : "pointerType" in e ? e.pointerType || "keyboard" : "touches" in e ? "touch" : e instanceof n.MouseEvent ? t || (e.detail === 0 ? "keyboard" : "mouse") : "";
}
var bs = 20, xs = [];
function Ss() {
	xs = xs.filter((e) => e.deref()?.isConnected);
}
function Cs(e) {
	Ss(), e && en(e) !== "body" && (xs.push(new WeakRef(e)), xs.length > bs && (xs = xs.slice(-20)));
}
function ws() {
	return Ss(), xs[xs.length - 1]?.deref();
}
function Ts(e) {
	return e ? To(e) ? e : Do(e)[0] || e : null;
}
function Es(e) {
	if (e.hasAttribute("tabindex") && !e.hasAttribute("data-tabindex") || !e.getAttribute("role")?.includes("dialog")) return;
	let t = Eo(e).filter((e) => {
		let t = e.getAttribute("data-tabindex") || "";
		return To(e) || e.hasAttribute("data-tabindex") && !t.startsWith("-");
	}), n = e.getAttribute("tabindex");
	t.length === 0 ? n !== "0" && (e.setAttribute("tabindex", "0"), e.setAttribute("data-tabindex", "0")) : (n !== "-1" || e.hasAttribute("data-tabindex") && e.getAttribute("data-tabindex") !== "-1") && (e.setAttribute("tabindex", "-1"), e.setAttribute("data-tabindex", "-1"));
}
function Ds(t) {
	let { context: n, children: r, disabled: i = !1, initialFocus: a = !0, returnFocus: o = !0, restoreFocus: l = !1, modal: u = !0, closeOnFocusOut: d = !0, openInteractionType: f = "", nextFocusableElement: p, previousFocusableElement: m, beforeContentFocusGuardRef: h, externalTree: g, getInsideElements: _ } = t, v = "rootStore" in n ? n.rootStore : n, y = v.useState("open"), b = v.useState("domReferenceElement"), x = v.useState("floatingElement"), { events: S, dataRef: C } = v.context, w = X(() => C.current.floatingContext?.nodeId), T = a === !1, E = ya(b) && T, D = Oa(a), O = Oa(o), k = Oa(f), A = Oa(y), j = hs(g), M = os(), N = e.useRef(!1), P = e.useRef(!1), F = e.useRef(!1), I = e.useRef(null), L = e.useRef(""), R = e.useRef(""), z = e.useRef(null), ee = e.useRef(null), B = wt(z, h, M?.beforeInsideRef), V = wt(ee, M?.afterInsideRef), H = zi(), te = zi(), U = Qr(), ne = M != null, W = xa(x), re = X((e = W) => e ? Do(e) : []), ie = X(() => _?.().filter((e) => e != null) ?? []);
	e.useEffect(() => {
		if (i || !u) return;
		function e(e) {
			e.key === "Tab" && Q(W, fa(Fn(W))) && re().length === 0 && !E && ea(e);
		}
		return $(Fn(W), "keydown", e);
	}, [
		i,
		W,
		u,
		E,
		re
	]), e.useEffect(() => {
		if (i || !y) return;
		let e = Fn(W);
		function t() {
			F.current = !1;
		}
		function n(e) {
			let t = pa(e), n = ie(), r = Q(x, t) || Q(b, t) || Q(M?.portalNode, t) || n.some((e) => e === t || Q(e, t));
			F.current = !r, R.current = e.pointerType || "keyboard", t?.closest("[data-base-ui-click-trigger]") && (P.current = !0, te.start(0, () => {
				P.current = !1;
			}));
		}
		function r() {
			R.current = "keyboard";
		}
		return Da($(e, "pointerdown", n, !0), $(e, "pointerup", t, !0), $(e, "pointercancel", t, !0), $(e, "keydown", r, !0), t);
	}, [
		i,
		x,
		b,
		W,
		y,
		M,
		te,
		ie
	]), e.useEffect(() => {
		if (i || !d) return;
		let e = Fn(W);
		function t() {
			P.current = !0, te.start(0, () => {
				P.current = !1;
			});
		}
		function n(e) {
			let t = pa(e);
			To(t) && (I.current = t);
		}
		function r(t) {
			let n = t.relatedTarget, r = t.currentTarget, i = pa(t);
			u && n == null && i != null && Q(x, i) && Cs(i), queueMicrotask(() => {
				let a = w(), o = v.context.triggerElements, s = ie(), c = n?.hasAttribute(zo("focus-guard")) && [
					z.current,
					ee.current,
					M?.beforeInsideRef.current,
					M?.afterInsideRef.current,
					M?.beforeOutsideRef.current,
					M?.afterOutsideRef.current,
					$r(m),
					$r(p)
				].includes(n), d = !(Q(b, n) || Q(x, n) || Q(n, x) || Q(M?.portalNode, n) || s.some((e) => e === n || Q(e, n)) || o.hasMatchingElement((e) => Q(e, n)) || c || j && (Lo(j.nodesRef.current, a).find((e) => Q(e.context?.elements.floating, n) || Q(e.context?.elements.domReference, n)) || Ro(j.nodesRef.current, a).find((e) => [e.context?.elements.floating, xa(e.context?.elements.floating)].includes(n) || e.context?.elements.domReference === n)));
				if (r === b && W && Es(W), l && r !== b && !uo(i) && fa(e) === e.body) {
					if (on(W) && (W.focus(), l === "popup")) {
						U.request(() => {
							W.focus();
						});
						return;
					}
					let e = re(), t = I.current, n = (t && e.includes(t) ? t : null) || e[e.length - 1] || W;
					on(n) && n.focus();
				}
				if (C.current.insideReactTree) {
					C.current.insideReactTree = !1;
					return;
				}
				(E || !u) && n && d && !P.current && (E || n !== ws()) && (N.current = !0, v.setOpen(!1, Ur(Lr, t)));
			});
		}
		function a() {
			F.current || (C.current.insideReactTree = !0, H.start(0, () => {
				C.current.insideReactTree = !1;
			}));
		}
		let o = on(b) ? b : null;
		if (!(!x && !o)) return Da(o && $(o, "focusout", r), o && $(o, "pointerdown", t), x && $(x, "focusin", n), x && $(x, "focusout", r), x && M && $(x, "focusout", a, !0));
	}, [
		i,
		b,
		x,
		W,
		u,
		j,
		M,
		v,
		d,
		l,
		re,
		E,
		w,
		C,
		H,
		te,
		U,
		p,
		m,
		ie
	]), e.useEffect(() => {
		if (i || !x || !y) return;
		let e = Array.from(M?.portalNode?.querySelectorAll(`[${zo("portal")}]`) || []), t = (j ? Ro(j.nodesRef.current, w()) : []).find((e) => ya(e.context?.elements.domReference || null))?.context?.elements.domReference, n = $o([
			x,
			...e,
			z.current,
			ee.current,
			M?.beforeOutsideRef.current,
			M?.afterOutsideRef.current,
			...ie(),
			t,
			$r(m),
			$r(p),
			E ? b : null
		].filter((e) => e != null), {
			ariaHidden: u || E,
			mark: !1
		}), r = $o([x, ...e].filter((e) => e != null));
		return () => {
			r(), n();
		};
	}, [
		y,
		i,
		b,
		x,
		u,
		M,
		E,
		j,
		w,
		p,
		m,
		ie
	]), Z(() => {
		if (!y || i || !on(W)) return;
		L.current = "", R.current = "";
		let e = Fn(W), t = fa(e);
		queueMicrotask(() => {
			let n = D.current, r = typeof n == "function" ? n(k.current || "") : n;
			if (r === void 0 || r === !1 || Q(W, t)) return;
			let i = null, a = () => (i ??= re(W), i[0] || W), o;
			o = r === !0 || r === null ? a() : $r(r), o ||= a();
			let s = Q(W, fa(e));
			Vo(o, {
				preventScroll: o === W,
				shouldFocus() {
					if (!A.current) return !1;
					if (s) return !0;
					let t = fa(e);
					return !(t !== o && Q(W, t));
				}
			});
		});
	}, [
		i,
		y,
		W,
		re,
		D,
		k,
		A
	]), Z(() => {
		if (i || !W) return;
		let e = Fn(W), t = fa(e), n = k.current == null;
		Cs(t);
		function r(e) {
			if (e.open || (L.current = ys(e.nativeEvent, R.current)), e.reason === "trigger-hover" && e.nativeEvent.type === "mouseleave" && (N.current = !0), e.reason === "outside-press") if (e.nested) N.current = !1;
			else if (na(e.nativeEvent) || ra(e.nativeEvent)) N.current = !1;
			else {
				let e = !1;
				Fn(W).createElement("div").focus({ get preventScroll() {
					return e = !0, !1;
				} }), e ? N.current = !1 : N.current = !0;
			}
		}
		S.on("openchange", r);
		function a(e) {
			let r = O.current, i = typeof r == "function" ? r(e) : r;
			if (i === void 0 || i === !1) return null;
			i === null && (i = !0);
			let a = b?.isConnected ? b : null, o = t?.isConnected && en(t) !== "body" ? t : null, s = n ? o || a : a || o;
			return s ||= ws() || null, typeof i == "boolean" ? s : $r(i) || s || null;
		}
		return () => {
			S.off("openchange", r);
			let t = fa(e), n = ie(), i = Q(x, t) || n.some((e) => e === t || Q(e, t)) || j && Lo(j.nodesRef.current, w(), !1).some((e) => Q(e.context?.elements.floating, t)), o = O.current, s = L.current, c = a(s);
			queueMicrotask(() => {
				let n = Ts(c), r = typeof o != "boolean";
				if (o && !N.current && on(n) && (!(!r && n !== t && t !== e.body) || i)) {
					let e = { preventScroll: !0 };
					s === "keyboard" && (e.focusVisible = !0), n.focus(e);
				}
				N.current = !1;
			});
		};
	}, [
		i,
		x,
		W,
		O,
		k,
		S,
		j,
		b,
		w,
		ie
	]), Z(() => {
		if (!Zi || y || !x) return;
		let e = fa(Fn(x));
		!on(e) || !_a(e) || Q(x, e) && e.blur();
	}, [y, x]), Z(() => {
		if (!(i || !M)) return M.setFocusManagerState({
			modal: u,
			closeOnFocusOut: d,
			open: y,
			onOpenChange: v.setOpen,
			domReference: b
		}), () => {
			M.setFocusManagerState(null);
		};
	}, [
		i,
		M,
		u,
		y,
		v,
		d,
		b
	]), Z(() => {
		if (!(i || !W)) return Es(W), () => {
			queueMicrotask(Ss);
		};
	}, [i, W]);
	let ae = !i && (!u || !E) && (ne || u);
	return /*#__PURE__*/ c(e.Fragment, { children: [
		ae && /*#__PURE__*/ s(Aa, {
			"data-type": "inside",
			ref: B,
			onFocus: (e) => {
				if (u) {
					let e = re();
					Vo(e[e.length - 1]);
				} else M?.portalNode && (N.current = !1, Po(e, M.portalNode) ? ko(b)?.focus() : $r(m ?? M.beforeOutsideRef)?.focus());
			}
		}),
		r,
		ae && /*#__PURE__*/ s(Aa, {
			"data-type": "inside",
			ref: V,
			onFocus: (e) => {
				u ? Vo(re()[0]) : M?.portalNode && (d && (N.current = !0), Po(e, M.portalNode) ? Ao(b)?.focus() : $r(p ?? M.afterOutsideRef)?.focus());
			}
		})
	] });
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useClick.mjs
function Os(t, n = {}) {
	let { enabled: r = !0, event: i = "click", toggle: a = !0, ignoreMouse: o = !1, stickIfOpen: s = !0, touchOpenDelay: c = 0, reason: l = jr } = n, u = "rootStore" in t ? t.rootStore : t, d = u.context.dataRef, f = e.useRef(void 0), p = Qr(), m = zi(), h = e.useMemo(() => {
		function e(e, t, n, r) {
			let i = Ur(l, t, n);
			e && r === "touch" && c > 0 ? m.start(c, () => {
				u.setOpen(!0, i);
			}) : u.setOpen(e, i);
		}
		function t(e, t, n) {
			let r = d.current.openEvent, i = u.select("domReferenceElement") !== t;
			return e && i || !e || !a ? !0 : r && s ? !n(r.type) : !1;
		}
		return {
			onPointerDown(e) {
				f.current = ia(e.pointerType, !0) && ra(e.nativeEvent) ? "virtual" : e.pointerType;
			},
			onMouseDown(n) {
				let r = f.current, a = n.nativeEvent, s = u.select("open");
				if (n.button !== 0 || i === "click" || ia(r, !0) && o) return;
				let c = t(s, n.currentTarget, (e) => e === "click" || e === "mousedown"), l = pa(a);
				if (_a(l)) {
					e(c, a, l, r);
					return;
				}
				let d = n.currentTarget;
				p.request(() => {
					e(c, a, d, r);
				});
			},
			onClick(n) {
				if (i === "mousedown-only") return;
				let r = f.current;
				if (i === "mousedown" && r) {
					f.current = void 0;
					return;
				}
				ia(r, !0) && o || e(t(u.select("open"), n.currentTarget, (e) => e === "click" || e === "mousedown" || e === "keydown" || e === "keyup"), n.nativeEvent, n.currentTarget, r);
			},
			onKeyDown() {
				f.current = void 0;
			}
		};
	}, [
		d,
		i,
		o,
		l,
		u,
		s,
		a,
		p,
		m,
		c
	]);
	return e.useMemo(() => r ? { reference: h } : Lt, [r, h]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs
function ks() {
	return !1;
}
function As(e) {
	return {
		escapeKey: typeof e == "boolean" ? e : e?.escapeKey ?? !1,
		outsidePress: typeof e == "boolean" ? e : e?.outsidePress ?? !0
	};
}
function js(t, n = {}) {
	let { enabled: r = !0, escapeKey: i = !0, outsidePress: a = !0, outsidePressEvent: o = "sloppy", referencePress: s = ks, bubbles: c, externalTree: l } = n, u = "rootStore" in t ? t.rootStore : t, d = u.useState("open"), f = u.useState("floatingElement"), { dataRef: p } = u.context, m = hs(l), h = X(typeof a == "function" ? a : () => !1), g = typeof a == "function" ? h : a, _ = g !== !1, v = X(() => o), { escapeKey: y, outsidePress: b } = As(c), x = e.useRef(!1), S = e.useRef(!1), C = e.useRef(!1), w = e.useRef(!1), T = e.useRef(""), E = e.useRef(null), D = zi(), O = zi(), k = X(() => {
		O.clear(), p.current.insideReactTree = !1;
	}), A = X((e) => {
		let t = p.current.floatingContext?.nodeId;
		return (m ? Lo(m.nodesRef.current, t) : []).some((t) => t.context?.open && !t.context.dataRef.current[e]);
	}), j = X((e) => ha(e, u.select("floatingElement")) || ha(e, u.select("domReferenceElement"))), M = X((e) => {
		s() && u.setOpen(!1, Ur(jr, e.nativeEvent));
	}), N = X((e) => {
		if (!d || !r || !i || e.key !== "Escape" || w.current || !y && A("__escapeKeyBubbles")) return;
		let t = Ur(Rr, ta(e) ? e.nativeEvent : e);
		u.setOpen(!1, t), t.isCanceled || e.preventDefault(), !y && !t.isPropagationAllowed && e.stopPropagation();
	}), P = X(() => {
		p.current.insideReactTree = !0, O.start(0, k);
	}), F = X((e) => {
		if (!d || !r || e.button !== 0) return;
		let t = pa(e.nativeEvent);
		Q(u.select("floatingElement"), t) && (x.current || (x.current = !0, S.current = !1));
	}), I = X((e) => {
		!d || !r || (e.defaultPrevented || e.nativeEvent.defaultPrevented) && x.current && (S.current = !0);
	});
	e.useEffect(() => {
		if (!d || !r) return k;
		p.current.__escapeKeyBubbles = y, p.current.__outsidePressBubbles = b;
		let e = new Ri(), t = new Ri();
		function n() {
			e.clear(), w.current = !0;
		}
		function a() {
			e.start(Zi ? 5 : 0, () => {
				w.current = !1;
			});
		}
		function o() {
			C.current = !0, t.start(0, () => {
				C.current = !1;
			});
		}
		function s() {
			x.current = !1, S.current = !1;
		}
		function c() {
			let e = T.current, t = e === "pen" || !e ? "mouse" : e, n = v(), r = typeof n == "function" ? n() : n;
			return typeof r == "string" ? r : r[t];
		}
		function l(e) {
			let t = c();
			return t === "intentional" && e.type !== "click" || t === "sloppy" && e.type === "click";
		}
		function h(e) {
			let t = p.current.floatingContext?.nodeId, n = m && Lo(m.nodesRef.current, t).some((t) => ha(e, t.context?.elements.floating));
			return j(e) || n;
		}
		function O(e) {
			if (l(e)) {
				e.type !== "click" && !j(e) && (t.clear(), C.current = !1), k();
				return;
			}
			if (p.current.insideReactTree) {
				k();
				return;
			}
			let n = pa(e), r = `[${zo("inert")}]`, i = an(n) ? n.getRootNode() : null, a = Array.from((sn(i) ? i : Fn(u.select("floatingElement"))).querySelectorAll(r)), o = u.context.triggerElements;
			if (n && (o.hasElement(n) || o.hasMatchingElement((e) => Q(e, n)))) return;
			let s = an(n) ? n : null;
			for (; s && !vn(s);) {
				let e = xn(s);
				if (vn(e) || !an(e)) break;
				s = e;
			}
			if (!(a.length && an(n) && !ga(n) && !Q(n, u.select("floatingElement")) && a.every((e) => !Q(s, e)))) {
				if (on(n) && !("touches" in e)) {
					let t = vn(n), r = yn(n), i = /auto|scroll/, a = t || i.test(r.overflowX), o = t || i.test(r.overflowY), s = a && n.clientWidth > 0 && n.scrollWidth > n.clientWidth, c = o && n.clientHeight > 0 && n.scrollHeight > n.clientHeight, l = r.direction === "rtl", u = c && (l ? e.offsetX <= n.offsetWidth - n.clientWidth : e.offsetX > n.clientWidth), d = s && e.offsetY > n.clientHeight;
					if (u || d) return;
				}
				if (!h(e)) {
					if (c() === "intentional" && C.current) {
						t.clear(), C.current = !1;
						return;
					}
					typeof g == "function" && !g(e) || A("__outsidePressBubbles") || (u.setOpen(!1, Ur(Pr, e)), k());
				}
			}
		}
		function M(e) {
			c() !== "sloppy" || e.pointerType === "touch" || !u.select("open") || !r || j(e) || O(e);
		}
		function P(e) {
			if (c() !== "sloppy" || !u.select("open") || !r || j(e)) return;
			let t = e.touches[0];
			t && (E.current = {
				startTime: Date.now(),
				startX: t.clientX,
				startY: t.clientY,
				dismissOnTouchEnd: !1,
				dismissOnMouseDown: !0
			}, D.start(1e3, () => {
				E.current && (E.current.dismissOnTouchEnd = !1, E.current.dismissOnMouseDown = !1);
			}));
		}
		function F(e, t) {
			let n = pa(e);
			if (!n) return;
			let r = $(n, e.type, () => {
				t(e), r();
			});
		}
		function I(e) {
			T.current = "touch", F(e, P);
		}
		function L(e) {
			D.clear(), e.type === "pointerdown" && (T.current = e.pointerType), !(e.type === "mousedown" && E.current && !E.current.dismissOnMouseDown) && F(e, (e) => {
				e.type === "pointerdown" ? M(e) : O(e);
			});
		}
		function R(e) {
			if (!x.current) return;
			let n = S.current;
			if (s(), c() === "intentional") {
				if (e.type === "pointercancel") {
					n && o();
					return;
				}
				if (!h(e)) {
					if (n) {
						o();
						return;
					}
					typeof g == "function" && !g(e) || (t.clear(), C.current = !0, k());
				}
			}
		}
		function z(e) {
			if (c() !== "sloppy" || !E.current || j(e)) return;
			let t = e.touches[0];
			if (!t) return;
			let n = Math.abs(t.clientX - E.current.startX), r = Math.abs(t.clientY - E.current.startY), i = Math.sqrt(n * n + r * r);
			i > 5 && (E.current.dismissOnTouchEnd = !0), i > 10 && (O(e), D.clear(), E.current = null);
		}
		function ee(e) {
			F(e, z);
		}
		function B(e) {
			c() !== "sloppy" || !E.current || j(e) || (E.current.dismissOnTouchEnd && O(e), D.clear(), E.current = null);
		}
		function V(e) {
			F(e, B);
		}
		let H = Fn(f), te = Da(i && Da($(H, "keydown", N), $(H, "compositionstart", n), $(H, "compositionend", a)), _ && Da($(H, "click", L, !0), $(H, "pointerdown", L, !0), $(H, "pointerup", R, !0), $(H, "pointercancel", R, !0), $(H, "mousedown", L, !0), $(H, "mouseup", R, !0), $(H, "touchstart", I, !0), $(H, "touchmove", ee, !0), $(H, "touchend", V, !0)));
		return () => {
			te(), e.clear(), t.clear(), s(), C.current = !1, k();
		};
	}, [
		p,
		f,
		i,
		_,
		g,
		d,
		r,
		y,
		b,
		N,
		k,
		v,
		A,
		j,
		m,
		u,
		D
	]);
	let L = e.useMemo(() => ({
		onKeyDown: N,
		onPointerDown: M,
		onClick: M
	}), [N, M]), R = e.useMemo(() => ({
		onKeyDown: N,
		onPointerDown: I,
		onMouseDown: I,
		onClickCapture: P,
		onMouseDownCapture(e) {
			P(), F(e);
		},
		onPointerDownCapture(e) {
			P(), F(e);
		},
		onMouseUpCapture: P,
		onTouchEndCapture: P,
		onTouchMoveCapture: P
	}), [
		N,
		P,
		F,
		I
	]);
	return e.useMemo(() => r ? {
		reference: L,
		floating: R,
		trigger: L
	} : {}, [
		r,
		L,
		R
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+core@1.8.0/node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function Ms(e, t, n) {
	let { reference: r, floating: i } = e, a = Ua(t), o = Wa(t), s = Ha(o), c = za(t), l = a === "y", u = r.x + r.width / 2 - i.width / 2, d = r.y + r.height / 2 - i.height / 2, f = r[s] / 2 - i[s] / 2, p;
	switch (c) {
		case "top":
			p = {
				x: u,
				y: r.y - i.height
			};
			break;
		case "bottom":
			p = {
				x: u,
				y: r.y + r.height
			};
			break;
		case "right":
			p = {
				x: r.x + r.width,
				y: d
			};
			break;
		case "left":
			p = {
				x: r.x - i.width,
				y: d
			};
			break;
		default: p = {
			x: r.x,
			y: r.y
		};
	}
	let m = Ba(t);
	return m && (p[o] += f * (m === "end" ? 1 : -1) * (n && l ? -1 : 1)), p;
}
async function Ns(e, t) {
	t === void 0 && (t = {});
	let { x: n, y: r, platform: i, rects: a, elements: o, strategy: s } = e, { boundary: c = "clippingAncestors", rootBoundary: l = "viewport", elementContext: u = "floating", altBoundary: d = !1, padding: f = 0 } = Ra(t, e), p = no(f), m = o[d ? u === "floating" ? "reference" : "floating" : u], h = ro(await i.getClippingRect({
		element: await (i.isElement == null ? void 0 : i.isElement(m)) ?? !0 ? m : m.contextElement || await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(o.floating)),
		boundary: c,
		rootBoundary: l,
		strategy: s
	})), g = u === "floating" ? {
		x: n,
		y: r,
		width: a.floating.width,
		height: a.floating.height
	} : a.reference, _ = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(o.floating)), v = await (i.isElement == null ? void 0 : i.isElement(_)) && await (i.getScale == null ? void 0 : i.getScale(_)) || {
		x: 1,
		y: 1
	}, y = ro(i.convertOffsetParentRelativeRectToViewportRelativeRect ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
		elements: o,
		rect: g,
		offsetParent: _,
		strategy: s
	}) : g);
	return {
		top: (h.top - y.top + p.top) / v.y,
		bottom: (y.bottom - h.bottom + p.bottom) / v.y,
		left: (h.left - y.left + p.left) / v.x,
		right: (y.right - h.right + p.right) / v.x
	};
}
var Ps = 50, Fs = async (e, t, n) => {
	let { placement: r = "bottom", strategy: i = "absolute", middleware: a = [], platform: o } = n, s = o.detectOverflow ? o : {
		...o,
		detectOverflow: Ns
	}, c = await (o.isRTL == null ? void 0 : o.isRTL(t)), l = await o.getElementRects({
		reference: e,
		floating: t,
		strategy: i
	}), { x: u, y: d } = Ms(l, r, c), f = r, p = 0, m = {};
	for (let n = 0; n < a.length; n++) {
		let h = a[n];
		if (!h) continue;
		let { name: g, fn: _ } = h, { x: v, y, data: b, reset: x } = await _({
			x: u,
			y: d,
			initialPlacement: r,
			placement: f,
			strategy: i,
			middlewareData: m,
			rects: l,
			platform: s,
			elements: {
				reference: e,
				floating: t
			}
		});
		u = v ?? u, d = y ?? d, m[g] = {
			...m[g],
			...b
		}, x && p < Ps && (p++, typeof x == "object" && (x.placement && (f = x.placement), x.rects && (l = x.rects === !0 ? await o.getElementRects({
			reference: e,
			floating: t,
			strategy: i
		}) : x.rects), {x: u, y: d} = Ms(l, f, c)), n = -1);
	}
	return {
		x: u,
		y: d,
		placement: f,
		strategy: i,
		middlewareData: m
	};
}, Is = function(e) {
	return e === void 0 && (e = {}), {
		name: "flip",
		options: e,
		async fn(t) {
			var n;
			let { placement: r, middlewareData: i, rects: a, initialPlacement: o, platform: s, elements: c } = t, { mainAxis: l = !0, crossAxis: u = !0, fallbackPlacements: d, fallbackStrategy: f = "bestFit", fallbackAxisSideDirection: p = "none", flipAlignment: m = !0, ...h } = Ra(e, t);
			if ((n = i.arrow) != null && n.alignmentOffset) return {};
			let g = za(r), _ = Ua(o), v = za(o) === o, y = await (s.isRTL == null ? void 0 : s.isRTL(c.floating)), b = d || (v || !m ? [eo(o)] : Ka(o)), x = p !== "none";
			!d && x && b.push(...$a(o, m, p, y));
			let S = [o, ...b], C = await s.detectOverflow(t, h), w = [], T = i.flip?.overflows || [];
			if (l && w.push(C[g]), u) {
				let e = Ga(r, a, y);
				w.push(C[e[0]], C[e[1]]);
			}
			if (T = [...T, {
				placement: r,
				overflows: w
			}], !w.every((e) => e <= 0)) {
				let e = (i.flip?.index || 0) + 1, t = S[e];
				if (t && (u !== "alignment" || _ === Ua(t) || T.every((e) => Ua(e.placement) !== _ || e.overflows[0] > 0))) return {
					data: {
						index: e,
						overflows: T
					},
					reset: { placement: t }
				};
				let n = T.filter((e) => e.overflows[0] <= 0).sort((e, t) => e.overflows[1] - t.overflows[1])[0]?.placement;
				if (!n) switch (f) {
					case "bestFit": {
						let e = T.filter((e) => {
							if (x) {
								let t = Ua(e.placement);
								return t === _ || t === "y";
							}
							return !0;
						}).map((e) => [e.placement, e.overflows.filter((e) => e > 0).reduce((e, t) => e + t, 0)]).sort((e, t) => e[1] - t[1])[0]?.[0];
						e && (n = e);
						break;
					}
					case "initialPlacement": n = o;
				}
				if (r !== n) return { reset: { placement: n } };
			}
			return {};
		}
	};
}, Ls = /*#__PURE__*/ new Set(["left", "top"]);
async function Rs(e, t) {
	let { placement: n, platform: r, elements: i } = e, a = await (r.isRTL == null ? void 0 : r.isRTL(i.floating)), o = za(n), s = Ba(n), c = Ua(n) === "y", l = Ls.has(o) ? -1 : 1, u = a && c ? -1 : 1, d = Ra(t, e), { mainAxis: f, crossAxis: p, alignmentAxis: m } = typeof d == "number" ? {
		mainAxis: d,
		crossAxis: 0,
		alignmentAxis: null
	} : {
		mainAxis: d.mainAxis || 0,
		crossAxis: d.crossAxis || 0,
		alignmentAxis: d.alignmentAxis
	};
	return s && typeof m == "number" && (p = s === "end" ? m * -1 : m), c ? {
		x: p * u,
		y: f * l
	} : {
		x: f * l,
		y: p * u
	};
}
var zs = function(e) {
	return e === void 0 && (e = 0), {
		name: "offset",
		options: e,
		async fn(t) {
			var n;
			let { x: r, y: i, placement: a, middlewareData: o } = t, s = await Rs(t, e);
			return a === o.offset?.placement && (n = o.arrow) != null && n.alignmentOffset ? {} : {
				x: r + s.x,
				y: i + s.y,
				data: {
					...s,
					placement: a
				}
			};
		}
	};
}, Bs = function(e) {
	return e === void 0 && (e = {}), {
		name: "shift",
		options: e,
		async fn(t) {
			let { x: n, y: r, placement: i, platform: a } = t, { mainAxis: o = !0, crossAxis: s = !1, limiter: c = { fn: (e) => {
				let { x: t, y: n } = e;
				return {
					x: t,
					y: n
				};
			} }, ...l } = Ra(e, t), u = {
				x: n,
				y: r
			}, d = await a.detectOverflow(t, l), f = Ua(i), p = Va(f), m = u[p], h = u[f], g = (e, t) => La(t + d[e === "y" ? "top" : "left"], t, t - d[e === "y" ? "bottom" : "right"]);
			o && (m = g(p, m)), s && (h = g(f, h));
			let _ = c.fn({
				...t,
				[p]: m,
				[f]: h
			});
			return {
				..._,
				data: {
					x: _.x - n,
					y: _.y - r,
					enabled: {
						[p]: o,
						[f]: s
					}
				}
			};
		}
	};
}, Vs = function(e) {
	return e === void 0 && (e = {}), {
		options: e,
		fn(t) {
			let { x: n, y: r, placement: i, rects: a, middlewareData: o } = t, { offset: s = 0, mainAxis: c = !0, crossAxis: l = !0 } = Ra(e, t), u = {
				x: n,
				y: r
			}, d = Ua(i), f = Va(d), p = u[f], m = u[d], h = Ra(s, t), g = typeof h == "number" ? {
				mainAxis: h,
				crossAxis: 0
			} : {
				mainAxis: h.mainAxis ?? 0,
				crossAxis: h.crossAxis ?? 0
			};
			if (c) {
				let e = f === "y" ? "height" : "width", t = a.reference[f] - a.floating[e] + g.mainAxis, n = a.reference[f] + a.reference[e] - g.mainAxis;
				p < t ? p = t : p > n && (p = n);
			}
			if (l) {
				let e = f === "y" ? "width" : "height", t = Ls.has(za(i)), n = a.reference[d] - a.floating[e] + (t && o.offset?.[d] || 0) + (t ? 0 : g.crossAxis), r = a.reference[d] + a.reference[e] + (t ? 0 : o.offset?.[d] || 0) - (t ? g.crossAxis : 0);
				m < n ? m = n : m > r && (m = r);
			}
			return {
				[f]: p,
				[d]: m
			};
		}
	};
}, Hs = function(e) {
	return e === void 0 && (e = {}), {
		name: "size",
		options: e,
		async fn(t) {
			let { placement: n, rects: r, platform: i, elements: a } = t, { apply: o = () => {}, ...s } = Ra(e, t), c = await i.detectOverflow(t, s), l = za(n), u = Ba(n), d = Ua(n) === "y", { width: f, height: p } = r.floating, m, h;
			l === "top" || l === "bottom" ? (m = l, h = u === (await (i.isRTL == null ? void 0 : i.isRTL(a.floating)) ? "start" : "end") ? "left" : "right") : (h = l, m = u === "end" ? "top" : "bottom");
			let g = p - c.top - c.bottom, _ = f - c.left - c.right, v = ja(p - c[m], g), y = ja(f - c[h], _), b = t.middlewareData.shift, x = !b, S = v, C = y;
			b != null && b.enabled.x && (C = _), b != null && b.enabled.y && (S = g), x && !u && (d ? C = f - 2 * Ma(c.left, c.right) : S = p - 2 * Ma(c.top, c.bottom)), await o({
				...t,
				availableWidth: C,
				availableHeight: S
			});
			let w = await i.getDimensions(a.floating);
			return f !== w.width || p !== w.height ? { reset: { rects: !0 } } : {};
		}
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function Us(e) {
	let t = yn(e), n = parseFloat(t.width) || 0, r = parseFloat(t.height) || 0, i = on(e), a = i ? e.offsetWidth : n, o = i ? e.offsetHeight : r, s = Na(n) !== a || Na(r) !== o;
	return s && (n = a, r = o), {
		width: n,
		height: r,
		$: s
	};
}
function Ws(e) {
	return an(e) ? e : e.contextElement;
}
function Gs(e) {
	let t = Ws(e);
	if (!on(t)) return Fa(1);
	let n = t.getBoundingClientRect(), { width: r, height: i, $: a } = Us(t), o = (a ? Na(n.width) : n.width) / r, s = (a ? Na(n.height) : n.height) / i;
	return (!o || !Number.isFinite(o)) && (o = 1), (!s || !Number.isFinite(s)) && (s = 1), {
		x: o,
		y: s
	};
}
var Ks = /*#__PURE__*/ Fa(0);
function qs(e) {
	let t = tn(e);
	return !_n() || !t.visualViewport ? Ks : {
		x: t.visualViewport.offsetLeft,
		y: t.visualViewport.offsetTop
	};
}
function Js(e, t, n) {
	return t === void 0 && (t = !1), !!n && t && n === tn(e);
}
function Ys(e, t, n, r) {
	t === void 0 && (t = !1), n === void 0 && (n = !1);
	let i = e.getBoundingClientRect(), a = Ws(e), o = Fa(1);
	t && (r ? an(r) && (o = Gs(r)) : o = Gs(e));
	let s = Js(a, n, r) ? qs(a) : Fa(0), c = (i.left + s.x) / o.x, l = (i.top + s.y) / o.y, u = i.width / o.x, d = i.height / o.y;
	if (a && r) {
		let e = tn(a), t = an(r) ? tn(r) : r, n = e, i = wn(n);
		for (; i && t !== n;) {
			let e = Gs(i), t = i.getBoundingClientRect(), r = yn(i), a = t.left + (i.clientLeft + parseFloat(r.paddingLeft)) * e.x, o = t.top + (i.clientTop + parseFloat(r.paddingTop)) * e.y;
			c *= e.x, l *= e.y, u *= e.x, d *= e.y, c += a, l += o, n = tn(i), i = wn(n);
		}
	}
	return ro({
		width: u,
		height: d,
		x: c,
		y: l
	});
}
function Xs(e, t) {
	let n = bn(e).scrollLeft;
	return t ? t.left + n : Ys(nn(e)).left + n;
}
function Zs(e, t) {
	let n = e.getBoundingClientRect();
	return {
		x: n.left + t.scrollLeft - Xs(e, n),
		y: n.top + t.scrollTop
	};
}
function Qs(e) {
	let { elements: t, rect: n, offsetParent: r, strategy: i } = e, a = i === "fixed", o = nn(r), s = t ? un(t.floating) : !1;
	if (r === o || s && a) return n;
	let c = {
		scrollLeft: 0,
		scrollTop: 0
	}, l = Fa(1), u = Fa(0), d = on(r);
	if ((d || !a) && ((en(r) !== "body" || cn(o)) && (c = bn(r)), d)) {
		let e = Ys(r);
		l = Gs(r), u.x = e.x + r.clientLeft, u.y = e.y + r.clientTop;
	}
	let f = o && !d && !a ? Zs(o, c) : Fa(0);
	return {
		width: n.width * l.x,
		height: n.height * l.y,
		x: n.x * l.x - c.scrollLeft * l.x + u.x + f.x,
		y: n.y * l.y - c.scrollTop * l.y + u.y + f.y
	};
}
function $s(e) {
	return e.getClientRects ? Array.from(e.getClientRects()) : [];
}
function ec(e) {
	let t = bn(e), n = e.ownerDocument.body, r = Ma(e.scrollWidth, e.clientWidth, n.scrollWidth, n.clientWidth), i = Ma(e.scrollHeight, e.clientHeight, n.scrollHeight, n.clientHeight), a = -t.scrollLeft + Xs(e), o = -t.scrollTop;
	return yn(n).direction === "rtl" && (a += Ma(e.clientWidth, n.clientWidth) - r), {
		width: r,
		height: i,
		x: a,
		y: o
	};
}
var tc = 25;
function nc(e, t, n) {
	n === void 0 && (n = "viewport");
	let r = n === "layoutViewport", i = tn(e), a = nn(e), o = i.visualViewport, s = a.clientWidth, c = a.clientHeight, l = 0, u = 0;
	if (o) {
		let e = !_n() || t === "fixed";
		r ? e || (l = -o.offsetLeft, u = -o.offsetTop) : (s = o.width, c = o.height, e && (l = o.offsetLeft, u = o.offsetTop));
	}
	if (Xs(a) <= 0) {
		let e = a.ownerDocument, t = e.body, n = getComputedStyle(t), r = e.compatMode === "CSS1Compat" && parseFloat(n.marginLeft) + parseFloat(n.marginRight) || 0, i = Math.abs(a.clientWidth - t.clientWidth - r), o = getComputedStyle(a).scrollbarGutter === "stable both-edges" ? i / 2 : i;
		o <= tc && (s -= o);
	}
	return {
		width: s,
		height: c,
		x: l,
		y: u
	};
}
function rc(e, t) {
	let n = Ys(e, !0, t === "fixed"), r = n.top + e.clientTop, i = n.left + e.clientLeft, a = Gs(e);
	return {
		width: e.clientWidth * a.x,
		height: e.clientHeight * a.y,
		x: i * a.x,
		y: r * a.y
	};
}
function ic(e, t, n) {
	let r;
	if (t === "viewport" || t === "layoutViewport") r = nc(e, n, t);
	else if (t === "document") r = ec(nn(e));
	else if (an(t)) r = rc(t, n);
	else {
		let n = qs(e);
		r = {
			x: t.x - n.x,
			y: t.y - n.y,
			width: t.width,
			height: t.height
		};
	}
	return ro(r);
}
function ac(e, t) {
	let n = t.get(e);
	if (n) return n;
	let r = Cn(e, [], !1).filter((e) => an(e) && en(e) !== "body"), i = null, a = yn(e).position === "fixed", o = a ? xn(e) : e;
	for (; an(o) && !vn(o);) {
		let e = yn(o), t = hn(o), n = i ? i.position : a ? "fixed" : "";
		!t && (n === "fixed" || n === "absolute" && e.position === "static") ? r = r.filter((e) => e !== o) : i = e, o = xn(o);
	}
	return t.set(e, r), r;
}
function oc(e) {
	let { element: t, boundary: n, rootBoundary: r, strategy: i } = e, a = [...n === "clippingAncestors" ? un(t) ? [] : ac(t, this._c) : [].concat(n), r], o = ic(t, a[0], i), s = o.top, c = o.right, l = o.bottom, u = o.left;
	for (let e = 1; e < a.length; e++) {
		let n = ic(t, a[e], i);
		s = Ma(n.top, s), c = ja(n.right, c), l = ja(n.bottom, l), u = Ma(n.left, u);
	}
	return {
		width: c - u,
		height: l - s,
		x: u,
		y: s
	};
}
function sc(e) {
	let { width: t, height: n } = Us(e);
	return {
		width: t,
		height: n
	};
}
function cc(e, t, n) {
	let r = on(t), i = nn(t), a = n === "fixed", o = Ys(e, !0, a, t), s = {
		scrollLeft: 0,
		scrollTop: 0
	}, c = Fa(0);
	if ((r || !a) && ((en(t) !== "body" || cn(i)) && (s = bn(t)), r)) {
		let e = Ys(t, !0, a, t);
		c.x = e.x + t.clientLeft, c.y = e.y + t.clientTop;
	}
	!r && i && (c.x = Xs(i));
	let l = i && !r && !a ? Zs(i, s) : Fa(0);
	return {
		x: o.left + s.scrollLeft - c.x - l.x,
		y: o.top + s.scrollTop - c.y - l.y,
		width: o.width,
		height: o.height
	};
}
function lc(e) {
	return yn(e).position === "static";
}
function uc(e, t) {
	if (!on(e) || yn(e).position === "fixed") return null;
	if (t) return t(e);
	let n = e.offsetParent;
	return nn(e) === n && (n = n.ownerDocument.body), n;
}
function dc(e, t) {
	let n = tn(e);
	if (un(e)) return n;
	if (!on(e)) {
		let t = xn(e);
		for (; t && !vn(t);) {
			if (an(t) && !lc(t)) return t;
			t = xn(t);
		}
		return n;
	}
	let r = uc(e, t);
	for (; r && ln(r) && lc(r);) r = uc(r, t);
	return r && vn(r) && lc(r) && !hn(r) ? n : r || gn(e) || n;
}
var fc = async function(e) {
	let t = this.getOffsetParent || dc, n = this.getDimensions, r = await n(e.floating);
	return {
		reference: cc(e.reference, await t(e.floating), e.strategy),
		floating: {
			x: 0,
			y: 0,
			width: r.width,
			height: r.height
		}
	};
};
function pc(e) {
	return yn(e).direction === "rtl";
}
var mc = {
	convertOffsetParentRelativeRectToViewportRelativeRect: Qs,
	getDocumentElement: nn,
	getClippingRect: oc,
	getOffsetParent: dc,
	getElementRects: fc,
	getClientRects: $s,
	getDimensions: sc,
	getScale: Gs,
	isElement: an,
	isRTL: pc
};
function hc(e, t) {
	return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
}
function gc(e, t, n) {
	let r = null, i, a = nn(e);
	function o() {
		var e;
		clearTimeout(i), (e = r) == null || e.disconnect(), r = null;
	}
	function s(n, c) {
		n === void 0 && (n = !1), c === void 0 && (c = 1), o();
		let l = e.getBoundingClientRect(), { left: u, top: d, width: f, height: p } = l;
		if (n || t(), !f || !p) return;
		let m = Pa(d), h = Pa(a.clientWidth - (u + f)), g = Pa(a.clientHeight - (d + p)), _ = Pa(u), v = {
			rootMargin: -m + "px " + -h + "px " + -g + "px " + -_ + "px",
			threshold: Ma(0, ja(1, c)) || 1
		}, y = !0;
		function b(t) {
			let n = t[0].intersectionRatio;
			if (!hc(l, e.getBoundingClientRect())) return s();
			if (n !== c) {
				if (!y) return s();
				n ? s(!1, n) : i = setTimeout(() => {
					s(!1, 1e-7);
				}, 1e3);
			}
			y = !1;
		}
		try {
			r = new IntersectionObserver(b, {
				...v,
				root: a.ownerDocument
			});
		} catch {
			r = new IntersectionObserver(b, v);
		}
		r.observe(e);
	}
	let c = tn(e), l = () => s(n);
	return c.addEventListener("resize", l), s(!0), () => {
		c.removeEventListener("resize", l), o();
	};
}
function _c(e, t, n, r) {
	r === void 0 && (r = {});
	let { ancestorScroll: i = !0, ancestorResize: a = !0, elementResize: o = typeof ResizeObserver == "function", layoutShift: s = typeof IntersectionObserver == "function", animationFrame: c = !1 } = r, l = Ws(e), u = i || a ? [...l ? Cn(l) : [], ...t ? Cn(t) : []] : [];
	u.forEach((e) => {
		i && e.addEventListener("scroll", n), a && e.addEventListener("resize", n);
	});
	let d = l && s ? gc(l, n, a) : null, f = -1, p = null;
	o && (p = new ResizeObserver((e) => {
		let [r] = e;
		r && r.target === l && p && t && (p.unobserve(t), cancelAnimationFrame(f), f = requestAnimationFrame(() => {
			var e;
			(e = p) == null || e.observe(t);
		})), n();
	}), l && !c && p.observe(l), t && p.observe(t));
	let m, h = c ? Ys(e) : null;
	c && g();
	function g() {
		let t = Ys(e);
		h && !hc(h, t) && n(), h = t, m = requestAnimationFrame(g);
	}
	return n(), () => {
		var e;
		u.forEach((e) => {
			i && e.removeEventListener("scroll", n), a && e.removeEventListener("resize", n);
		}), d?.(), (e = p) == null || e.disconnect(), p = null, c && cancelAnimationFrame(m);
	};
}
var vc = zs, yc = Bs, bc = Is, xc = Hs, Sc = Vs, Cc = (e, t, n) => {
	let r = /* @__PURE__ */ new Map(), i = n ?? {}, a = {
		...mc,
		...i.platform,
		_c: r
	};
	return Fs(e, t, {
		...i,
		platform: a
	});
}, wc = typeof document < "u" ? o : function() {};
function Tc(e, t) {
	if (e === t) return !0;
	if (typeof e != typeof t) return !1;
	if (typeof e == "function" && e.toString() === t.toString()) return !0;
	let n, r, i;
	if (e && t && typeof e == "object") {
		if (Array.isArray(e)) {
			if (n = e.length, n !== t.length) return !1;
			for (r = n; r-- !== 0;) if (!Tc(e[r], t[r])) return !1;
			return !0;
		}
		if (i = Object.keys(e), n = i.length, n !== Object.keys(t).length) return !1;
		for (r = n; r-- !== 0;) if (!{}.hasOwnProperty.call(t, i[r])) return !1;
		for (r = n; r-- !== 0;) {
			let n = i[r];
			if (!(n === "_owner" && e.$$typeof) && !Tc(e[n], t[n])) return !1;
		}
		return !0;
	}
	return e !== e && t !== t;
}
function Ec(e) {
	return typeof window > "u" ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function Dc(e, t) {
	let n = Ec(e);
	return Math.round(t * n) / n;
}
function Oc(t) {
	let n = e.useRef(t);
	return wc(() => {
		n.current = t;
	}), n;
}
function kc(t) {
	t === void 0 && (t = {});
	let { placement: n = "bottom", strategy: r = "absolute", middleware: i = [], platform: a, elements: { reference: o, floating: s } = {}, transform: c = !0, whileElementsMounted: u, open: d } = t, [f, p] = e.useState({
		x: 0,
		y: 0,
		strategy: r,
		placement: n,
		middlewareData: {},
		isPositioned: !1
	}), [m, h] = e.useState(i);
	Tc(m, i) || h(i);
	let [g, _] = e.useState(null), [v, y] = e.useState(null), b = e.useCallback((e) => {
		e !== w.current && (w.current = e, _(e));
	}, []), x = e.useCallback((e) => {
		e !== T.current && (T.current = e, y(e));
	}, []), S = o || g, C = s || v, w = e.useRef(null), T = e.useRef(null), E = e.useRef(f), D = u != null, O = Oc(u), k = Oc(a), A = Oc(d), j = e.useCallback(() => {
		if (!w.current || !T.current) return;
		let e = {
			placement: n,
			strategy: r,
			middleware: m
		};
		k.current && (e.platform = k.current), Cc(w.current, T.current, e).then((e) => {
			let t = {
				...e,
				isPositioned: A.current !== !1
			};
			M.current && !Tc(E.current, t) && (E.current = t, l.flushSync(() => {
				p(t);
			}));
		});
	}, [
		m,
		n,
		r,
		k,
		A
	]);
	wc(() => {
		d === !1 && E.current.isPositioned && (E.current.isPositioned = !1, p((e) => ({
			...e,
			isPositioned: !1
		})));
	}, [d]);
	let M = e.useRef(!1);
	wc(() => (M.current = !0, () => {
		M.current = !1;
	}), []), wc(() => {
		if (S && (w.current = S), C && (T.current = C), S && C) {
			if (O.current) return O.current(S, C, j);
			j();
		}
	}, [
		S,
		C,
		j,
		O,
		D
	]);
	let N = e.useMemo(() => ({
		reference: w,
		floating: T,
		setReference: b,
		setFloating: x
	}), [b, x]), P = e.useMemo(() => ({
		reference: S,
		floating: C
	}), [S, C]), F = e.useMemo(() => {
		let e = {
			position: r,
			left: 0,
			top: 0
		};
		if (!P.floating) return e;
		let t = Dc(P.floating, f.x), n = Dc(P.floating, f.y);
		return c ? {
			...e,
			transform: "translate(" + t + "px, " + n + "px)",
			...Ec(P.floating) >= 1.5 && { willChange: "transform" }
		} : {
			position: r,
			left: t,
			top: n
		};
	}, [
		r,
		c,
		P.floating,
		f.x,
		f.y
	]);
	return e.useMemo(() => ({
		...f,
		update: j,
		refs: N,
		elements: P,
		floatingStyles: F
	}), [
		f,
		j,
		N,
		P,
		F
	]);
}
var Ac = (e, t) => {
	let n = vc(e);
	return {
		name: n.name,
		fn: n.fn,
		options: [e, t]
	};
}, jc = (e, t) => {
	let n = yc(e);
	return {
		name: n.name,
		fn: n.fn,
		options: [e, t]
	};
}, Mc = (e, t) => ({
	fn: Sc(e).fn,
	options: [e, t]
}), Nc = (e, t) => {
	let n = bc(e);
	return {
		name: n.name,
		fn: n.fn,
		options: [e, t]
	};
}, Pc = (e, t) => {
	let n = xc(e);
	return {
		name: n.name,
		fn: n.fn,
		options: [e, t]
	};
}, Fc = /* @__PURE__ */ u(((e) => {
	var t = d("react");
	function n(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var r = typeof Object.is == "function" ? Object.is : n, i = t.useState, a = t.useEffect, o = t.useLayoutEffect, s = t.useDebugValue;
	function c(e, t) {
		var n = t(), r = i({ inst: {
			value: n,
			getSnapshot: t
		} }), c = r[0].inst, u = r[1];
		return o(function() {
			c.value = n, c.getSnapshot = t, l(c) && u({ inst: c });
		}, [
			e,
			n,
			t
		]), a(function() {
			return l(c) && u({ inst: c }), e(function() {
				l(c) && u({ inst: c });
			});
		}, [e]), s(n), n;
	}
	function l(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !r(e, n);
		} catch {
			return !0;
		}
	}
	function u(e, t) {
		return t();
	}
	var f = typeof window > "u" || window.document === void 0 || window.document.createElement === void 0 ? u : c;
	e.useSyncExternalStore = t.useSyncExternalStore === void 0 ? f : t.useSyncExternalStore;
})), Ic = /* @__PURE__ */ u(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e, t) {
			return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
		}
		function n(e, t) {
			f || a.startTransition === void 0 || (f = !0, console.error("You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."));
			var n = t();
			if (!p) {
				var i = t();
				o(n, i) || (console.error("The result of getSnapshot should be cached to avoid an infinite loop"), p = !0);
			}
			i = s({ inst: {
				value: n,
				getSnapshot: t
			} });
			var d = i[0].inst, m = i[1];
			return l(function() {
				d.value = n, d.getSnapshot = t, r(d) && m({ inst: d });
			}, [
				e,
				n,
				t
			]), c(function() {
				return r(d) && m({ inst: d }), e(function() {
					r(d) && m({ inst: d });
				});
			}, [e]), u(n), n;
		}
		function r(e) {
			var t = e.getSnapshot;
			e = e.value;
			try {
				var n = t();
				return !o(e, n);
			} catch {
				return !0;
			}
		}
		function i(e, t) {
			return t();
		}
		typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var a = d("react"), o = typeof Object.is == "function" ? Object.is : t, s = a.useState, c = a.useEffect, l = a.useLayoutEffect, u = a.useDebugValue, f = !1, p = !1, m = typeof window > "u" || window.document === void 0 || window.document.createElement === void 0 ? i : n;
		e.useSyncExternalStore = a.useSyncExternalStore === void 0 ? m : a.useSyncExternalStore, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
})), Lc = /* @__PURE__ */ u(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? Fc() : Ic();
})), Rc = /* @__PURE__ */ u(((e) => {
	var t = d("react"), n = Lc();
	function r(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var i = typeof Object.is == "function" ? Object.is : r, a = n.useSyncExternalStore, o = t.useRef, s = t.useEffect, c = t.useMemo, l = t.useDebugValue;
	e.useSyncExternalStoreWithSelector = function(e, t, n, r, u) {
		var d = o(null);
		if (d.current === null) {
			var f = {
				hasValue: !1,
				value: null
			};
			d.current = f;
		} else f = d.current;
		d = c(function() {
			function e(e) {
				if (!a) {
					if (a = !0, o = e, e = r(e), u !== void 0 && f.hasValue) {
						var t = f.value;
						if (u(t, e)) return s = t;
					}
					return s = e;
				}
				if (t = s, i(o, e)) return t;
				var n = r(e);
				return u !== void 0 && u(t, n) ? (o = e, t) : (o = e, s = n);
			}
			var a = !1, o, s, c = n === void 0 ? null : n;
			return [function() {
				return e(t());
			}, c === null ? void 0 : function() {
				return e(c());
			}];
		}, [
			t,
			n,
			r,
			u
		]);
		var p = a(e, d[0], d[1]);
		return s(function() {
			f.hasValue = !0, f.value = p;
		}, [p]), l(p), p;
	};
})), zc = /* @__PURE__ */ u(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e, t) {
			return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
		}
		typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var n = d("react"), r = Lc(), i = typeof Object.is == "function" ? Object.is : t, a = r.useSyncExternalStore, o = n.useRef, s = n.useEffect, c = n.useMemo, l = n.useDebugValue;
		e.useSyncExternalStoreWithSelector = function(e, t, n, r, u) {
			var d = o(null);
			if (d.current === null) {
				var f = {
					hasValue: !1,
					value: null
				};
				d.current = f;
			} else f = d.current;
			d = c(function() {
				function e(e) {
					if (!a) {
						if (a = !0, o = e, e = r(e), u !== void 0 && f.hasValue) {
							var t = f.value;
							if (u(t, e)) return s = t;
						}
						return s = e;
					}
					if (t = s, i(o, e)) return t;
					var n = r(e);
					return u !== void 0 && u(t, n) ? (o = e, t) : (o = e, s = n);
				}
				var a = !1, o, s, c = n === void 0 ? null : n;
				return [function() {
					return e(t());
				}, c === null ? void 0 : function() {
					return e(c());
				}];
			}, [
				t,
				n,
				r,
				u
			]);
			var p = a(e, d[0], d[1]);
			return s(function() {
				f.hasValue = !0, f.value = p;
			}, [p]), l(p), p;
		}, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
})), Bc = /* @__PURE__ */ u(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? Rc() : zc();
})), Vc = [], Hc = void 0;
function Uc() {
	return Hc;
}
function Wc(e) {
	Vc.push(e);
}
function Gc(e) {
	let t = (t, n) => {
		let r = Ct(qc).current, i;
		try {
			Hc = r;
			for (let e of Vc) e.before(r);
			i = e(t, n);
			for (let e of Vc) e.after(r);
			r.didInitialize = !0;
		} finally {
			Hc = void 0;
		}
		return i;
	};
	return t.displayName = e.displayName || e.name, t;
}
function Kc(t) {
	return /*#__PURE__*/ e.forwardRef(Gc(t));
}
function qc() {
	return { didInitialize: !1 };
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/store/useStore.mjs
var Jc = Lc(), Yc = Bc(), Xc = jt(19) ? $c : el;
function Zc(e, t, n, r, i) {
	return Xc(e, t, n, r, i);
}
function Qc(t, n, r, i, a) {
	let o = e.useCallback(() => n(t.getSnapshot(), r, i, a), [
		t,
		n,
		r,
		i,
		a
	]);
	return (0, Jc.useSyncExternalStore)(t.subscribe, o, o);
}
Wc({
	before(e) {
		e.syncIndex = 0, e.didInitialize || (e.syncTick = 1, e.syncHooks = [], e.didChangeStore = !0, e.getSnapshot = () => {
			let t = !1;
			for (let n = 0; n < e.syncHooks.length; n += 1) {
				let r = e.syncHooks[n], i = r.selector(r.store.state, r.a1, r.a2, r.a3);
				Object.is(r.value, i) || (t = !0, r.value = i);
			}
			return t && (e.syncTick += 1), e.syncTick;
		});
	},
	after(e) {
		e.syncHooks.length > 0 && (e.didChangeStore && (e.didChangeStore = !1, e.subscribe = (t) => {
			let n = /* @__PURE__ */ new Set();
			for (let t of e.syncHooks) n.add(t.store);
			let r = [];
			for (let e of n) r.push(e.subscribe(t));
			return () => {
				for (let e of r) e();
			};
		}), (0, Jc.useSyncExternalStore)(e.subscribe, e.getSnapshot, e.getSnapshot));
	}
});
function $c(e, t, n, r, i) {
	let a = Uc();
	if (!a) return Qc(e, t, n, r, i);
	let o = a.syncIndex;
	a.syncIndex += 1;
	let s;
	return a.didInitialize ? (s = a.syncHooks[o], (s.store !== e || s.selector !== t || !Object.is(s.a1, n) || !Object.is(s.a2, r) || !Object.is(s.a3, i)) && (s.store !== e && (a.didChangeStore = !0), s.store = e, s.selector = t, s.a1 = n, s.a2 = r, s.a3 = i, s.value = t(e.getSnapshot(), n, r, i))) : (s = {
		store: e,
		selector: t,
		a1: n,
		a2: r,
		a3: i,
		value: t(e.getSnapshot(), n, r, i)
	}, a.syncHooks.push(s)), s.value;
}
function el(e, t, n, r, i) {
	return (0, Yc.useSyncExternalStoreWithSelector)(e.subscribe, e.getSnapshot, e.getSnapshot, (e) => t(e, n, r, i));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/store/Store.mjs
var tl = class {
	constructor(e) {
		this.state = e, this.listeners = /* @__PURE__ */ new Set(), this.updateTick = 0;
	}
	subscribe = (e) => (this.listeners.add(e), () => {
		this.listeners.delete(e);
	});
	getSnapshot = () => this.state;
	setState(e) {
		if (this.state === e) return;
		this.state = e, this.updateTick += 1;
		let t = this.updateTick;
		for (let n of this.listeners) {
			if (t !== this.updateTick) return;
			n(e);
		}
	}
	update(e) {
		for (let t in e) if (!Object.is(this.state[t], e[t])) {
			this.setState({
				...this.state,
				...e
			});
			return;
		}
	}
	set(e, t) {
		Object.is(this.state[e], t) || this.setState({
			...this.state,
			[e]: t
		});
	}
	notifyAll() {
		let e = { ...this.state };
		this.setState(e);
	}
	use(e, t, n, r) {
		return Zc(this, e, t, n, r);
	}
}, nl = class extends tl {
	constructor(e, t = {}, n) {
		super(e), this.context = t, this.selectors = n;
	}
	useSyncedValue(t, n) {
		e.useDebugValue(t);
		let r = this;
		Z(() => {
			r.state[t] !== n && r.set(t, n);
		}, [
			r,
			t,
			n
		]);
	}
	useSyncedValueWithCleanup(e, t) {
		let n = this;
		Z(() => (n.state[e] !== t && n.set(e, t), () => {
			n.set(e, void 0);
		}), [
			n,
			e,
			t
		]);
	}
	useSyncedValues(t) {
		let n = this;
		if (process.env.NODE_ENV !== "production") {
			e.useDebugValue(t, (e) => Object.keys(e));
			let n = e.useRef(Object.keys(t)).current, r = Object.keys(t);
			(n.length !== r.length || n.some((e, t) => e !== r[t])) && console.error("ReactStore.useSyncedValues expects the same prop keys on every render. Keys should be stable.");
		}
		Z(() => {
			n.update(t);
		}, [n, ...Object.values(t)]);
	}
	useControlledProp(t, n) {
		e.useDebugValue(t);
		let r = this, i = n !== void 0;
		if (Z(() => {
			i && !Object.is(r.state[t], n) && r.setState({
				...r.state,
				[t]: n
			});
		}, [
			r,
			t,
			n,
			i
		]), process.env.NODE_ENV !== "production") {
			let e = this.controlledValues ??= /* @__PURE__ */ new Map();
			e.has(t) || e.set(t, i);
			let n = e.get(t);
			n !== void 0 && n !== i && console.error(`A component is changing the ${i ? "" : "un"}controlled state of ${t.toString()} to be ${i ? "un" : ""}controlled. Elements should not switch from uncontrolled to controlled (or vice versa).`);
		}
	}
	select(e, t, n, r) {
		let i = this.selectors[e];
		return i(this.state, t, n, r);
	}
	useState(t, n, r, i) {
		return e.useDebugValue(t), Zc(this, this.selectors[t], n, r, i);
	}
	useContextCallback(t, n) {
		e.useDebugValue(t);
		let r = X(n ?? Ft);
		this.context[t] = r;
	}
	useStateSetter(t) {
		let n = e.useRef(void 0);
		return n.current === void 0 && (n.current = (e) => {
			this.set(t, e);
		}), n.current;
	}
	observe(e, t) {
		let n;
		n = typeof e == "function" ? e : this.selectors[e];
		let r = n(this.state);
		return t(r, r, this), this.subscribe((e) => {
			let i = n(e);
			if (!Object.is(r, i)) {
				let e = r;
				r = i, t(i, e, this);
			}
		});
	}
}, rl = {
	open: (e) => e.open,
	transitionStatus: (e) => e.transitionStatus,
	domReferenceElement: (e) => e.domReferenceElement,
	referenceElement: (e) => e.positionReference ?? e.referenceElement,
	floatingElement: (e) => e.floatingElement,
	floatingId: (e) => e.floatingId
}, il = class extends nl {
	constructor(e) {
		let { syncOnly: t, nested: n, onOpenChange: r, triggerElements: i, ...a } = e;
		super({
			...a,
			positionReference: a.referenceElement,
			domReferenceElement: a.referenceElement
		}, {
			onOpenChange: r,
			dataRef: { current: {} },
			events: us(),
			nested: n,
			triggerElements: i
		}, rl), this.syncOnly = t;
	}
	syncOpenEvent = (e, t) => {
		(!e || !this.state.open || t != null && aa(t)) && (this.context.dataRef.current.openEvent = e ? t : void 0);
	};
	dispatchOpenChange = (e, t) => {
		this.syncOpenEvent(e, t.event);
		let n = {
			open: e,
			reason: t.reason,
			nativeEvent: t.event,
			nested: this.context.nested,
			triggerElement: t.trigger
		};
		this.context.events.emit("openchange", n);
	};
	setOpen = (e, t) => {
		if (this.syncOnly) {
			this.context.onOpenChange?.(e, t);
			return;
		}
		this.dispatchOpenChange(e, t), this.context.onOpenChange?.(e, t);
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useSyncedFloatingRootContext.mjs
function al(t) {
	let { popupStore: n, treatPopupAsFloatingElement: r = !1, floatingRootContext: i, floatingId: a, nested: o, onOpenChange: s } = t, c = n.useState("open"), l = n.useState("activeTriggerElement"), u = n.useState(r ? "popupElement" : "positionerElement"), d = n.context.triggerElements, f = s, p = e.useRef(null);
	i === void 0 && p.current === null && (p.current = new il({
		open: c,
		transitionStatus: void 0,
		referenceElement: l,
		floatingElement: u,
		triggerElements: d,
		onOpenChange: f,
		floatingId: a,
		syncOnly: !0,
		nested: o
	}));
	let m = i ?? p.current;
	return n.useSyncedValue("floatingId", a), Z(() => {
		let e = {
			open: c,
			floatingId: a,
			referenceElement: l,
			floatingElement: u
		};
		an(l) && (e.domReferenceElement = l), m.state.positionReference === m.state.referenceElement && (e.positionReference = l), m.update(e);
	}, [
		c,
		a,
		l,
		u,
		m
	]), m.context.onOpenChange = f, m.context.nested = o, m;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/popups/popupStoreUtils.mjs
var ol = {
	tabIndex: -1,
	[oa]: ""
};
function sl(e) {
	return (t) => t !== "touch" || e.current;
}
function cl(e, t = !1) {
	let n = dr(), r = ms() != null, i = Ct(() => e(n, r)).current;
	return al({
		popupStore: i,
		treatPopupAsFloatingElement: t,
		floatingRootContext: i.state.floatingRootContext,
		floatingId: n,
		nested: r,
		onOpenChange: i.setOpen
	}), i;
}
function ll({ handle: e, store: t }) {
	return Z(() => e.attachStore(t), [e, t]), null;
}
function ul(t, n) {
	let r = e.useRef(null), i = e.useRef(null);
	return e.useCallback((e) => {
		if (t === void 0) return;
		let a = !1;
		if (r.current !== null) {
			let e = r.current, t = i.current, o = n.context.triggerElements.getById(e);
			t && o === t && (n.context.triggerElements.delete(e), a = !0), r.current = null, i.current = null;
		}
		if (e !== null && (r.current = t, i.current = e, n.context.triggerElements.add(t, e), a = !0), a) {
			let e = n.context.triggerElements.size;
			n.select("open") && n.state.triggerCount !== e && n.set("triggerCount", e);
		}
	}, [n, t]);
}
function dl(e, t, n, r = !1) {
	t ? e.preventUnmountingOnClose = !1 : r && (e.preventUnmountingOnClose = !0);
	let i = n?.id ?? null;
	(i || t) && (e.activeTriggerId = i, e.activeTriggerElement = n ?? null);
}
function fl(e) {
	let t = !1;
	return e.preventUnmountOnClose = () => {
		t = !0;
	}, () => t;
}
function pl(t, n, r, i) {
	let a = r.useState("isMountedByTrigger", t), o = ul(t, r), s = X((e) => {
		let n = r.select("open"), a = r.select("activeTriggerId");
		if (a === t) {
			r.update({
				activeTriggerElement: e,
				...n ? i : null
			});
			return;
		}
		a == null && n && r.update({
			activeTriggerId: t,
			activeTriggerElement: e,
			...i
		});
	}), c = e.useCallback((e) => {
		o(e), e && s(e);
	}, [o, s]);
	return Z(() => {
		a && r.update({
			activeTriggerElement: n.current,
			...i
		});
	}, [
		a,
		r,
		n,
		...Object.values(i)
	]), {
		registerTrigger: c,
		isMountedByThisTrigger: a
	};
}
function ml(t, n = {}) {
	let { closeOnActiveTriggerUnmount: r = !1 } = n, i = e.useRef(null), a = t.useState("open");
	Z(() => {
		if (!a) {
			i.current = null, t.state.triggerCount !== 0 && t.set("triggerCount", 0);
			return;
		}
		let e = t.context.triggerElements.size, n = {};
		t.state.triggerCount !== e && (n.triggerCount = e);
		let o = t.select("activeTriggerId"), s = null;
		if (o) {
			let e = t.context.triggerElements.getById(o);
			if (e) i.current = o, e !== t.state.activeTriggerElement && (n.activeTriggerElement = e);
			else {
				for (let [e, r] of t.context.triggerElements.entries()) if (r === t.state.activeTriggerElement) {
					n.activeTriggerId = e, n.activeTriggerElement = r, i.current = e;
					break;
				}
				n.activeTriggerId === void 0 && (i.current === o ? s = o : i.current = null);
			}
		} else i.current = null;
		if (!s && !o && e === 1) {
			let e = t.context.triggerElements.entries().next();
			if (!e.done) {
				let [t, r] = e.value;
				n.activeTriggerId = t, n.activeTriggerElement = r, i.current = t;
			}
		}
		(n.triggerCount !== void 0 || n.activeTriggerId !== void 0 || n.activeTriggerElement !== void 0) && t.update(n), s && r && queueMicrotask(() => {
			if (t.select("open") && t.select("activeTriggerId") === s && !t.context.triggerElements.getById(s)) {
				let e = Ur(Ar);
				t.setOpen(!1, e), e.isCanceled || t.update({
					activeTriggerId: null,
					activeTriggerElement: null
				});
			}
		});
	}, [
		a,
		t,
		t.useState("triggerCount"),
		t.useState("activeTriggerId"),
		t.useState("activeTriggerElement"),
		r
	]);
}
function hl(e, t, n) {
	let { mounted: r, setMounted: i, transitionStatus: a } = ni(e), o = t.useState("preventUnmountingOnClose"), s = !e && o;
	t.useSyncedValues({
		mounted: r,
		transitionStatus: a,
		preventUnmountingOnClose: s
	});
	let c = X(() => {
		i(!1), t.update({
			activeTriggerId: null,
			activeTriggerElement: null,
			mounted: !1,
			preventUnmountingOnClose: !1
		}), n?.(), t.context.onOpenChangeComplete?.(!1);
	});
	return ti({
		enabled: r && !e && !s,
		open: e,
		ref: t.context.popupRef,
		onComplete() {
			e || c();
		}
	}), {
		forceUnmount: c,
		transitionStatus: a
	};
}
function gl(e, t) {
	e.useSyncedValues(t), Z(() => () => {
		e.update({
			activeTriggerProps: Lt,
			inactiveTriggerProps: Lt,
			popupProps: Lt
		});
	}, [e]);
}
function _l(e, t) {
	Z(() => {
		!t && e.state.openMethod !== null && e.set("openMethod", null);
	}, [t, e]), Z(() => () => {
		e.state.openMethod !== null && e.set("openMethod", null);
	}, [e]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/popups/popupTriggerMap.mjs
var vl;
function yl(e) {
	vl ??= /* @__PURE__ */ new WeakMap();
	let t = vl.get(e);
	return t || (t = /* @__PURE__ */ new WeakMap(), vl.set(e, t)), t;
}
var bl = class {
	constructor() {
		this.idMap = /* @__PURE__ */ new Map();
	}
	add(e, t) {
		if (process.env.NODE_ENV !== "production") {
			let n = yl(this), r = n.get(t);
			if (r !== void 0 && r !== e) throw Error("Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.");
			let i = this.idMap.get(e);
			i !== void 0 && i !== t && n.delete(i), n.set(t, e);
		}
		this.idMap.set(e, t);
	}
	delete(e) {
		if (process.env.NODE_ENV !== "production") {
			let t = this.idMap.get(e);
			t !== void 0 && vl?.get(this)?.delete(t);
		}
		this.idMap.delete(e);
	}
	hasElement(e) {
		for (let t of this.idMap.values()) if (t === e) return !0;
		return !1;
	}
	hasMatchingElement(e) {
		for (let t of this.idMap.values()) if (e(t)) return !0;
		return !1;
	}
	getById(e) {
		return this.idMap.get(e);
	}
	entries() {
		return this.idMap.entries();
	}
	elements() {
		return this.idMap.values();
	}
	get size() {
		return this.idMap.size;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/utils/getEmptyRootContext.mjs
function xl() {
	return new il({
		open: !1,
		transitionStatus: void 0,
		floatingElement: null,
		referenceElement: null,
		triggerElements: new bl(),
		floatingId: void 0,
		syncOnly: !1,
		nested: !1,
		onOpenChange: void 0
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/popups/store.mjs
function Sl() {
	return {
		open: !1,
		openProp: void 0,
		mounted: !1,
		transitionStatus: void 0,
		floatingRootContext: xl(),
		floatingId: void 0,
		triggerCount: 0,
		preventUnmountingOnClose: !1,
		payload: void 0,
		activeTriggerId: null,
		activeTriggerElement: null,
		triggerIdProp: void 0,
		popupElement: null,
		positionerElement: null,
		activeTriggerProps: Lt,
		inactiveTriggerProps: Lt,
		popupProps: Lt
	};
}
function Cl(e, t, n = !1) {
	return new il({
		open: !1,
		transitionStatus: void 0,
		floatingElement: null,
		referenceElement: null,
		triggerElements: e,
		floatingId: t,
		syncOnly: !0,
		nested: n,
		onOpenChange: void 0
	});
}
var wl = (e) => e.triggerIdProp ?? e.activeTriggerId, Tl = (e) => e.openProp ?? e.open, El = (e) => (e.popupElement?.id ?? e.floatingId) || void 0;
function Dl(e, t) {
	return t !== void 0 && Tl(e) && wl(e) === t;
}
function Ol(e, t) {
	return Dl(e, t) ? !0 : t !== void 0 && Tl(e) && wl(e) == null && e.triggerCount === 1;
}
var kl = {
	open: Tl,
	mounted: (e) => e.mounted,
	transitionStatus: (e) => e.transitionStatus,
	floatingRootContext: (e) => e.floatingRootContext,
	triggerCount: (e) => e.triggerCount,
	preventUnmountingOnClose: (e) => e.preventUnmountingOnClose,
	payload: (e) => e.payload,
	activeTriggerId: wl,
	activeTriggerElement: (e) => e.mounted ? e.activeTriggerElement : null,
	popupId: El,
	isTriggerActive: (e, t) => t !== void 0 && wl(e) === t,
	isOpenedByTrigger: (e, t) => Dl(e, t),
	isMountedByTrigger: (e, t) => t !== void 0 && wl(e) === t && e.mounted,
	triggerProps: (e, t) => t ? e.activeTriggerProps : e.inactiveTriggerProps,
	triggerPopupId: (e, t) => Ol(e, t) ? El(e) : void 0,
	popupProps: (e) => e.popupProps,
	popupElement: (e) => e.popupElement,
	positionerElement: (e) => e.positionerElement
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/popups/usePopupHandleStore.mjs
function Al(t) {
	let n = e.useCallback((e) => t === void 0 ? Ft : t.subscribeStore(e), [t]), r = e.useCallback(() => t === void 0 ? void 0 : t.store, [t]);
	return (0, Jc.useSyncExternalStore)(n, r, () => t?.serverStore);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useFloating.mjs
function jl(e) {
	return Ml(e, e.rootContext);
}
function Ml(t, n) {
	let { nodeId: r, externalTree: i } = t, a = n.useState("referenceElement"), o = n.useState("floatingElement"), s = n.useState("domReferenceElement"), c = n.useState("open"), l = n.useState("floatingId"), [u, d] = e.useState(null), [f, p] = e.useState(void 0), [m, h] = e.useState(void 0), g = e.useRef(null), _ = hs(i), v = e.useMemo(() => ({
		reference: a,
		floating: o,
		domReference: s
	}), [
		a,
		o,
		s
	]), y = kc({
		...t,
		elements: {
			...v,
			...u && { reference: u }
		}
	}), b = an(f) ? f : null, x = m === void 0 ? n.state.floatingElement : m;
	n.useSyncedValue("referenceElement", f ?? null), n.useSyncedValue("domReferenceElement", f === void 0 ? s : b), n.useSyncedValue("floatingElement", x);
	let S = e.useCallback((e) => {
		let t = an(e) ? {
			getBoundingClientRect: () => e.getBoundingClientRect(),
			getClientRects: () => e.getClientRects(),
			contextElement: e
		} : e;
		d(t), y.refs.setReference(t);
	}, [y.refs]), C = e.useCallback((e) => {
		(an(e) || e === null) && (g.current = e, p(e)), (an(y.refs.reference.current) || y.refs.reference.current === null || e !== null && !an(e)) && y.refs.setReference(e);
	}, [y.refs, p]), w = e.useCallback((e) => {
		h(e), y.refs.setFloating(e);
	}, [y.refs]), T = e.useMemo(() => ({
		...y.refs,
		setReference: C,
		setFloating: w,
		setPositionReference: S,
		domReference: g
	}), [
		y.refs,
		C,
		w,
		S
	]), E = e.useMemo(() => ({
		...y.elements,
		domReference: s
	}), [y.elements, s]), D = e.useMemo(() => ({
		...y,
		dataRef: n.context.dataRef,
		open: c,
		onOpenChange: n.setOpen,
		events: n.context.events,
		floatingId: l,
		refs: T,
		elements: E,
		nodeId: r,
		rootStore: n
	}), [
		y,
		T,
		E,
		r,
		n,
		c,
		l
	]);
	return Z(() => {
		s && (g.current = s);
	}, [s]), Z(() => {
		n.context.dataRef.current.floatingContext = D;
		let e = _?.nodesRef.current.find((e) => e.id === r);
		e && (e.context = D);
	}), e.useMemo(() => ({
		...y,
		context: D,
		refs: T,
		elements: E,
		rootStore: n
	}), [
		y,
		T,
		E,
		D,
		n
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useFocus.mjs
var Nl = Yi && Zi;
function Pl(t, n = {}) {
	let { enabled: r = !0, delay: i } = n, a = "rootStore" in t ? t.rootStore : t, { events: o, dataRef: s } = a.context, c = e.useRef(!1), l = e.useRef(null), u = e.useRef(!0), d = zi();
	e.useEffect(() => {
		let e = a.select("domReferenceElement");
		if (!r) return;
		let t = tn(e);
		function n() {
			let e = a.select("domReferenceElement");
			!a.select("open") && on(e) && e === fa(Fn(e)) && (c.current = !0);
		}
		function i() {
			u.current = !0;
		}
		function o() {
			u.current = !1;
		}
		return Da($(t, "blur", n), Nl && $(t, "keydown", i, !0), Nl && $(t, "pointerdown", o, !0));
	}, [a, r]), e.useEffect(() => {
		if (!r) return;
		function e(e) {
			if (e.reason === "trigger-press" || e.reason === "escape-key") {
				let e = a.select("domReferenceElement");
				an(e) && (l.current = e, c.current = !0);
			}
		}
		return o.on("openchange", e), () => {
			o.off("openchange", e);
		};
	}, [
		o,
		r,
		a
	]);
	let f = e.useMemo(() => {
		function e() {
			c.current = !1, l.current = null;
		}
		return {
			onMouseLeave() {
				e();
			},
			onFocus(t) {
				let n = t.currentTarget;
				if (c.current) {
					if (l.current === n) return;
					e();
				}
				let r = pa(t.nativeEvent);
				if (an(r)) {
					if (Nl && !t.relatedTarget) {
						if (!u.current && !_a(r)) return;
					} else if (!ba(r)) return;
				}
				let o = ma(t.relatedTarget, a.context.triggerElements), { nativeEvent: s, currentTarget: f } = t, p = typeof i == "function" ? i() : i;
				if (a.select("open") && o || p === 0 || p === void 0) {
					a.setOpen(!0, Ur(Nr, s, f));
					return;
				}
				d.start(p, () => {
					c.current || a.setOpen(!0, Ur(Nr, s, f));
				});
			},
			onBlur(t) {
				e();
				let n = t.relatedTarget, r = t.nativeEvent, i = an(n) && n.hasAttribute(zo("focus-guard")) && n.getAttribute("data-type") === "outside";
				d.start(0, () => {
					let e = a.select("domReferenceElement"), t = fa(Fn(e));
					!n && t === e || Q(s.current.floatingContext?.refs.floating.current, t) || Q(e, t) || i || ma(n ?? t, a.context.triggerElements) || a.setOpen(!1, Ur(Nr, r));
				});
			}
		};
	}, [
		s,
		i,
		a,
		d
	]);
	return e.useMemo(() => r ? {
		reference: f,
		trigger: f
	} : {}, [r, f]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverInteractionSharedState.mjs
var Fl = class e {
	constructor() {
		this.pointerType = void 0, this.interactedInside = !1, this.handler = void 0, this.blockMouseMove = !0, this.performedPointerEventsMutation = !1, this.pointerEventsScopeElement = null, this.pointerEventsReferenceElement = null, this.pointerEventsFloatingElement = null, this.restTimeoutPending = !1, this.openChangeTimeout = new Ri(), this.restTimeout = new Ri(), this.handleCloseOptions = void 0;
	}
	static create() {
		return new e();
	}
	dispose = () => {
		this.openChangeTimeout.clear(), this.restTimeout.clear();
	};
	disposeEffect = () => this.dispose;
}, Il = /* @__PURE__ */ new WeakMap();
function Ll(e) {
	if (!e.performedPointerEventsMutation) return;
	let t = e.pointerEventsScopeElement;
	t && Il.get(t) === e && (e.pointerEventsScopeElement?.style.removeProperty("pointer-events"), e.pointerEventsReferenceElement?.style.removeProperty("pointer-events"), e.pointerEventsFloatingElement?.style.removeProperty("pointer-events"), Il.delete(t)), e.performedPointerEventsMutation = !1, e.pointerEventsScopeElement = null, e.pointerEventsReferenceElement = null, e.pointerEventsFloatingElement = null;
}
function Rl(e, t) {
	let { scopeElement: n, referenceElement: r, floatingElement: i } = t, a = Il.get(n);
	a && a !== e && Ll(a), Ll(e), e.performedPointerEventsMutation = !0, e.pointerEventsScopeElement = n, e.pointerEventsReferenceElement = r, e.pointerEventsFloatingElement = i, Il.set(n, e), n.style.pointerEvents = "none", r.style.pointerEvents = "auto", i.style.pointerEvents = "auto";
}
function zl(e) {
	let t = e.context.dataRef.current, n = Ct(() => t.hoverInteractionState ?? Fl.create()).current;
	return t.hoverInteractionState ||= n, qr(t.hoverInteractionState.disposeEffect), t.hoverInteractionState;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverFloatingInteraction.mjs
function Bl(t, n = {}) {
	let { enabled: r = !0, closeDelay: i = 0, nodeId: a } = n, o = "rootStore" in t ? t.rootStore : t, s = o.useState("open"), c = o.useState("floatingElement"), l = o.useState("domReferenceElement"), { dataRef: u } = o.context, d = hs(), f = ms(), p = zl(o), m = zi(), h = X(() => Ta(u.current.openEvent?.type, p.interactedInside)), g = X(() => Ea(u.current.openEvent?.type)), _ = X(() => {
		Ll(p);
	});
	Z(() => {
		s || (p.pointerType = void 0, p.restTimeoutPending = !1, p.interactedInside = !1, _());
	}, [
		s,
		p,
		_
	]), e.useEffect(() => _, [_]), Z(() => {
		if (r && s && p.handleCloseOptions?.blockPointerEvents && g() && an(l) && c) {
			let e = l, t = c, n = Fn(c), r = d?.nodesRef.current.find((e) => e.id === f)?.context?.elements.floating;
			r && (r.style.pointerEvents = "");
			let i = p.pointerEventsScopeElement === t ? null : p.pointerEventsScopeElement, a = r === t ? null : r, o = p.handleCloseOptions?.getScope?.() ?? i ?? a ?? e.closest("[data-rootownerid]") ?? n.body;
			return Rl(p, {
				scopeElement: o,
				referenceElement: e,
				floatingElement: t
			}), () => {
				_();
			};
		}
	}, [
		r,
		s,
		l,
		c,
		p,
		g,
		d,
		f,
		_
	]), e.useEffect(() => {
		if (!r) return;
		function e() {
			return !!(d && f && Lo(d.nodesRef.current, f).length > 0);
		}
		function t(e) {
			let t = Ca(i, "close", p.pointerType), n = () => {
				o.setOpen(!1, Ur(Mr, e)), d?.events.emit("floating.closed", e);
			};
			t ? p.openChangeTimeout.start(t, n) : (p.openChangeTimeout.clear(), n());
		}
		function n(e) {
			let t = pa(e);
			if (!va(t)) {
				p.interactedInside = !1;
				return;
			}
			p.interactedInside = t?.closest("[aria-haspopup]") != null;
		}
		function s() {
			p.openChangeTimeout.clear(), m.clear(), d?.events.off("floating.closed", v), _();
		}
		function l(n) {
			if (e() && d) {
				d.events.on("floating.closed", v);
				return;
			}
			if (ma(n.relatedTarget, o.context.triggerElements)) return;
			let r = u.current.floatingContext?.nodeId ?? a, i = n.relatedTarget;
			if (!(d && r && an(i) && Lo(d.nodesRef.current, r, !1).some((e) => Q(e.context?.elements.floating, i)))) {
				if (p.handler) {
					p.handler(n);
					return;
				}
				_(), g() && !h() && t(n);
			}
		}
		function v(t) {
			!d || !f || e() || m.start(0, () => {
				d.events.off("floating.closed", v), o.setOpen(!1, Ur(Mr, t)), d.events.emit("floating.closed", t);
			});
		}
		let y = c;
		return Da(y && $(y, "mouseenter", s), y && $(y, "mouseleave", l), y && $(y, "pointerdown", n, !0), () => {
			d?.events.off("floating.closed", v);
		});
	}, [
		r,
		c,
		o,
		u,
		i,
		a,
		g,
		h,
		_,
		p,
		d,
		f,
		m
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverReferenceInteraction.mjs
var Vl = { current: null };
function Hl(t, n = {}) {
	let { enabled: r = !0, delay: i = 0, handleClose: a = null, mouseOnly: o = !1, restMs: s = 0, move: c = !0, triggerElementRef: u = Vl, externalTree: d, isActiveTrigger: f = !0, getHandleCloseContext: p, isClosing: m, shouldOpen: h, guardStaleOpen: g = !1 } = n, _ = "rootStore" in t ? t.rootStore : t, { dataRef: v, events: y } = _.context, b = hs(d), x = zl(_), S = e.useRef(!1), C = Oa(a), w = Oa(i), T = Oa(s), E = Oa(r), D = Oa(h), O = Oa(m), k = X(() => Ta(v.current.openEvent?.type, x.interactedInside)), A = X(() => D.current?.() !== !1), j = X((e, t, n) => {
		let r = _.context.triggerElements;
		if (r.hasElement(t)) return !e || !Q(e, t);
		if (!an(n)) return !1;
		let i = n;
		return r.hasMatchingElement((e) => Q(e, i)) && (!e || !Q(e, i));
	}), M = X(() => {
		x.handler &&= (Fn(_.select("domReferenceElement")).removeEventListener("mousemove", x.handler), void 0);
	}), N = X(() => {
		Ll(x);
	});
	return f && (x.handleCloseOptions = C.current?.__options), e.useEffect(() => M, [M]), e.useEffect(() => {
		if (!r) return;
		function e(e) {
			e.open ? S.current = !1 : (S.current = e.reason === Mr, M(), x.openChangeTimeout.clear(), x.restTimeout.clear(), x.blockMouseMove = !0, x.restTimeoutPending = !1);
		}
		return y.on("openchange", e), () => {
			y.off("openchange", e);
		};
	}, [
		r,
		y,
		x,
		M
	]), e.useEffect(() => {
		if (!r) return;
		function e(e, t = !0) {
			let n = Ca(w.current, "close", x.pointerType);
			n ? x.openChangeTimeout.start(n, () => {
				_.setOpen(!1, Ur(Mr, e)), b?.events.emit("floating.closed", e);
			}) : t && (x.openChangeTimeout.clear(), _.setOpen(!1, Ur(Mr, e)), b?.events.emit("floating.closed", e));
		}
		let t = u.current ?? (f ? _.select("domReferenceElement") : null);
		if (!an(t)) return;
		function n(e) {
			if (x.openChangeTimeout.clear(), x.blockMouseMove = !1, o && !ia(x.pointerType)) return;
			let t = wa(T.current), n = Ca(w.current, "open", x.pointerType), r = pa(e), i = e.currentTarget ?? null, a = _.select("domReferenceElement"), s = i;
			if (an(r) && !_.context.triggerElements.hasElement(r)) {
				for (let e of _.context.triggerElements.elements()) if (Q(e, r)) {
					s = e;
					break;
				}
			}
			an(i) && an(a) && !_.context.triggerElements.hasElement(i) && Q(i, a) && (s = a);
			let c = s != null && j(a, s, r), l = _.select("open"), u = O.current?.() ?? _.select("transitionStatus") === "ending", d = !l && u && S.current, f = !c && an(s) && an(a) && Q(a, s) && d, p = t > 0 && !n, m = c && (l || d) || f, h = !l || c;
			if (m) {
				A() && _.setOpen(!0, Ur(Mr, e, s));
				return;
			}
			p || (n ? x.openChangeTimeout.start(n, () => {
				h && A() && _.setOpen(!0, Ur(Mr, e, s));
			}) : h && A() && _.setOpen(!0, Ur(Mr, e, s)));
		}
		function i(t) {
			if (k()) {
				N();
				return;
			}
			M();
			let n = Fn(_.select("domReferenceElement"));
			x.restTimeout.clear(), x.restTimeoutPending = !1;
			let r = v.current.floatingContext ?? p?.();
			if (!ma(t.relatedTarget, _.context.triggerElements)) {
				if (C.current && r) {
					_.select("open") || x.openChangeTimeout.clear();
					let i = u.current;
					x.handler = C.current({
						...r,
						tree: b,
						x: t.clientX,
						y: t.clientY,
						onClose() {
							N(), M(), E.current && !k() && i === _.select("domReferenceElement") && e(t, !0);
						}
					}), n.addEventListener("mousemove", x.handler), x.handler(t);
					return;
				}
				(x.pointerType !== "touch" || !Q(_.select("floatingElement"), t.relatedTarget)) && e(t);
			}
		}
		function a(e) {
			Q(t, e.relatedTarget) || (x.openChangeTimeout.clear(), x.restTimeout.clear(), x.restTimeoutPending = !1);
		}
		let s = g ? $(t, "mouseout", a) : void 0;
		return c ? Da($(t, "mousemove", n, { once: !0 }), $(t, "mouseenter", n), $(t, "mouseleave", i), s) : Da($(t, "mouseenter", n), $(t, "mouseleave", i), s);
	}, [
		M,
		N,
		v,
		w,
		_,
		r,
		C,
		x,
		f,
		j,
		k,
		o,
		c,
		T,
		u,
		b,
		E,
		p,
		O,
		A,
		g
	]), e.useMemo(() => {
		if (!r) return;
		function e(e) {
			x.pointerType = e.pointerType;
		}
		return {
			onPointerDown: e,
			onPointerEnter: e,
			onMouseMove(e) {
				let { nativeEvent: t } = e, n = e.currentTarget, r = _.select("domReferenceElement"), i = _.select("open"), a = j(r, n, e.target);
				if (o && !ia(x.pointerType)) return;
				if (i && a && x.handleCloseOptions?.blockPointerEvents) {
					let e = _.select("floatingElement");
					if (e) {
						let t = x.handleCloseOptions?.getScope?.() ?? n.ownerDocument.body;
						Rl(x, {
							scopeElement: t,
							referenceElement: n,
							floatingElement: e
						});
					}
				}
				let s = wa(T.current);
				if (i && !a || s === 0 || !a && x.restTimeoutPending && e.movementX ** 2 + e.movementY ** 2 < 2) return;
				x.restTimeout.clear();
				function c() {
					if (x.restTimeoutPending = !1, k()) return;
					let e = _.select("open");
					!x.blockMouseMove && (!e || a) && A() && _.setOpen(!0, Ur(Mr, t, n));
				}
				x.pointerType === "touch" ? l.flushSync(() => {
					c();
				}) : a && i ? c() : (x.restTimeoutPending = !0, x.restTimeout.start(s, c));
			}
		};
	}, [
		r,
		x,
		k,
		j,
		o,
		_,
		T,
		A
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useListNavigation.mjs
var Ul = "Escape";
function Wl(e) {
	return Zi && e.movementX === 0 && e.movementY === 0;
}
function Gl(e, t, n) {
	switch (e) {
		case "vertical": return t;
		case "horizontal": return n;
		default: return t || n;
	}
}
function Kl(e, t) {
	return Gl(t, e === "ArrowUp" || e === "ArrowDown", e === "ArrowLeft" || e === "ArrowRight");
}
function ql(e, t, n) {
	return Gl(t, e === "ArrowDown", n ? e === "ArrowLeft" : e === "ArrowRight") || e === "Enter" || e === " " || e === "";
}
function Jl(e, t, n) {
	return Gl(t, n ? e === ca : e === la, e === da);
}
function Yl(e, t, n, r) {
	return t === "both" || t === "horizontal" && r ? e === Ul : Gl(t, n ? e === la : e === ca, e === ua);
}
function Xl(t, n) {
	let { listRef: r, activeIndex: i, onNavigate: a = () => {}, enabled: o = !0, selectedIndex: s = null, allowEscape: c = !1, loopFocus: l = !1, nested: u = !1, rtl: d = !1, virtual: f = !1, focusItemOnOpen: p = "auto", focusItemOnHover: m = !0, openOnArrowKeyDown: h = !0, disabledIndices: g = void 0, orientation: _ = "vertical", parentOrientation: v, id: y, resetOnPointerLeave: b = !0, externalTree: x, grid: S } = n, C = S != null;
	process.env.NODE_ENV !== "production" && (c && (l || console.warn("`useListNavigation` looping must be enabled to allow escaping."), f || console.warn("`useListNavigation` must be virtual to allow escaping.")), _ === "vertical" && C && console.warn("In grid list navigation mode, the `orientation` should", "be either \"horizontal\" or \"both\"."));
	let w = "rootStore" in t ? t.rootStore : t, T = w.useState("open"), E = w.useState("floatingElement"), D = w.useState("domReferenceElement"), O = w.context.dataRef, k = xa(E), A = ya(D), j = Oa(k), M = ms(), N = hs(x), P = e.useRef(p), F = e.useRef(s ?? -1), I = e.useRef(null), L = e.useRef(!0), R = X((e) => {
		a(F.current === -1 ? null : F.current, e);
	}), z = e.useRef(!!E), ee = e.useRef(T), B = e.useRef(!1), V = e.useRef(!1), H = e.useRef(null), te = Oa(g), U = Oa(T), ne = Oa(s), W = Oa(b), re = Qr(), ie = Qr(), ae = X(() => {
		function e(e) {
			f ? N?.events.emit("virtualfocus", e) : H.current = Vo(e, {
				sync: B.current,
				preventScroll: !0
			});
		}
		let t = r.current[F.current], n = V.current;
		t && e(t), (B.current ? (e) => e() : (e) => re.request(e))(() => {
			let i = r.current[F.current] || t;
			i && (t || e(i), de && (n || !L.current) && i.scrollIntoView?.({
				block: "nearest",
				inline: "nearest"
			}));
		});
	});
	Z(() => {
		O.current.orientation = _;
	}, [O, _]), Z(() => {
		o && (T && E ? (F.current = s ?? -1, P.current && s != null && (V.current = !0, R())) : z.current && (F.current = -1, R()));
	}, [
		o,
		T,
		E,
		s,
		R
	]), Z(() => {
		if (o) {
			if (!T) {
				B.current = !1;
				return;
			}
			if (E) if (i == null) {
				if (B.current = !1, ne.current != null) return;
				if (z.current && (F.current = -1, ae()), (!ee.current || !z.current) && P.current && (I.current != null || P.current === !0 && I.current == null)) {
					let e = 0, t = () => {
						r.current[0] == null ? (e < 2 && (e ? (e) => ie.request(e) : queueMicrotask)(t), e += 1) : (F.current = I.current == null || ql(I.current, _, d) || u ? ao(r) : oo(r), I.current = null, R());
					};
					t();
				}
			} else io(r.current, i) || (F.current = i, ae(), V.current = !1);
		}
	}, [
		o,
		T,
		E,
		i,
		ne,
		u,
		r,
		_,
		d,
		R,
		ae,
		ie
	]), Z(() => {
		if (!o || E || !N || f || !z.current) return;
		let e = N.nodesRef.current, t = e.find((e) => e.id === M)?.context?.elements.floating, n = fa(Fn(D ?? t ?? null)), r = e.some((e) => e.context && Q(e.context.elements.floating, n));
		t && !r && L.current && t.focus({ preventScroll: !0 });
	}, [
		o,
		E,
		D,
		N,
		M,
		f
	]), Z(() => {
		ee.current = T, z.current = !!E;
	}), Z(() => {
		T || (I.current = null, P.current = p);
	}, [T, p]);
	let oe = i != null, se = X((e) => {
		if (!U.current) return;
		let t = r.current.indexOf(e.currentTarget);
		t !== -1 && (F.current !== t || i !== t) && (F.current = t, R(e));
	}), ce = X(() => v ?? N?.nodesRef.current.find((e) => e.id === M)?.context?.dataRef?.current.orientation), le = X(() => ao(r, te.current)), ue = X((e) => {
		if (L.current = !1, B.current = !0, e.which === 229 || !U.current && e.currentTarget === j.current) return;
		if (u && Yl(e.key, _, d, C)) {
			Kl(e.key, ce()) || ea(e), w.setOpen(!1, Ur(zr, e.nativeEvent)), on(D) && (f ? N?.events.emit("virtualfocus", D) : D.focus());
			return;
		}
		let t = F.current, n = ao(r, g), i = oo(r, g);
		if (A || (e.key === "Home" && (ea(e), F.current = n, R(e)), e.key === "End" && (ea(e), F.current = i, R(e))), S != null) {
			let t = S(e, F.current, r, _, l, d, g, n, i);
			if (t != null && (F.current = t, R(e)), _ === "both") return;
		}
		if (Kl(e.key, _)) {
			if (ea(e), T && !f && fa(e.currentTarget.ownerDocument) === e.currentTarget) {
				F.current = ql(e.key, _, d) ? n : i, R(e);
				return;
			}
			ql(e.key, _, d) ? l ? t >= i ? c && t !== r.current.length ? F.current = -1 : (B.current = !1, F.current = n) : F.current = so(r.current, {
				startingIndex: t,
				disabledIndices: g
			}) : F.current = Math.min(i, so(r.current, {
				startingIndex: t,
				disabledIndices: g
			})) : l ? t <= n ? c && t !== -1 ? F.current = r.current.length : (B.current = !1, F.current = i) : F.current = so(r.current, {
				startingIndex: t,
				decrement: !0,
				disabledIndices: g
			}) : F.current = Math.max(n, so(r.current, {
				startingIndex: t,
				decrement: !0,
				disabledIndices: g
			})), io(r.current, F.current) && (F.current = -1), R(e);
		}
	}), de = e.useMemo(() => ({
		onFocus(e) {
			B.current = !0, se(e);
		},
		onClick: ({ currentTarget: e }) => e.focus({ preventScroll: !0 }),
		onMouseMove(e) {
			Wl(e) || (B.current = !0, V.current = !1, m && se(e));
		},
		onPointerLeave(e) {
			if (!U.current || !L.current || e.pointerType === "touch") return;
			B.current = !0;
			let t = e.relatedTarget;
			if (!(!m || r.current.includes(t)) && W.current && (H.current?.(), H.current = null, F.current = -1, R(e), !f)) {
				let e = j.current, t = fa(Fn(e));
				e && Q(e, t) && e.focus({ preventScroll: !0 });
			}
		}
	}), [
		se,
		U,
		j,
		m,
		r,
		R,
		W,
		f
	]), G = e.useMemo(() => f && T && oe && { "aria-activedescendant": `${y}-${i}` }, [
		f,
		T,
		oe,
		y,
		i
	]), fe = e.useMemo(() => ({
		"aria-orientation": _ === "both" ? void 0 : _,
		...A ? {} : G,
		onKeyDown(e) {
			if (e.key === "Tab" && e.shiftKey && T && !f) {
				let t = pa(e.nativeEvent);
				if (t && !Q(j.current, t)) return;
				ea(e), w.setOpen(!1, Ur(Lr, e.nativeEvent)), on(D) && D.focus();
				return;
			}
			ue(e);
		},
		onPointerMove(e) {
			Wl(e) || (L.current = !0);
		}
	}), [
		G,
		ue,
		j,
		_,
		A,
		w,
		T,
		f,
		D
	]), pe = e.useMemo(() => {
		function e(e) {
			w.setOpen(!0, Ur(zr, e.nativeEvent, e.currentTarget));
		}
		function t(e) {
			p === "auto" && na(e.nativeEvent) && (P.current = !f);
		}
		function n(e) {
			P.current = p, p === "auto" && ra(e.nativeEvent) && (P.current = !0);
		}
		return {
			onKeyDown(t) {
				let n = w.select("open");
				L.current = !1;
				let r = t.key.startsWith("Arrow"), i = Jl(t.key, ce(), d), a = Kl(t.key, _), o = (u ? i : a) || t.key === "Enter" || t.key.trim() === "";
				if (f && n) return ue(t);
				if (!(!n && !h && r)) {
					if (o) {
						let e = Kl(t.key, ce());
						I.current = u && e ? null : t.key;
					}
					if (u) {
						i && (ea(t), n ? (F.current = le(), R(t)) : e(t));
						return;
					}
					a && (ne.current != null && (F.current = ne.current), ea(t), !n && h ? e(t) : ue(t), n && R(t));
				}
			},
			onFocus(e) {
				w.select("open") && !f && (F.current = -1, R(e));
			},
			onPointerDown: n,
			onPointerEnter: n,
			onMouseDown: t,
			onClick: t
		};
	}, [
		ue,
		p,
		le,
		u,
		R,
		w,
		h,
		_,
		ce,
		d,
		ne,
		f
	]), me = e.useMemo(() => ({
		...G,
		...pe
	}), [G, pe]);
	return e.useMemo(() => o ? {
		reference: me,
		floating: fe,
		item: de,
		trigger: pe
	} : {}, [
		o,
		me,
		fe,
		pe,
		de
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/hooks/useTypeahead.mjs
function Zl(t, n) {
	let { listRef: r, elementsRef: i, activeIndex: a, onMatch: o, disabledIndices: s, onTyping: c, enabled: l = !0, resetMs: u = 750, selectedIndex: d = null } = n, f = "rootStore" in t ? t.rootStore : t, p = f.useState("open"), m = zi(), h = e.useRef(""), g = e.useRef(d ?? a ?? -1), _ = e.useRef(null), v = X((e) => {
		function t(e) {
			return i?.current[e];
		}
		function n(e) {
			let n = t(e);
			return n && !uo(n) || n?.matches(":disabled") ? !1 : s == null || !co(It, e, s);
		}
		function l(e, t, r = 0) {
			if (e.length === 0) return -1;
			let i = (r % e.length + e.length) % e.length, a = t.toLowerCase();
			for (let t = 0; t < e.length; t += 1) {
				let r = (i + t) % e.length;
				if (!(!e[r]?.toLowerCase().startsWith(a) || !n(r))) return r;
			}
			return -1;
		}
		let f = r.current;
		if (h.current.length > 0 && e.key === " " && (ea(e), c?.(!0)), h.current.length > 0 && h.current[0] !== " " && l(f, h.current) === -1 && e.key !== " " && c?.(!1), f == null || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
		p && e.key !== " " && (ea(e), c?.(!0));
		let v = h.current === "";
		v && (g.current = d ?? a ?? -1), f.every((e, t) => e && n(t) ? e[0]?.toLowerCase() !== e[1]?.toLowerCase() : !0) && h.current === e.key && (h.current = "", g.current = _.current), h.current += e.key, m.start(u, () => {
			h.current = "", g.current = _.current, c?.(!1);
		});
		let y = ((v ? d ?? a ?? -1 : g.current) ?? 0) + 1, b = l(f, h.current, y);
		b === -1 ? e.key !== " " && (h.current = "", c?.(!1)) : (o?.(b), _.current = b);
	}), y = X((e) => {
		let t = e.relatedTarget, n = f.select("domReferenceElement"), r = f.select("floatingElement");
		Q(n, t) || Q(r, t) || (m.clear(), h.current = "", g.current = _.current, c?.(!1));
	});
	Z(() => {
		!p && d !== null || (m.clear(), _.current = null, h.current !== "" && (h.current = ""));
	}, [
		p,
		d,
		m
	]);
	let b = e.useMemo(() => ({
		onKeyDown: v,
		onBlur: y
	}), [v, y]);
	return e.useMemo(() => l ? {
		reference: b,
		floating: b
	} : {}, [l, b]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/safePolygon.mjs
var Ql = .1, $l = Ql * Ql, eu = .5;
function tu(e, t, n, r, i, a) {
	return r >= t != a >= t && e <= (i - n) * (t - r) / (a - r) + n;
}
function nu(e, t, n, r, i, a, o, s, c, l) {
	let u = !1;
	return tu(e, t, n, r, i, a) && (u = !u), tu(e, t, i, a, o, s) && (u = !u), tu(e, t, o, s, c, l) && (u = !u), tu(e, t, c, l, n, r) && (u = !u), u;
}
function ru(e, t, n) {
	return e >= n.x && e <= n.x + n.width && t >= n.y && t <= n.y + n.height;
}
function iu(e, t, n, r, i, a) {
	return e >= Math.min(n, i) && e <= Math.max(n, i) && t >= Math.min(r, a) && t <= Math.max(r, a);
}
function au(e = {}) {
	let { blockPointerEvents: t = !1 } = e, n = new Ri(), r = ({ x: e, y: t, placement: r, elements: i, onClose: a, nodeId: o, tree: s }) => {
		let c = r?.split("-")[0], l = !1, u = null, d = null, f = typeof performance < "u" ? performance.now() : 0;
		function p(e, t) {
			let n = performance.now(), r = n - f;
			if (u === null || d === null || r === 0) return u = e, d = t, f = n, !1;
			let i = e - u, a = t - d, o = i * i + a * a, s = r * r * $l;
			return u = e, d = t, f = n, o < s;
		}
		function m() {
			n.clear(), a();
		}
		return function(r) {
			n.clear();
			let a = i.domReference, u = i.floating;
			if (!a || !u || c == null || e == null || t == null) return;
			let { clientX: d, clientY: f } = r, h = pa(r), g = r.type === "mouseleave", _ = Q(u, h), v = Q(a, h);
			if (_ && (l = !0, !g)) return;
			if (v && (l = !1, !g)) {
				l = !0;
				return;
			}
			if (g && an(r.relatedTarget) && Q(u, r.relatedTarget)) return;
			function y() {
				return !!(s && Lo(s.nodesRef.current, o).length > 0);
			}
			function b() {
				y() || m();
			}
			if (y()) return;
			let x = a.getBoundingClientRect(), S = u.getBoundingClientRect(), C = e > S.right - S.width / 2, w = t > S.bottom - S.height / 2, T = S.width > x.width, E = S.height > x.height, D = (T ? x : S).left, O = (T ? x : S).right, k = (E ? x : S).top, A = (E ? x : S).bottom;
			if (c === "top" && t >= x.bottom - 1 || c === "bottom" && t <= x.top + 1 || c === "left" && e >= x.right - 1 || c === "right" && e <= x.left + 1) {
				b();
				return;
			}
			let j = !1;
			switch (c) {
				case "top":
					j = iu(d, f, D, x.top + 1, O, S.bottom - 1);
					break;
				case "bottom":
					j = iu(d, f, D, S.top + 1, O, x.bottom - 1);
					break;
				case "left":
					j = iu(d, f, S.right - 1, A, x.left + 1, k);
					break;
				case "right": j = iu(d, f, x.right - 1, A, S.left + 1, k);
			}
			if (j) return;
			if (l && !ru(d, f, x)) {
				b();
				return;
			}
			if (!g && p(d, f)) {
				b();
				return;
			}
			let M = !1;
			switch (c) {
				case "top": {
					let n = T ? eu / 2 : eu * 4, r = T || C ? e + n : e - n, i = T ? e - n : C ? e + n : e - n, a = t + eu + 1, o = C || T ? S.bottom - eu : S.top, s = C ? T ? S.bottom - eu : S.top : S.bottom - eu;
					M = nu(d, f, r, a, i, a, S.left, o, S.right, s);
					break;
				}
				case "bottom": {
					let n = T ? eu / 2 : eu * 4, r = T || C ? e + n : e - n, i = T ? e - n : C ? e + n : e - n, a = t - eu, o = C || T ? S.top + eu : S.bottom, s = C ? T ? S.top + eu : S.bottom : S.top + eu;
					M = nu(d, f, r, a, i, a, S.left, o, S.right, s);
					break;
				}
				case "left": {
					let n = E ? eu / 2 : eu * 4, r = E || w ? t + n : t - n, i = E ? t - n : w ? t + n : t - n, a = e + eu + 1, o = w || E ? S.right - eu : S.left, s = w ? E ? S.right - eu : S.left : S.right - eu;
					M = nu(d, f, o, S.top, s, S.bottom, a, r, a, i);
					break;
				}
				case "right": {
					let n = E ? eu / 2 : eu * 4, r = E || w ? t + n : t - n, i = E ? t - n : w ? t + n : t - n, a = e - eu, o = w || E ? S.left + eu : S.right, s = w ? E ? S.left + eu : S.right : S.left + eu;
					M = nu(d, f, a, r, a, i, o, S.top, s, S.bottom);
					break;
				}
			}
			M ? l || n.start(40, b) : b();
		};
	};
	return r.__options = {
		...e,
		blockPointerEvents: t
	}, r;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/portal/DialogPortalContext.mjs
var ou = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (ou.displayName = "DialogPortalContext");
function su() {
	let t = e.useContext(ou);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(26) : "Base UI: <Dialog.Portal> is missing.");
	return t;
}
var cu = /* @__PURE__ */ new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End"
]), lu = {
	...Mi,
	...oi,
	nestedDialogOpen(e) {
		return e ? { "data-nested-dialog-open": "" } : null;
	}
}, uu = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, finalFocus: a, initialFocus: o, ...c } = e, l = wi(), u = l.useState("descriptionElementId"), d = l.useState("disablePointerDismissal"), f = l.useState("floatingRootContext"), p = l.useState("popupProps"), m = l.useState("modal"), h = l.useState("mounted"), g = l.useState("nested"), _ = l.useState("nestedOpenDialogCount"), v = l.useState("open"), y = l.useState("openMethod"), b = l.useState("titleElementId"), x = l.useState("transitionStatus"), S = l.useState("role"), C = f.useState("floatingId");
	su(), ti({
		open: v,
		ref: l.context.popupRef,
		onComplete() {
			v && l.context.onOpenChangeComplete?.(!0);
		}
	});
	let w = o === void 0 ? sl(l.context.popupRef) : o, T = _ > 0, E = l.useStateSetter("popupElement"), D = Vt("div", e, {
		state: {
			open: v,
			nested: g,
			transitionStatus: x,
			nestedDialogOpen: T
		},
		props: [
			p,
			{
				id: C,
				"aria-labelledby": b,
				"aria-describedby": u,
				role: S,
				...ol,
				hidden: !h,
				onKeyDown(e) {
					cu.has(e.key) && e.stopPropagation();
				},
				style: { "--nested-dialogs": _ }
			},
			c
		],
		ref: [
			t,
			l.context.popupRef,
			E
		],
		stateAttributesMapping: lu
	});
	return /*#__PURE__*/ s(Ds, {
		context: f,
		openInteractionType: y,
		disabled: !h,
		closeOnFocusOut: !d,
		initialFocus: w,
		returnFocus: a,
		modal: m !== !1,
		restoreFocus: "popup",
		children: D
	});
});
process.env.NODE_ENV !== "production" && (uu.displayName = "DialogPopup");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/inertValue.mjs
function du(e) {
	return jt(19) ? e : e ? "true" : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/InternalBackdrop.mjs
var fu = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { cutout: n, ...r } = e, i;
	if (n) {
		let e = n.getBoundingClientRect();
		i = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${e.left}px ${e.top}px,${e.left}px ${e.bottom}px,${e.right}px ${e.bottom}px,${e.right}px ${e.top}px,${e.left}px ${e.top}px)`;
	}
	return /*#__PURE__*/ s("div", {
		ref: t,
		role: "presentation",
		"data-base-ui-inert": "",
		...r,
		style: {
			position: "fixed",
			inset: 0,
			userSelect: "none",
			WebkitUserSelect: "none",
			clipPath: i
		}
	});
});
process.env.NODE_ENV !== "production" && (fu.displayName = "InternalBackdrop");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/portal/DialogPortal.mjs
var pu = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { keepMounted: n = !1, ...r } = e, i = wi(), a = i.useState("mounted"), o = i.useState("modal"), l = i.useState("open");
	return a || n ? /*#__PURE__*/ s(ou.Provider, {
		value: n,
		children: /*#__PURE__*/ c(ls, {
			ref: t,
			...r,
			children: [a && o === !0 && /*#__PURE__*/ s(fu, {
				ref: i.context.internalBackdropRef,
				inert: du(!l)
			}), e.children]
		})
	}) : null;
});
process.env.NODE_ENV !== "production" && (pu.displayName = "DialogPortal");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useScrollLock.mjs
var mu = {}, hu = {}, gu = "";
function _u(e, t) {
	return cn(e) ? e : t;
}
function vu(e, t, n) {
	return /hidden|clip/.test(e.getComputedStyle(_u(t, n)).overflowY);
}
function yu(e) {
	if (typeof document > "u") return !1;
	let t = Fn(e);
	return tn(t).innerWidth - t.documentElement.clientWidth > 0;
}
function bu(e) {
	if (!(typeof CSS < "u" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document > "u") return !1;
	let t = Fn(e), n = t.documentElement, r = t.body, i = _u(n, r), a = i.style.overflowY, o = n.style.scrollbarGutter;
	n.style.scrollbarGutter = "stable", i.style.overflowY = "scroll";
	let s = i.offsetWidth;
	i.style.overflowY = "hidden";
	let c = i.offsetWidth;
	return i.style.overflowY = a, n.style.scrollbarGutter = o, s === c;
}
function xu(e) {
	let t = Fn(e), n = t.documentElement, r = t.body, i = _u(n, r), a = {
		overflowY: i.style.overflowY,
		overflowX: i.style.overflowX
	};
	return Object.assign(i.style, {
		overflowY: "hidden",
		overflowX: "hidden"
	}), () => {
		Object.assign(i.style, a);
	};
}
function Su(e) {
	let t = Fn(e), n = t.documentElement, r = t.body, i = tn(n), a = 0, o = 0, s = !1, c = Zr.create();
	if (Zi && (i.visualViewport?.scale ?? 1) !== 1) return () => {};
	function l() {
		let t = i.getComputedStyle(n), c = i.getComputedStyle(r), l = (t.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
		a = n.scrollTop, o = n.scrollLeft, mu = {
			scrollbarGutter: n.style.scrollbarGutter,
			overflowY: n.style.overflowY,
			overflowX: n.style.overflowX
		}, gu = n.style.scrollBehavior, hu = {
			position: r.style.position,
			height: r.style.height,
			width: r.style.width,
			boxSizing: r.style.boxSizing,
			overflowY: r.style.overflowY,
			overflowX: r.style.overflowX,
			scrollBehavior: r.style.scrollBehavior
		};
		let u = n.scrollHeight > n.clientHeight, d = n.scrollWidth > n.clientWidth, f = t.overflowY === "scroll" || c.overflowY === "scroll", p = t.overflowX === "scroll" || c.overflowX === "scroll", m = Math.max(0, i.innerWidth - r.clientWidth), h = Math.max(0, i.innerHeight - r.clientHeight), g = parseFloat(c.marginTop) + parseFloat(c.marginBottom), _ = parseFloat(c.marginLeft) + parseFloat(c.marginRight), v = _u(n, r);
		if (s = bu(e), s) {
			n.style.scrollbarGutter = l, v.style.overflowY = "hidden", v.style.overflowX = "hidden";
			return;
		}
		Object.assign(n.style, {
			scrollbarGutter: l,
			overflowY: "hidden",
			overflowX: "hidden"
		}), (u || f) && (n.style.overflowY = "scroll"), (d || p) && (n.style.overflowX = "scroll"), Object.assign(r.style, {
			position: "relative",
			height: g || h ? `calc(100dvh - ${g + h}px)` : "100dvh",
			width: _ || m ? `calc(100vw - ${_ + m}px)` : "100vw",
			boxSizing: "border-box",
			overflowY: "hidden",
			overflowX: "hidden",
			scrollBehavior: "unset"
		}), r.scrollTop = a, r.scrollLeft = o, n.setAttribute("data-base-ui-scroll-locked", ""), n.style.scrollBehavior = "unset";
	}
	function u() {
		Object.assign(n.style, mu), Object.assign(r.style, hu), s || (n.scrollTop = a, n.scrollLeft = o, n.removeAttribute("data-base-ui-scroll-locked"), n.style.scrollBehavior = gu);
	}
	function d() {
		u(), c.request(l);
	}
	l();
	let f = $(i, "resize", d);
	return () => {
		c.cancel(), u(), typeof i.removeEventListener == "function" && f();
	};
}
var Cu = new class {
	lockCount = 0;
	restore = null;
	timeoutLock = Ri.create();
	timeoutUnlock = Ri.create();
	acquire(e) {
		return this.lockCount += 1, this.lockCount === 1 && this.restore === null && this.timeoutLock.start(0, () => this.lock(e)), this.release;
	}
	release = () => {
		--this.lockCount, this.lockCount === 0 && this.restore && this.timeoutUnlock.start(0, this.unlock);
	};
	unlock = () => {
		this.lockCount === 0 && this.restore && (this.restore?.(), this.restore = null);
	};
	lock(e) {
		if (this.lockCount === 0 || this.restore !== null) return;
		let t = Fn(e), n = t.documentElement, r = t.body, i = tn(n);
		if (vu(i, n, r)) {
			let t = new i.MutationObserver(() => {
				vu(i, n, r) || (t.disconnect(), this.restore = null, this.lock(e));
			}), a = { attributes: !0 };
			t.observe(n, a), t.observe(r, a), this.restore = () => t.disconnect();
			return;
		}
		let a = Ki || !yu(e);
		this.restore = a ? xu(e) : Su(e);
	}
}();
function wu(e = !0, t = null) {
	Z(() => {
		if (e) return Cu.acquire(t);
	}, [e, t]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/root/useDialogRoot.mjs
function Tu({ store: t, parentContext: n, isDrawer: r }) {
	let i = t.useState("open"), a = t.useState("disablePointerDismissal"), o = t.useState("modal"), s = t.useState("popupElement"), c = t.useState("floatingRootContext"), [l, u] = e.useState(0), [d, f] = e.useState(0), p = l === 0, m = js(c, {
		outsidePressEvent() {
			return t.context.internalBackdropRef.current || t.context.backdropRef.current ? "intentional" : {
				mouse: o === "trap-focus" ? "sloppy" : "intentional",
				touch: "sloppy"
			};
		},
		outsidePress(e) {
			if (!t.context.outsidePressEnabledRef.current || "button" in e && e.button !== 0) return !1;
			if ("touches" in e) {
				if (e.type === "touchend") {
					if (e.changedTouches.length !== 1 || e.touches.length !== 0) return !1;
				} else if (e.touches.length !== 1) return !1;
			}
			let n = pa(e);
			if (p && !a) {
				if (o) {
					let e = t.context.internalBackdropRef.current, r = t.context.backdropRef.current;
					return e || r ? e === n || r === n || Q(n, s) && !n?.hasAttribute("data-base-ui-portal") : !0;
				}
				return !0;
			}
			return !1;
		},
		escapeKey: p
	});
	return wu(i && o === !0, s), t.useContextCallback("onNestedDialogOpen", (e, t) => {
		u(e), f(t);
	}), Z(() => (n?.onNestedDialogOpen && (i ? n.onNestedDialogOpen(l + 1, d + +!!r) : n.onNestedDialogOpen(0, 0)), () => {
		n?.onNestedDialogOpen && i && n.onNestedDialogOpen(0, 0);
	}), [
		r,
		i,
		l,
		d,
		n
	]), gl(t, {
		activeTriggerProps: m.reference,
		inactiveTriggerProps: m.trigger,
		popupProps: m.floating,
		nestedOpenDialogCount: l,
		nestedOpenDrawerCount: d
	}), null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/store/DialogStore.mjs
var Eu = {
	...kl,
	modal: (e) => e.modal,
	nested: (e) => e.nested,
	nestedOpenDialogCount: (e) => e.nestedOpenDialogCount,
	nestedOpenDrawerCount: (e) => e.nestedOpenDrawerCount,
	disablePointerDismissal: (e) => e.disablePointerDismissal,
	openMethod: (e) => e.openMethod,
	descriptionElementId: (e) => e.descriptionElementId,
	titleElementId: (e) => e.titleElementId,
	viewportElement: (e) => e.viewportElement,
	role: (e) => e.role
}, Du = class extends nl {
	constructor(e, t, n) {
		let r = new bl(), i = Ou(e, r, t, n);
		super(i, ku(r), Eu);
	}
	setOpen = (e, t) => {
		if (t.preventUnmountOnClose = () => {
			this.set("preventUnmountingOnClose", !0);
		}, !e && t.trigger == null && this.state.activeTriggerId != null && (t.trigger = this.state.activeTriggerElement ?? void 0), this.context.onOpenChange?.(e, t), t.isCanceled) return;
		this.state.floatingRootContext.dispatchOpenChange(e, t);
		let n = { open: e };
		dl(n, e, t.trigger), this.update(n);
	};
};
function Ou(e, t, n, r = !1) {
	let i = {
		...Sl(),
		modal: !0,
		disablePointerDismissal: !1,
		viewportElement: null,
		descriptionElementId: void 0,
		titleElementId: void 0,
		openMethod: null,
		nested: !1,
		nestedOpenDialogCount: 0,
		nestedOpenDrawerCount: 0,
		role: "dialog",
		...e
	};
	return i.floatingRootContext = Cl(t, n, r), i;
}
function ku(t) {
	return {
		popupRef: /*#__PURE__*/ e.createRef(),
		backdropRef: /*#__PURE__*/ e.createRef(),
		internalBackdropRef: /*#__PURE__*/ e.createRef(),
		outsidePressEnabledRef: { current: !0 },
		triggerElements: t,
		onOpenChange: void 0,
		onOpenChangeComplete: void 0
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/root/useRenderDialogRoot.mjs
function Au(t, n) {
	let { children: r, open: i, defaultOpen: a = !1, onOpenChange: o, onOpenChangeComplete: l, disablePointerDismissal: u = !1, modal: d = !0, actionsRef: f, handle: p, triggerId: m, defaultTriggerId: h = null } = n, g = t === "drawer", _ = t === "alert-dialog", v = _ ? !0 : d, y = _ || u, b = _ ? "alertdialog" : "dialog", x = wi(!0), S = {
		modal: v,
		disablePointerDismissal: y,
		nested: x != null,
		role: b
	}, C = cl((e, t) => new Du({
		open: a,
		openProp: i,
		activeTriggerId: h,
		triggerIdProp: m,
		...S
	}, e, t), !0);
	C.useControlledProp("openProp", i), C.useControlledProp("triggerIdProp", m), C.useSyncedValues(S), C.useContextCallback("onOpenChange", o), C.useContextCallback("onOpenChangeComplete", l);
	let w = C.useState("open"), T = C.useState("mounted"), E = C.useState("payload");
	_l(C, w), ml(C);
	let { forceUnmount: D } = hl(w, C);
	e.useImperativeHandle(f, () => ({
		unmount: D,
		close: () => C.setOpen(!1, Ur(Hr))
	}), [D, C]);
	let O = w || T;
	return /*#__PURE__*/ c(Ci.Provider, {
		value: C,
		children: [
			p && /*#__PURE__*/ s(ll, {
				handle: p,
				store: C
			}),
			O && /*#__PURE__*/ s(Tu, {
				store: C,
				parentContext: x?.context,
				isDrawer: g
			}),
			typeof r == "function" ? r({ payload: E }) : r
		]
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/root/DialogRoot.mjs
function ju(e) {
	return Au("dialog", e);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/title/DialogTitle.mjs
var Mu = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, id: a, ...o } = e, s = wi(), c = fr(a);
	return s.useSyncedValueWithCleanup("titleElementId", c), Vt("h2", e, {
		ref: t,
		props: [{ id: c }, o]
	});
});
process.env.NODE_ENV !== "production" && (Mu.displayName = "DialogTitle");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/useEnhancedClickHandler.mjs
function Nu(t) {
	let n = e.useRef(""), r = e.useCallback((e) => {
		e.defaultPrevented || (n.current = e.pointerType, t(e, e.pointerType));
	}, [t]);
	return {
		onClick: e.useCallback((e) => {
			if (e.detail === 0) {
				t(e, "keyboard");
				return;
			}
			"pointerType" in e ? t(e, e.pointerType) : t(e, n.current), n.current = "";
		}, [t]),
		onPointerDown: r
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/useOpenInteractionType.mjs
function Pu(t, n) {
	let { onClick: r, onPointerDown: i } = Nu(X((e, r) => {
		(typeof t == "function" ? t() : t) || n(r || (Ki ? "touch" : ""));
	}));
	return e.useMemo(() => ({
		onClick: r,
		onPointerDown: i
	}), [r, i]);
}
function Fu(t) {
	let [n, r] = e.useState(null), i = Pu(t, r);
	return Wr(t, (e) => {
		e && !t && r(null);
	}), e.useMemo(() => ({
		openMethod: n,
		triggerProps: i
	}), [n, i]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/dialog/trigger/DialogTrigger.mjs
var Iu = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, disabled: o = !1, nativeButton: s = !0, id: c, payload: l, handle: u, ...d } = t, f = wi(!0), p = Al(u) ?? f;
	if (!p) throw Error(process.env.NODE_ENV === "production" ? xt(79) : "Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.");
	let m = fr(c), h = p.useState("floatingRootContext"), g = p.useState("isOpenedByTrigger", m), _ = p.useState("triggerPopupId", m), v = e.useRef(null), { registerTrigger: y, isMountedByThisTrigger: b } = pl(m, v, p, { payload: l }), { getButtonProps: x, buttonRef: S } = Ln({
		disabled: o,
		native: s
	}), C = Os(h), w = Pu(() => p.select("open"), (e) => {
		p.set("openMethod", e);
	}), T = {
		disabled: o,
		open: g
	}, E = p.useState("triggerProps", b);
	return Vt("button", t, {
		state: T,
		ref: [
			S,
			n,
			y,
			v
		],
		props: [
			C.reference,
			E,
			w,
			{
				[ts]: "",
				id: m,
				"aria-haspopup": "dialog",
				"aria-expanded": g,
				"aria-controls": _
			},
			d,
			x
		],
		stateAttributesMapping: Ai
	});
});
process.env.NODE_ENV !== "production" && (Iu.displayName = "DialogTrigger");
//#endregion
//#region src/components/ui/dialog.tsx
var Lu = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/dialog.tsx";
function Ru({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(ju, {
		"data-slot": "dialog",
		...e
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 11,
		columnNumber: 10
	}, this);
}
function zu({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Iu, {
		"data-slot": "dialog-trigger",
		...e
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 15,
		columnNumber: 10
	}, this);
}
function Bu({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(pu, {
		"data-slot": "dialog-portal",
		...e
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 19,
		columnNumber: 10
	}, this);
}
function Vu({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Pi, {
		"data-slot": "dialog-overlay",
		className: J("fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0", e),
		...t
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 31,
		columnNumber: 5
	}, this);
}
function Hu({ className: e, children: t, showCloseButton: n = !0, ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Bu, { children: [/* @__PURE__ */ (0, Y.jsxDEV)(Vu, {}, void 0, !1, {
		fileName: Lu,
		lineNumber: 52,
		columnNumber: 7
	}, this), /* @__PURE__ */ (0, Y.jsxDEV)(uu, {
		"data-slot": "dialog-content",
		className: J("fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", e),
		...r,
		children: [t, n && /* @__PURE__ */ (0, Y.jsxDEV)(Fi, {
			"data-slot": "dialog-close",
			render: /* @__PURE__ */ (0, Y.jsxDEV)(Un, {
				variant: "ghost",
				className: "absolute top-2 right-2",
				size: "icon-sm"
			}, void 0, !1, {
				fileName: Lu,
				lineNumber: 66,
				columnNumber: 15
			}, this),
			children: [/* @__PURE__ */ (0, Y.jsxDEV)(bi, {}, void 0, !1, {
				fileName: Lu,
				lineNumber: 73,
				columnNumber: 13
			}, this), /* @__PURE__ */ (0, Y.jsxDEV)("span", {
				className: "sr-only",
				children: "Close"
			}, void 0, !1, {
				fileName: Lu,
				lineNumber: 75,
				columnNumber: 13
			}, this)]
		}, void 0, !0, {
			fileName: Lu,
			lineNumber: 63,
			columnNumber: 11
		}, this)]
	}, void 0, !0, {
		fileName: Lu,
		lineNumber: 53,
		columnNumber: 7
	}, this)] }, void 0, !0, {
		fileName: Lu,
		lineNumber: 51,
		columnNumber: 5
	}, this);
}
function Uu({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "dialog-header",
		className: J("flex flex-col gap-2", e),
		...t
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 85,
		columnNumber: 5
	}, this);
}
function Wu({ className: e, showCloseButton: t = !1, children: n, ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "dialog-footer",
		className: J("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", e),
		...r,
		children: [n, t && /* @__PURE__ */ (0, Y.jsxDEV)(Fi, {
			render: /* @__PURE__ */ (0, Y.jsxDEV)(Un, { variant: "outline" }, void 0, !1, {
				fileName: Lu,
				lineNumber: 112,
				columnNumber: 40
			}, this),
			children: "Close"
		}, void 0, !1, {
			fileName: Lu,
			lineNumber: 112,
			columnNumber: 9
		}, this)]
	}, void 0, !0, {
		fileName: Lu,
		lineNumber: 102,
		columnNumber: 5
	}, this);
}
function Gu({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Mu, {
		"data-slot": "dialog-title",
		className: J("font-heading text-base leading-none font-medium", e),
		...t
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 122,
		columnNumber: 5
	}, this);
}
function Ku({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Ii, {
		"data-slot": "dialog-description",
		className: J("text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground", e),
		...t
	}, void 0, !1, {
		fileName: Lu,
		lineNumber: 138,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/positioner/MenuPositionerContext.mjs
var qu = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (qu.displayName = "MenuPositionerContext");
function Ju(t) {
	let n = e.useContext(qu);
	if (n === void 0 && !t) throw Error(process.env.NODE_ENV === "production" ? xt(33) : "Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/root/MenuRootContext.mjs
var Yu = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Yu.displayName = "MenuRootContext");
function Xu(t) {
	let n = e.useContext(Yu);
	if (n === void 0 && !t) throw Error(process.env.NODE_ENV === "production" ? xt(36) : "Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/context-menu/root/ContextMenuRootContext.mjs
var Zu = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Zu.displayName = "ContextMenuRootContext");
function Qu(t = !0) {
	let n = e.useContext(Zu);
	if (n === void 0 && !t) throw Error(process.env.NODE_ENV === "production" ? xt(25) : "Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/checkbox-item/MenuCheckboxItemContext.mjs
var $u = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && ($u.displayName = "MenuCheckboxItemContext");
function ed() {
	let t = e.useContext($u);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(30) : "Base UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/item/useMenuItemCommonProps.mjs
function td(t) {
	let { closeOnClick: n, highlighted: r, id: i, nodeId: a, store: o, typingRef: s, itemRef: c, itemMetadata: l } = t, { events: u } = o.useState("floatingTreeRoot"), d = o.useState("open"), f = Qu(!0), p = f !== void 0;
	return e.useMemo(() => ({
		id: i,
		role: "menuitem",
		tabIndex: d && r ? 0 : -1,
		onKeyDown(e) {
			e.key === " " && s?.current && e.preventDefault();
		},
		onMouseMove(e) {
			a && u.emit("itemhover", {
				nodeId: a,
				target: e.currentTarget
			});
		},
		onClick(e) {
			n && u.emit("close", {
				domEvent: e,
				reason: Fr
			});
		},
		onMouseUp(e) {
			if (f) {
				let t = f.initialCursorPointRef.current;
				if (f.initialCursorPointRef.current = null, p && t && Math.abs(e.clientX - t.x) <= 1 && Math.abs(e.clientY - t.y) <= 1 || p && !Yi && e.button === 2) return;
			}
			c.current && o.context.allowMouseUpTriggerRef.current && (!p || e.button === 2) && l.type === "regular-item" && In(c.current, e, { detail: 1 });
		}
	}), [
		n,
		r,
		i,
		u,
		a,
		d,
		o,
		s,
		c,
		f,
		p,
		l
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/item/useMenuItem.mjs
var nd = { type: "regular-item" };
function rd(t) {
	let { closeOnClick: n, disabled: r, highlighted: i, id: a, store: o, typingRef: s = o.context.typingRef, nativeButton: c, itemMetadata: l, nodeId: u } = t, d = e.useRef(null), { getButtonProps: f, buttonRef: p } = Ln({
		disabled: r,
		focusableWhenDisabled: !0,
		native: c,
		composite: !0
	}), m = td({
		closeOnClick: n,
		highlighted: i,
		id: a,
		nodeId: u,
		store: o,
		typingRef: s,
		itemRef: d,
		itemMetadata: l
	}), h = e.useCallback((e) => ot(m, { onMouseEnter() {
		l.type === "submenu-trigger" && l.setActive();
	} }, e, f), [
		m,
		f,
		l
	]), g = wt(d, p);
	return e.useMemo(() => ({
		getItemProps: h,
		itemRef: g
	}), [h, g]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/composite/list/CompositeListContext.mjs
var id = /*#__PURE__*/ e.createContext({
	register: () => {},
	unregister: () => {},
	subscribeMapChange: () => () => {},
	nextIndexRef: { current: 0 }
});
process.env.NODE_ENV !== "production" && (id.displayName = "CompositeListContext");
function ad() {
	return e.useContext(id);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/composite/list/useCompositeListItem.mjs
function od(t = {}) {
	let { guess: n, label: r, metadata: i, textRef: a, index: o } = t, { register: s, unregister: c, subscribeMapChange: l, nextIndexRef: u } = ad(), d = e.useRef(-1), [f, p] = e.useState(o == null && n ? () => {
		if (d.current === -1) {
			let e = u.current;
			u.current += 1, d.current = e;
		}
		return d.current;
	} : -1), m = o ?? f, h = e.useRef(null), g = e.useCallback((e) => {
		let t = h.current;
		t && c(t), h.current = e, e && s(e, {
			metadata: i ?? null,
			index: o ?? null,
			label: r,
			textRef: a
		});
	}, [
		o,
		s,
		c,
		i,
		r,
		a
	]);
	return Z(() => {
		if (o == null) return l((e) => {
			let t = h.current ? e.get(h.current)?.index : null;
			t != null && p(t);
		});
	}, [o, l]), {
		ref: g,
		index: m
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/checkbox-item/MenuCheckboxItemDataAttributes.mjs
var sd = /*#__PURE__*/ function(e) {
	return e.checked = "data-checked", e.unchecked = "data-unchecked", e.disabled = "data-disabled", e.highlighted = "data-highlighted", e;
}({}), cd = {
	checked(e) {
		return e ? { [sd.checked]: "" } : { [sd.unchecked]: "" };
	},
	...oi
}, ld = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, id: a, label: o, nativeButton: c = !1, disabled: l = !1, closeOnClick: u = !1, checked: d, defaultChecked: f, onCheckedChange: p, style: m, ...h } = t, g = od({
		guess: !0,
		label: o
	}), _ = Ju(!0), v = fr(a), { store: y } = Xu(), b = y.useState("disabled"), x = l || b, S = y.useState("isActive", g.index), C = y.useState("itemProps"), [w, T] = Qn({
		controlled: d,
		default: f ?? !1,
		name: "MenuCheckboxItem",
		state: "checked"
	}), { getItemProps: E, itemRef: D } = rd({
		closeOnClick: u,
		disabled: x,
		highlighted: S,
		id: v,
		store: y,
		nativeButton: c,
		nodeId: _?.context.nodeId,
		itemMetadata: nd
	}), O = e.useMemo(() => ({
		disabled: x,
		highlighted: S,
		checked: w
	}), [
		x,
		S,
		w
	]);
	function k(e) {
		let t = Ur(Fr, e.nativeEvent, void 0, { preventUnmountOnClose: Ft });
		p?.(!w, t), !t.isCanceled && T((e) => !e);
	}
	let A = Vt("div", t, {
		state: O,
		stateAttributesMapping: cd,
		props: [
			C,
			{
				role: "menuitemcheckbox",
				"aria-checked": w,
				onClick: k
			},
			h,
			E
		],
		ref: [
			D,
			n,
			g.ref
		]
	});
	return /*#__PURE__*/ s($u.Provider, {
		value: O,
		children: A
	});
});
process.env.NODE_ENV !== "production" && (ld.displayName = "MenuCheckboxItem");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/checkbox-item-indicator/MenuCheckboxItemIndicator.mjs
var ud = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, keepMounted: o = !1, ...s } = t, c = ed(), l = e.useRef(null), { transitionStatus: u, mounted: d, setMounted: f } = ni(c.checked);
	return ti({
		open: c.checked,
		ref: l,
		onComplete() {
			c.checked || f(!1);
		}
	}), Vt("span", t, {
		state: {
			checked: c.checked,
			disabled: c.disabled,
			highlighted: c.highlighted,
			transitionStatus: u
		},
		ref: [n, l],
		stateAttributesMapping: cd,
		props: {
			"aria-hidden": !0,
			...s
		},
		enabled: o || d
	});
});
process.env.NODE_ENV !== "production" && (ud.displayName = "MenuCheckboxItemIndicator");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/group/MenuGroupContext.mjs
var dd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (dd.displayName = "MenuGroupContext");
function fd() {
	let t = e.useContext(dd);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(31) : "Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/group/MenuGroup.mjs
var pd = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, ...o } = t, [c, l] = e.useState(void 0), u = Vt("div", t, {
		ref: n,
		props: {
			role: "group",
			"aria-labelledby": c,
			...o
		}
	});
	return /*#__PURE__*/ s(dd.Provider, {
		value: l,
		children: u
	});
});
process.env.NODE_ENV !== "production" && (pd.displayName = "MenuGroup");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/group-label/MenuGroupLabel.mjs
var md = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, style: i, id: a, ...o } = e, s = fr(a), c = fd();
	return Z(() => (c(s), () => {
		c((e) => e === s ? void 0 : e);
	}), [c, s]), Vt("div", e, {
		ref: t,
		props: {
			id: s,
			role: "presentation",
			...o
		}
	});
});
process.env.NODE_ENV !== "production" && (md.displayName = "MenuGroupLabel");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/item/MenuItem.mjs
var hd = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { render: n, className: r, id: i, label: a, nativeButton: o = !1, disabled: s = !1, closeOnClick: c = !0, style: l, ...u } = e, d = od({
		guess: !0,
		label: a
	}), f = Ju(!0), p = fr(i), { store: m } = Xu(), h = m.useState("disabled"), g = s || h, _ = m.useState("isActive", d.index), v = m.useState("itemProps"), { getItemProps: y, itemRef: b } = rd({
		closeOnClick: c,
		disabled: g,
		highlighted: _,
		id: p,
		store: m,
		nativeButton: o,
		nodeId: f?.context.nodeId,
		itemMetadata: nd
	});
	return Vt("div", e, {
		state: {
			disabled: g,
			highlighted: _
		},
		props: [
			v,
			u,
			y
		],
		ref: [
			b,
			t,
			d.ref
		]
	});
});
process.env.NODE_ENV !== "production" && (hd.displayName = "MenuItem");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/toolbar/root/ToolbarRootContext.mjs
var gd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (gd.displayName = "ToolbarRootContext");
function _d(t) {
	let n = e.useContext(gd);
	if (n === void 0 && !t) throw Error(process.env.NODE_ENV === "production" ? xt(69) : "Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/getDisabledMountTransitionStyles.mjs
function vd(e) {
	return e === "starting" ? es : Lt;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/popup/MenuPopup.mjs
var yd = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, finalFocus: o, ...c } = t, { store: l } = Xu(), { side: u, align: d } = Ju(), f = _d(!0) != null, p = l.useState("open"), m = l.useState("transitionStatus"), h = l.useState("popupProps"), g = l.useState("mounted"), _ = l.useState("instantType"), v = l.useState("activeTriggerElement"), y = l.useState("parent"), b = l.useState("lastOpenChangeReason"), x = l.useState("rootId"), S = l.useState("floatingRootContext"), C = l.useState("floatingTreeRoot"), w = l.useState("closeDelay"), T = l.useState("hoverEnabled"), E = l.useState("disabled"), D = l.useState("openMethod"), O = y.type === "context-menu";
	ti({
		open: p,
		ref: l.context.popupRef,
		onComplete() {
			p && l.context.onOpenChangeComplete?.(!0);
		}
	}), e.useEffect(() => {
		function e(e) {
			l.setOpen(!1, Ur(e.reason, e.domEvent));
		}
		return C.events.on("close", e), () => {
			C.events.off("close", e);
		};
	}, [C.events, l]), Bl(S, {
		enabled: T && !E && !O && y.type !== "menubar",
		closeDelay: w
	});
	let k = l.useStateSetter("popupElement"), A = Vt("div", t, {
		state: {
			transitionStatus: m,
			side: u,
			align: d,
			open: p,
			nested: y.type === "menu",
			instant: _
		},
		ref: [
			n,
			l.context.popupRef,
			k
		],
		stateAttributesMapping: Ni,
		props: [
			h,
			{ onKeyDown(e) {
				f && cu.has(e.key) && e.stopPropagation();
			} },
			vd(m),
			c,
			{ "data-rootownerid": x }
		]
	}), j = y.type === void 0 || O;
	return (v || y.type === "menubar" && b !== "outside-press") && (j = !0), /*#__PURE__*/ s(Ds, {
		context: S,
		openInteractionType: D,
		modal: O,
		disabled: !g,
		returnFocus: o === void 0 ? j : o,
		initialFocus: y.type !== "menu",
		restoreFocus: !0,
		externalTree: y.type === "menubar" ? void 0 : C,
		previousFocusableElement: v,
		nextFocusableElement: y.type === void 0 ? l.context.triggerFocusTargetRef : void 0,
		beforeContentFocusGuardRef: y.type === void 0 ? l.context.beforeContentFocusGuardRef : void 0,
		children: A
	});
});
process.env.NODE_ENV !== "production" && (yd.displayName = "MenuPopup");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/portal/MenuPortalContext.mjs
var bd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (bd.displayName = "MenuPortalContext");
function xd() {
	let t = e.useContext(bd);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(32) : "Base UI: <Menu.Portal> is missing.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/portal/MenuPortal.mjs
var Sd = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { keepMounted: n = !1, ...r } = e, { store: i } = Xu();
	return i.useState("mounted") || n ? /*#__PURE__*/ s(bd.Provider, {
		value: n,
		children: /*#__PURE__*/ s(ls, {
			ref: t,
			...r
		})
	}) : null;
});
process.env.NODE_ENV !== "production" && (Sd.displayName = "MenuPortal");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/direction-context/DirectionContext.mjs
var Cd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Cd.displayName = "DirectionContext");
function wd() {
	return e.useContext(Cd)?.direction ?? "ltr";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/floating-ui-react/middleware/arrow.mjs
var Td = (e) => ({
	name: "arrow",
	options: e,
	async fn(t) {
		let { x: n, y: r, placement: i, rects: a, platform: o, elements: s, middlewareData: c } = t, { element: l, padding: u = 0, offsetParent: d = "real" } = Ra(e, t) || {};
		if (l == null) return {};
		let f = no(u), p = {
			x: n,
			y: r
		}, m = Wa(i), h = Ha(m), g = await o.getDimensions(l), _ = m === "y", v = _ ? "top" : "left", y = _ ? "bottom" : "right", b = _ ? "clientHeight" : "clientWidth", x = a.reference[h] + a.reference[m] - p[m] - a.floating[h], S = p[m] - a.reference[m], C = d === "real" ? await o.getOffsetParent?.(l) : s.floating, w = s.floating[b] || a.floating[h];
		(!w || !await o.isElement?.(C)) && (w = s.floating[b] || a.floating[h]);
		let T = x / 2 - S / 2, E = w / 2 - g[h] / 2 - 1, D = Math.min(f[v], E), O = Math.min(f[y], E), k = D, A = w - g[h] - O, j = w / 2 - g[h] / 2 + T, M = La(k, j, A), N = !c.arrow && Ba(i) != null && j !== M && a.reference[h] / 2 - (j < k ? D : O) - g[h] / 2 < 0, P = N ? j < k ? j - k : j - A : 0;
		return {
			[m]: p[m] + P,
			data: {
				[m]: M,
				centerOffset: j - M - P,
				...N && { alignmentOffset: P }
			},
			reset: N
		};
	}
}), Ed = (e, t) => ({
	...Td(e),
	options: [e, t]
}), Dd = {
	name: "hide",
	async fn(e) {
		let { width: t, height: n, x: r, y: i } = e.rects.reference, a = t === 0 && n === 0 && r === 0 && i === 0, o = await e.platform.detectOverflow(e, { elementContext: "reference" });
		return { data: { referenceHidden: o.top - n >= 0 || o.right - t >= 0 || o.bottom - n >= 0 || o.left - t >= 0 || a } };
	}
}, Od = {
	sideX: "left",
	sideY: "top"
}, kd = "--available-width", Ad = "--available-height";
function jd(e, t, n) {
	let r = e === "inline-start" || e === "inline-end";
	return {
		top: "top",
		right: r ? n ? "inline-start" : "inline-end" : "right",
		bottom: "bottom",
		left: r ? n ? "inline-end" : "inline-start" : "left"
	}[t];
}
function Md(e, t, n) {
	let { rects: r, placement: i } = e;
	return {
		side: jd(t, za(i), n),
		align: Ba(i) || "center",
		anchor: {
			width: r.reference.width,
			height: r.reference.height
		},
		positioner: {
			width: r.floating.width,
			height: r.floating.height
		}
	};
}
function Nd(e) {
	return Pd(e, jl);
}
function Pd(t, n) {
	let { anchor: r, positionMethod: i = "absolute", side: a = "bottom", sideOffset: o = 0, align: s = "center", alignOffset: c = 0, collisionBoundary: l, collisionPadding: u = 5, sticky: d = !1, arrowPadding: f = 5, disableAnchorTracking: p = !1, inline: m, keepMounted: h = !1, floatingRootContext: g, mounted: _, collisionAvoidance: v, shift: y, nodeId: b, adaptiveOrigin: x, lazyFlip: S = !1, externalTree: C } = t, [w, T] = e.useState(null);
	!_ && w !== null && T(null);
	let E = v.side || "flip", D = v.align || "flip", O = v.fallbackAxisSide || "end", k = y?.crossAxis ?? !1, A = y?.rootBoundary, j = typeof r == "function" ? r : void 0, M = X(j), N = j ? M : r, P = Oa(r), F = Oa(_), I = wd() === "rtl", L = w || {
		top: "top",
		right: "right",
		bottom: "bottom",
		left: "left",
		"inline-end": I ? "left" : "right",
		"inline-start": I ? "right" : "left"
	}[a], R = s === "center" ? L : `${L}-${s}`, z = u;
	typeof z == "number" ? z = {
		top: z,
		right: z,
		bottom: z,
		left: z
	} : z &&= {
		top: z.top || 0,
		right: z.right || 0,
		bottom: z.bottom || 0,
		left: z.left || 0
	};
	let ee = +(a === "bottom"), B = +(a === "top"), V = +(a === "right"), H = +(a === "left"), te = {
		boundary: l === "clipping-ancestors" ? "clippingAncestors" : l,
		padding: z
	}, U = e.useRef(null), ne = Oa(o), W = Oa(c), re = typeof o == "function" ? 0 : o, ie = typeof c == "function" ? 0 : c, ae = [];
	m && ae.push(m), ae.push(Ac((e) => {
		let t = Md(e, a, I), n = typeof ne.current == "function" ? ne.current(t) : ne.current, r = typeof W.current == "function" ? W.current(t) : W.current;
		return {
			mainAxis: n,
			crossAxis: r,
			alignmentAxis: r
		};
	}, [
		re,
		ie,
		I,
		a
	]));
	let oe = D === "none" && E !== "shift", se = !oe && (d || k || E === "shift"), ce = E === "none" ? null : Nc({
		...te,
		padding: {
			top: z.top + 1 + ee,
			right: z.right + 1 + H,
			bottom: z.bottom + 1 + B,
			left: z.left + 1 + V
		},
		mainAxis: !k && E === "flip",
		crossAxis: D === "flip" && "alignment",
		fallbackAxisSideDirection: O
	}), le = oe ? null : jc({
		...te,
		rootBoundary: A,
		mainAxis: D !== "none",
		crossAxis: se,
		limiter: d || k ? void 0 : Mc((e) => {
			if (!U.current) return {};
			let { width: t, height: n } = U.current.getBoundingClientRect(), r = Ua(za(e.placement)), i = r === "y" ? t : n, a = r === "y" ? z.left + z.right : z.top + z.bottom;
			return { offset: i / 2 + a / 2 };
		})
	}, [
		te,
		d,
		k,
		A,
		z,
		D
	]);
	E === "shift" || D === "shift" || s === "center" ? ae.push(le, ce) : ae.push(ce, le), ae.push(Pc({
		...te,
		apply({ elements: { floating: e }, availableWidth: t, availableHeight: n, rects: r }) {
			if (!F.current) return;
			let i = e.style;
			i.setProperty(kd, `${t}px`), i.setProperty(Ad, `${n}px`);
			let a = tn(e).devicePixelRatio || 1, { x: o, y: s, width: c, height: l } = r.reference, u = (Math.round((o + c) * a) - Math.round(o * a)) / a, d = (Math.round((s + l) * a) - Math.round(s * a)) / a;
			i.setProperty("--anchor-width", `${u}px`), i.setProperty("--anchor-height", `${d}px`);
		}
	}), Ed((e) => ({
		element: U.current || Fn(e.elements.floating).createElement("div"),
		padding: f,
		offsetParent: "floating"
	}), [f]), {
		name: "transformOrigin",
		fn(e) {
			let { elements: t, middlewareData: n, placement: r, rects: i, y: s } = e, c = za(r), l = Ua(c), u = U.current, d = n.arrow?.x || 0, f = n.arrow?.y || 0, p = u?.clientWidth || 0, m = u?.clientHeight || 0, h = d + p / 2, g = f + m / 2, _ = Math.abs(n.shift?.y || 0), v = i.reference.height / 2, y = typeof o == "function" ? o(Md(e, a, I)) : o, b = _ > y, x = {
				top: `${h}px calc(100% + ${y}px)`,
				bottom: `${h}px ${-y}px`,
				left: `calc(100% + ${y}px) ${g}px`,
				right: `${-y}px ${g}px`
			}[c], S = `${h}px ${i.reference.y + v - s}px`;
			return t.floating.style.setProperty("--transform-origin", se && l === "y" && b ? S : x), {};
		}
	}, Dd, x), Z(() => {
		!_ && g && g.update({
			referenceElement: null,
			floatingElement: null,
			domReferenceElement: null,
			positionReference: null
		});
	}, [_, g]);
	let ue = e.useMemo(() => ({
		elementResize: !p && typeof ResizeObserver < "u",
		layoutShift: !p && typeof IntersectionObserver < "u"
	}), [p]), { refs: de, elements: G, x: fe, y: pe, middlewareData: me, update: he, placement: ge, context: _e, isPositioned: ve, floatingStyles: ye } = n({
		rootContext: g,
		open: h ? _ : void 0,
		placement: R,
		middleware: ae,
		strategy: i,
		whileElementsMounted: h ? void 0 : (...e) => _c(...e, ue),
		nodeId: b,
		externalTree: C
	}), { sideX: be, sideY: xe } = me.adaptiveOrigin || Od, Se = ve ? i : "fixed", K = e.useMemo(() => {
		let e;
		return e = ve ? x ? {
			position: Se,
			[be]: fe,
			[xe]: pe
		} : {
			...ye,
			position: Se
		} : {
			position: Se,
			top: 0,
			left: 0
		}, e[kd] = "100vw", e[Ad] = "100vh", ve || (e.opacity = 0), e;
	}, [
		x,
		Se,
		be,
		fe,
		xe,
		pe,
		ye,
		ve
	]), Ce = e.useRef(null);
	Z(() => {
		if (!_) return;
		let e = P.current, t = typeof e == "function" ? e() : e, n = (Fd(t) ? t.current : t) || null;
		n !== Ce.current && (de.setPositionReference(n), Ce.current = n);
	}, [
		_,
		de,
		N,
		P
	]), e.useEffect(() => {
		if (!_) return;
		let e = P.current;
		typeof e != "function" && Fd(e) && e.current !== Ce.current && (de.setPositionReference(e.current), Ce.current = e.current);
	}, [
		_,
		de,
		N,
		P
	]), e.useEffect(() => {
		if (h && _ && G.reference && G.floating) return _c(G.reference, G.floating, he, ue);
	}, [
		h,
		_,
		G,
		he,
		ue
	]);
	let we = za(ge), Te = jd(a, we, I), Ee = Ba(ge) || "center", De = !!me.hide?.referenceHidden;
	Z(() => {
		S && _ && ve && we !== L && T(we);
	}, [
		S,
		_,
		ve,
		we,
		L
	]);
	let Oe = e.useMemo(() => ({
		position: "absolute",
		top: me.arrow?.y,
		left: me.arrow?.x
	}), [me.arrow]), ke = me.arrow?.centerOffset !== 0;
	return e.useMemo(() => ({
		positionerStyles: K,
		arrowStyles: Oe,
		arrowRef: U,
		arrowUncentered: ke,
		side: Te,
		align: Ee,
		physicalSide: we,
		anchorHidden: De,
		refs: de,
		context: _e,
		isPositioned: ve,
		update: he
	}), [
		K,
		Oe,
		U,
		ke,
		Te,
		Ee,
		we,
		De,
		de,
		_e,
		ve,
		he
	]);
}
function Fd(e) {
	return e != null && "current" in e;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/composite/list/CompositeList.mjs
function Id(t) {
	let { children: n, elementsRef: r, labelsRef: i, onMapChange: a } = t, o = X(a), [, c] = e.useState(!1), l = Ct(Rd).current, u = Ct(Ld).current, d = e.useRef(0), f = e.useRef(!0), p = e.useRef([]), m = e.useRef(null), h = X(() => {
		f.current || (f.current = !0, c((e) => !e));
	}), g = X((e, t) => {
		u.set(e, t), h();
	}), _ = X((e) => {
		u.delete(e), h();
	}), v = X((e) => {
		let t = /* @__PURE__ */ new Map();
		return r.current.length = 0, i && (i.current.length = 0), e.forEach((e) => {
			t.set(e.element, {
				...e.registration.metadata ?? {},
				index: e.index
			}), r.current[e.index] = e.element, i && (i.current[e.index] = e.registration.label === void 0 ? e.registration.textRef?.current?.textContent ?? e.element.textContent : e.registration.label);
		}), d.current = r.current.length, t;
	});
	function y(e) {
		if (m.current?.disconnect(), m.current = null, typeof MutationObserver != "function" || e.length < 2) return;
		let t = new MutationObserver((n) => {
			if (!Vd(n)) return;
			let r = null;
			for (let n of e) if (n.isConnected) {
				if (r && Hd(r, n) > 0) {
					t.disconnect(), h();
					return;
				}
				r = n;
			}
		});
		m.current = t;
		let n = /* @__PURE__ */ new Set();
		for (let t = 1; t < e.length; t += 1) {
			let r = Bd(e[t - 1], e[t]);
			r && n.add(r);
		}
		n.forEach((e) => t.observe(e, { childList: !0 }));
	}
	let b = X(() => {
		let [e, t] = zd(u), n = v(e);
		y(t), p.current = e, f.current = !1, l.forEach((e) => e(n)), o(n);
	});
	Z(() => (f.current || v(p.current), () => {
		r.current = [], i && (i.current = []);
	}), [
		r,
		i,
		v
	]), Z(() => {
		f.current && b();
	}), Z(() => () => {
		m.current?.disconnect(), f.current = !0;
	}, []);
	let x = X((e) => (l.add(e), () => {
		l.delete(e);
	})), S = e.useMemo(() => ({
		register: g,
		unregister: _,
		subscribeMapChange: x,
		nextIndexRef: d
	}), [
		g,
		_,
		x,
		d
	]);
	return /*#__PURE__*/ s(id.Provider, {
		value: S,
		children: n
	});
}
function Ld() {
	return /* @__PURE__ */ new Map();
}
function Rd() {
	return /* @__PURE__ */ new Set();
}
function zd(e) {
	let t = /* @__PURE__ */ new Set(), n = [], r = [];
	e.forEach((e, i) => {
		if (!i.isConnected) return;
		let a = e.index, o = {
			index: a ?? -1,
			element: i,
			registration: e
		};
		a === null ? r.push(o) : a >= 0 && (t.add(a), n.push(o));
	});
	let i = 0;
	return r.sort((e, t) => Hd(e.element, t.element)), r.forEach((e) => {
		for (; t.has(i);) i += 1;
		e.index = i, n.push(e), i += 1;
	}), t.size > 0 && n.sort((e, t) => e.index - t.index), [n, r.map((e) => e.element)];
}
function Bd(e, t) {
	let n = e.parentElement;
	for (; n && !n.contains(t);) n = n.parentElement;
	return n;
}
function Vd(e) {
	for (let t of e) for (let e = 0; e < t.removedNodes.length; e += 1) if (t.removedNodes[e].isConnected) return !0;
	return !1;
}
function Hd(e, t) {
	return e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/usePositioner.mjs
function Ud(e, t, { styles: n, transitionStatus: r, props: i, refs: a, hidden: o, inert: s = !1 }) {
	let c = { ...n };
	return s && (c.pointerEvents = "none"), Vt("div", e, {
		state: t,
		ref: a,
		props: [
			{
				role: "presentation",
				hidden: o,
				style: c
			},
			vd(r),
			i
		],
		stateAttributesMapping: Mi
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/useAnchoredPopupScrollLock.mjs
var Wd = 20;
function Gd(t, n, r, i) {
	let [a, o] = e.useState(!1);
	Z(() => {
		if (!t || !n || r == null) {
			o(!1);
			return;
		}
		let e = Fn(r).documentElement.clientWidth, i = r.offsetWidth;
		o(e > 0 && i > 0 && i >= e - Wd);
	}, [
		t,
		n,
		r
	]), wu(t && (!n || a), i);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/positioner/MenuPositioner.mjs
var Kd = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { anchor: r, positionMethod: i = "absolute", className: a, render: o, side: l, align: u, sideOffset: d = 0, alignOffset: f = 0, collisionBoundary: p = "clipping-ancestors", collisionPadding: m = 5, arrowPadding: h = 5, sticky: g = !1, disableAnchorTracking: _ = !1, collisionAvoidance: v = ns, style: y, ...b } = t, { store: x } = Xu(), S = xd(), C = Qu(!0), w = x.useState("parent"), T = x.useState("floatingRootContext"), E = x.useState("floatingTreeRoot"), D = x.useState("mounted"), O = x.useState("open"), k = x.useState("modal"), A = x.useState("openMethod"), j = x.useState("activeTriggerElement"), M = x.useState("transitionStatus"), N = x.useState("positionerElement"), P = x.useState("instantType"), F = x.useState("adaptiveOrigin"), I = x.useState("lastOpenChangeReason"), L = x.useState("floatingNodeId"), R = x.useState("floatingParentNodeId"), z = T.useState("domReferenceElement"), ee = e.useRef(null), B = ei(N), V = r, H = d, te = f, U = u, ne = v;
	w.type === "context-menu" && (V = r ?? w.context?.anchor, U ??= "start", !l && U !== "center" && (te = t.alignOffset ?? 2, H = t.sideOffset ?? -5));
	let W = l, re = U;
	w.type === "menu" ? (W ??= "inline-end", re ??= "start", ne = t.collisionAvoidance ?? rs) : w.type === "menubar" && (W ??= w.context.orientation === "vertical" ? "inline-end" : "bottom", re ??= "start");
	let ie = w.type === "context-menu", ae = Nd({
		anchor: V,
		floatingRootContext: T,
		positionMethod: C ? "fixed" : i,
		mounted: D,
		side: W,
		sideOffset: H,
		align: re,
		alignOffset: te,
		arrowPadding: ie ? 0 : h,
		collisionBoundary: p,
		collisionPadding: m,
		sticky: g,
		nodeId: L,
		keepMounted: S,
		disableAnchorTracking: _,
		collisionAvoidance: ne,
		shift: ie ? {
			crossAxis: !("side" in ne && ne.side === "flip"),
			rootBoundary: "layoutViewport"
		} : void 0,
		externalTree: E,
		adaptiveOrigin: F
	});
	e.useEffect(() => {
		function e(e) {
			e.open && (e.parentNodeId === L && x.set("hoverEnabled", !1), e.nodeId !== L && e.parentNodeId === x.select("floatingParentNodeId") && x.setOpen(!1, Ur(Vr)));
		}
		return E.events.on("menuopenchange", e), () => {
			E.events.off("menuopenchange", e);
		};
	}, [
		x,
		E.events,
		L
	]), e.useEffect(() => {
		if (x.select("floatingParentNodeId") == null) return;
		function e(e) {
			if (e.open || e.nodeId !== x.select("floatingParentNodeId")) return;
			let t = e.reason ?? "sibling-open";
			x.setOpen(!1, Ur(t));
		}
		return E.events.on("menuopenchange", e), () => {
			E.events.off("menuopenchange", e);
		};
	}, [E.events, x]);
	let oe = zi();
	e.useEffect(() => {
		O || oe.clear();
	}, [O, oe]), e.useEffect(() => {
		function e(e) {
			if (!(!O || e.nodeId !== x.select("floatingParentNodeId"))) if (e.target && j && j !== e.target) {
				let e = x.select("closeDelay");
				e > 0 ? oe.isStarted() || oe.start(e, () => {
					x.setOpen(!1, Ur(Vr));
				}) : x.setOpen(!1, Ur(Vr));
			} else oe.clear();
		}
		return E.events.on("itemhover", e), () => {
			E.events.off("itemhover", e);
		};
	}, [
		E.events,
		O,
		j,
		x,
		oe
	]), e.useEffect(() => {
		let e = {
			open: O,
			nodeId: L,
			parentNodeId: R,
			reason: x.select("lastOpenChangeReason")
		};
		E.events.emit("menuopenchange", e);
	}, [
		E.events,
		O,
		x,
		L,
		R
	]), Z(() => {
		let e = z, t = ee.current;
		if (e && (ee.current = e), t && e && e !== t) {
			x.set("instantType", void 0);
			let e = new AbortController();
			return B(() => {
				x.set("instantType", "trigger-change");
			}, e.signal), () => {
				e.abort();
			};
		}
	}, [
		z,
		B,
		x
	]);
	let se = {
		open: O,
		side: ae.side,
		align: ae.align,
		anchorHidden: ae.anchorHidden,
		nested: w.type === "menu",
		instant: P
	}, ce = w.type === "menubar" && w.context.modal;
	Gd(O && (ce || k && I !== "trigger-hover"), A === "touch", N, j);
	let le = Ud(t, se, {
		styles: ae.positionerStyles,
		transitionStatus: M,
		props: b,
		refs: [n, x.useStateSetter("positionerElement")],
		hidden: !D,
		inert: !O
	}), ue = D && w.type !== "menu" && (w.type !== "menubar" && k && I !== "trigger-hover" || w.type === "menubar" && w.context.modal), de = null;
	return w.type === "menubar" ? de = w.context.contentElement : w.type === void 0 && (de = j), /*#__PURE__*/ c(qu.Provider, {
		value: ae,
		children: [ue && /*#__PURE__*/ s(fu, {
			ref: w.type === "context-menu" || w.type === "nested-context-menu" ? w.context.internalBackdropRef : null,
			inert: du(!O),
			cutout: de
		}), /*#__PURE__*/ s(_s, {
			id: L,
			children: /*#__PURE__*/ s(Id, {
				elementsRef: x.context.itemDomElements,
				labelsRef: x.context.itemLabels,
				children: le
			})
		})]
	});
});
process.env.NODE_ENV !== "production" && (Kd.displayName = "MenuPositioner");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/radio-group/MenuRadioGroupContext.mjs
var qd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (qd.displayName = "MenuRadioGroupContext");
function Jd() {
	let t = e.useContext(qd);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(34) : "Base UI: MenuRadioGroupContext is missing. MenuRadioGroup parts must be placed within <Menu.RadioGroup>.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/radio-group/MenuRadioGroup.mjs
var Yd = /*#__PURE__*/ e.memo(/*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, value: a, defaultValue: o, onValueChange: c, disabled: l = !1, style: u, "aria-labelledby": d, ...f } = t, [p, m] = e.useState(void 0), [h, g] = Qn({
		controlled: a,
		default: o,
		name: "MenuRadioGroup"
	}), _ = X((e, t) => {
		c?.(e, t), !t.isCanceled && g(e);
	}), v = Vt("div", t, {
		state: { disabled: l },
		ref: n,
		props: {
			role: "group",
			"aria-labelledby": d ?? p,
			"aria-disabled": l || void 0,
			...f
		}
	}), y = e.useMemo(() => ({
		value: h,
		setValue: _,
		disabled: l
	}), [
		h,
		_,
		l
	]);
	return /*#__PURE__*/ s(dd.Provider, {
		value: m,
		children: /*#__PURE__*/ s(qd.Provider, {
			value: y,
			children: v
		})
	});
}));
process.env.NODE_ENV !== "production" && (Yd.displayName = "MenuRadioGroup");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/radio-item/MenuRadioItemContext.mjs
var Xd = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (Xd.displayName = "MenuRadioItemContext");
function Zd() {
	let t = e.useContext(Xd);
	if (t === void 0) throw Error(process.env.NODE_ENV === "production" ? xt(35) : "Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.");
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/radio-item/MenuRadioItem.mjs
var Qd = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, id: a, label: o, nativeButton: c = !1, disabled: l = !1, closeOnClick: u = !1, value: d, style: f, ...p } = t, m = od({
		guess: !0,
		label: o
	}), h = Ju(!0), g = fr(a), { store: _ } = Xu(), v = _.useState("isActive", m.index), y = _.useState("itemProps"), { value: b, setValue: x, disabled: S } = Jd(), C = _.useState("disabled"), w = l || S || C, T = b === d, { getItemProps: E, itemRef: D } = rd({
		closeOnClick: u,
		disabled: w,
		highlighted: v,
		id: g,
		store: _,
		nativeButton: c,
		nodeId: h?.context.nodeId,
		itemMetadata: nd
	}), O = e.useMemo(() => ({
		disabled: w,
		highlighted: v,
		checked: T
	}), [
		w,
		v,
		T
	]);
	function k(e) {
		let t = Ur(Fr, e.nativeEvent, void 0, { preventUnmountOnClose: Ft });
		x(d, t);
	}
	let A = Vt("div", t, {
		state: O,
		stateAttributesMapping: cd,
		props: [
			y,
			{
				role: "menuitemradio",
				"aria-checked": T,
				onClick: k
			},
			p,
			E
		],
		ref: [
			D,
			n,
			m.ref
		]
	});
	return /*#__PURE__*/ s(Xd.Provider, {
		value: O,
		children: A
	});
});
process.env.NODE_ENV !== "production" && (Qd.displayName = "MenuRadioItem");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/radio-item-indicator/MenuRadioItemIndicator.mjs
var $d = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, keepMounted: o = !1, ...s } = t, c = Zd(), l = e.useRef(null), { transitionStatus: u, mounted: d, setMounted: f } = ni(c.checked);
	return ti({
		open: c.checked,
		ref: l,
		onComplete() {
			c.checked || f(!1);
		}
	}), Vt("span", t, {
		state: {
			checked: c.checked,
			disabled: c.disabled,
			highlighted: c.highlighted,
			transitionStatus: u
		},
		stateAttributesMapping: cd,
		ref: [n, l],
		props: {
			"aria-hidden": !0,
			...s
		},
		enabled: o || d
	});
});
process.env.NODE_ENV !== "production" && ($d.displayName = "MenuRadioItemIndicator");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menubar/MenubarContext.mjs
var ef = /*#__PURE__*/ e.createContext(null);
process.env.NODE_ENV !== "production" && (ef.displayName = "MenubarContext");
function tf(t) {
	let n = e.useContext(ef);
	if (n === null && !t) throw Error(process.env.NODE_ENV === "production" ? xt(5) : "Base UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.");
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/store/MenuStore.mjs
var nf = {
	...kl,
	disabled: (e) => e.parent.type === "menubar" && e.parent.context.disabled || e.disabled,
	modal: (e) => (e.parent.type === void 0 || e.parent.type === "context-menu") && (e.modal ?? !0),
	openMethod: (e) => e.openMethod,
	allowMouseEnter: (e) => e.allowMouseEnter,
	highlightItemOnHover: (e) => e.highlightItemOnHover,
	parent: (e) => e.parent,
	rootId: (e) => e.parent.type === "menu" ? e.parent.store.select("rootId") : e.parent.type === void 0 ? e.rootId : e.parent.context.rootId,
	activeIndex: (e) => e.activeIndex,
	isActive: (e, t) => e.activeIndex === t,
	hoverEnabled: (e) => e.hoverEnabled,
	instantType: (e) => e.instantType,
	lastOpenChangeReason: (e) => e.openChangeReason,
	floatingTreeRoot: (e) => e.parent.type === "menu" ? e.parent.store.select("floatingTreeRoot") : e.floatingTreeRoot,
	floatingNodeId: (e) => e.floatingNodeId,
	floatingParentNodeId: (e) => e.floatingParentNodeId,
	itemProps: (e) => e.itemProps,
	closeDelay: (e) => e.closeDelay,
	adaptiveOrigin: (e) => e.adaptiveOrigin,
	keyboardEventRelay: (e) => {
		if (e.keyboardEventRelay) return e.keyboardEventRelay;
		if (e.parent.type === "menu") return e.parent.store.select("keyboardEventRelay");
	}
}, rf = class extends nl {
	constructor(e) {
		super({
			...of(),
			...e
		}, af(), nf), this.unsubscribeParentListener = this.observe("parent", (e) => {
			if (this.unsubscribeParentListener?.(), e.type === "menu") {
				let t = e.store.select("rootId"), n = e.store.select("floatingTreeRoot"), r = e.store.select("keyboardEventRelay");
				this.unsubscribeParentListener = e.store.subscribe(() => {
					let i = e.store.select("rootId"), a = e.store.select("floatingTreeRoot"), o = e.store.select("keyboardEventRelay");
					(t !== i || n !== a || r !== o) && (t = i, n = a, r = o, this.notifyAll());
				}), this.context.allowMouseUpTriggerRef = e.store.context.allowMouseUpTriggerRef;
				return;
			}
			e.type !== void 0 && (this.context.allowMouseUpTriggerRef = e.context.allowMouseUpTriggerRef), this.unsubscribeParentListener = null;
		});
	}
	setOpen(e, t) {
		this.state.floatingRootContext.context.events.emit("setOpen", {
			open: e,
			eventDetails: t
		});
	}
	unsubscribeParentListener = null;
};
function af() {
	return {
		positionerRef: /*#__PURE__*/ e.createRef(),
		popupRef: /*#__PURE__*/ e.createRef(),
		typingRef: { current: !1 },
		itemDomElements: { current: [] },
		itemLabels: { current: [] },
		allowMouseUpTriggerRef: { current: !1 },
		triggerFocusTargetRef: /*#__PURE__*/ e.createRef(),
		beforeContentFocusGuardRef: /*#__PURE__*/ e.createRef(),
		onOpenChangeComplete: void 0,
		triggerElements: new bl()
	};
}
function of() {
	return {
		...Sl(),
		disabled: !1,
		modal: !0,
		openMethod: null,
		allowMouseEnter: !1,
		highlightItemOnHover: !0,
		parent: { type: void 0 },
		rootId: void 0,
		activeIndex: null,
		hoverEnabled: !0,
		instantType: void 0,
		openChangeReason: null,
		floatingTreeRoot: new ds(),
		floatingNodeId: void 0,
		floatingParentNodeId: null,
		itemProps: Lt,
		keyboardEventRelay: void 0,
		closeDelay: 0,
		adaptiveOrigin: void 0
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/submenu-root/MenuSubmenuRootContext.mjs
var sf = /*#__PURE__*/ e.createContext(void 0);
process.env.NODE_ENV !== "production" && (sf.displayName = "MenuSubmenuRootContext");
function cf() {
	return e.useContext(sf);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/root/MenuRoot.mjs
var lf = Gc(function(t) {
	let { children: n, open: r, onOpenChange: i, onOpenChangeComplete: a, defaultOpen: o = !1, disabled: l = !1, modal: u, loopFocus: d = !0, orientation: f = "vertical", actionsRef: p, closeParentOnEsc: m = !1, handle: h, triggerId: g, defaultTriggerId: _ = null, highlightItemOnHover: v = !0 } = t, y = Qu(!0), b = Xu(!0), x = tf(!0), S = cf(), C = e.useMemo(() => S && b ? {
		type: "menu",
		store: b.store
	} : x ? {
		type: "menubar",
		context: x
	} : y && !b ? {
		type: "context-menu",
		context: y
	} : { type: void 0 }, [
		y,
		b,
		x,
		S
	]), w = uf({
		open: o,
		openProp: r,
		activeTriggerId: _,
		triggerIdProp: g,
		parent: C
	});
	w.useControlledProp("openProp", r), w.useControlledProp("triggerIdProp", g), w.useContextCallback("onOpenChangeComplete", a);
	let T = dr(), E = dr(), D = w.useState("floatingTreeRoot"), O = gs(D), k = ms(), A = w.useState("open"), j = w.useState("activeTriggerElement"), M = w.useState("positionerElement"), N = w.useState("hoverEnabled"), P = w.useState("disabled"), F = w.useState("lastOpenChangeReason"), I = w.useState("parent"), L = w.useState("activeIndex"), R = w.useState("payload"), z = w.useState("floatingParentNodeId"), ee = e.useRef(null), B = e.useRef(I.type !== "context-menu"), V = zi(), H = e.useRef(!0), te = zi(), U = z != null;
	process.env.NODE_ENV !== "production" && I.type !== void 0 && u !== void 0 && console.warn("Base UI: The `modal` prop is not supported on nested menus. It will be ignored.");
	let { openMethod: ne, triggerProps: W } = Fu(A);
	w.useSyncedValues({
		disabled: l,
		highlightItemOnHover: v,
		modal: I.type === void 0 ? u : void 0,
		openMethod: ne,
		rootId: T
	}), ml(w);
	let { forceUnmount: re } = hl(A, w, () => {
		w.set("allowMouseEnter", !1);
	});
	Z(() => {
		y && !b ? w.update({
			parent: {
				type: "context-menu",
				context: y
			},
			floatingNodeId: O,
			floatingParentNodeId: k
		}) : b && w.update({
			floatingNodeId: O,
			floatingParentNodeId: k
		});
	}, [
		y,
		b,
		O,
		k,
		w
	]), e.useEffect(() => {
		if (A || (ee.current = null), I.type === "context-menu") {
			if (!A) {
				V.clear(), B.current = !1;
				return;
			}
			V.start(500, () => {
				B.current = !0;
			});
		}
	}, [
		V,
		A,
		I.type
	]), Z(() => {
		!A && !N && w.set("hoverEnabled", !0);
	}, [
		A,
		N,
		w
	]);
	let ie = X((e, t) => {
		let n = t.reason;
		if (!e && !w.select("open") || A === e && t.trigger === j && F === n) return;
		let r = fl(t);
		if (!e && t.trigger == null && (t.trigger = j ?? void 0), i?.(e, t), t.isCanceled) return;
		w.state.floatingRootContext.dispatchOpenChange(e, t);
		let a = t.event;
		if (e === !1 && a?.type === "click" && a.pointerType === "touch" && !H.current) return;
		e && n === "trigger-focus" ? (H.current = !1, te.start(300, () => {
			H.current = !0;
		})) : (H.current = !0, te.clear());
		let o = (n === "trigger-press" || n === "item-press") && a.detail === 0, s = !e && (n === "escape-key" || n == null), c = {
			open: e,
			openChangeReason: n
		};
		ee.current = t.event, dl(c, e, t.trigger, r()), w.update(c), I.type === "menubar" && (n === "trigger-focus" || n === "focus-out" || n === "trigger-hover" || n === "list-navigation" || n === "sibling-open") ? w.set("instantType", "group") : o || s ? w.set("instantType", o ? "click" : "dismiss") : w.set("instantType", void 0);
	}), ae = al({
		popupStore: w,
		floatingId: E,
		nested: k != null,
		onOpenChange: ie
	}), oe = ae.context.events;
	Z(() => {
		let e = ({ open: e, eventDetails: t }) => ie(e, t);
		return oe.on("setOpen", e), () => {
			oe?.off("setOpen", e);
		};
	}, [oe, ie]);
	let se = e.useCallback(() => {
		w.setOpen(!1, Ur(Hr));
	}, [w]);
	e.useImperativeHandle(p, () => ({
		unmount: re,
		close: se
	}), [re, se]);
	let ce;
	I.type === "context-menu" && (ce = I.context), e.useImperativeHandle(ce?.positionerRef, () => M, [M]), e.useImperativeHandle(ce?.actionsRef, () => ({ setOpen: ie }), [ie]);
	let le = js(ae, {
		enabled: !P,
		bubbles: { escapeKey: m && I.type === "menu" },
		outsidePress() {
			return I.type !== "context-menu" || ee.current?.type === "contextmenu" || B.current;
		},
		externalTree: U ? D : void 0
	}), ue = wd(), de = e.useCallback((e) => {
		w.select("activeIndex") !== e && w.set("activeIndex", e);
	}, [w]), G = Xl(ae, {
		enabled: !P,
		listRef: w.context.itemDomElements,
		activeIndex: L,
		nested: I.type !== void 0,
		loopFocus: d,
		orientation: f,
		parentOrientation: I.type === "menubar" ? I.context.orientation : void 0,
		rtl: ue === "rtl",
		disabledIndices: It,
		onNavigate: de,
		openOnArrowKeyDown: I.type !== "context-menu",
		externalTree: U ? D : void 0,
		focusItemOnHover: v
	}), fe = e.useCallback((e) => {
		w.context.typingRef.current = e;
	}, [w]), pe = Zl(ae, {
		enabled: !P,
		listRef: w.context.itemLabels,
		elementsRef: w.context.itemDomElements,
		activeIndex: L,
		resetMs: 500,
		onMatch: (e) => {
			A && e !== L && w.set("activeIndex", e);
		},
		onTyping: fe
	});
	gl(w, {
		floatingRootContext: ae,
		activeTriggerProps: e.useMemo(() => {
			let e = ot(pe.reference, G.reference, le.reference, { onMouseMove() {
				w.set("allowMouseEnter", !0);
			} }, W);
			return e["aria-haspopup"] = "menu", e["aria-expanded"] = A, e;
		}, [
			w,
			pe.reference,
			G.reference,
			le.reference,
			W,
			A
		]),
		inactiveTriggerProps: e.useMemo(() => {
			let e = ot(G.trigger, le.trigger, W);
			return e["aria-haspopup"] = "menu", e["aria-expanded"] = !1, e;
		}, [
			G.trigger,
			le.trigger,
			W
		]),
		popupProps: e.useMemo(() => ot(ol, {
			id: E,
			role: "menu",
			"aria-labelledby": j?.id,
			onMouseMove() {
				w.set("allowMouseEnter", !0), I.type === "menu" && w.set("hoverEnabled", !1);
			},
			onClick() {
				w.select("hoverEnabled") && w.set("hoverEnabled", !1);
			},
			onKeyDown(e) {
				let t = w.select("keyboardEventRelay");
				t && !e.isPropagationStopped() && t(e);
			}
		}, pe.floating, G.floating, le.floating), [
			j,
			E,
			I.type,
			w,
			pe.floating,
			G.floating,
			le.floating
		]),
		itemProps: G.item ?? Lt
	});
	let me = e.useMemo(() => ({
		store: w,
		parent: C
	}), [w, C]), he = /*#__PURE__*/ c(Yu.Provider, {
		value: me,
		children: [h && /*#__PURE__*/ s(ll, {
			handle: h,
			store: w
		}), typeof n == "function" ? n({ payload: R }) : n]
	});
	return I.type === void 0 || I.type === "context-menu" ? /*#__PURE__*/ s(vs, {
		externalTree: D,
		children: he
	}) : he;
});
process.env.NODE_ENV !== "production" && (lf.displayName = "MenuRoot");
function uf(e) {
	return Ct(() => new rf(e)).current;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/submenu-root/MenuSubmenuRoot.mjs
function df(t) {
	let n = Xu().store, r = e.useMemo(() => ({ parentMenu: n }), [n]);
	return /*#__PURE__*/ s(sf.Provider, {
		value: r,
		children: /*#__PURE__*/ s(lf, { ...t })
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/getPseudoElementBounds.mjs
var ff = 5;
function pf(e, t) {
	let n = mf(t);
	return e.clientX >= n.left - ff && e.clientX <= n.right + ff && e.clientY >= n.top - ff && e.clientY <= n.bottom + ff;
}
function mf(e) {
	let t = e.getBoundingClientRect(), n = tn(e);
	if ($i) return t;
	let r = n.getComputedStyle(e, "::before"), i = n.getComputedStyle(e, "::after");
	if (r.content === "none" && i.content === "none") return t;
	let a = parseFloat(r.width) || 0, o = parseFloat(r.height) || 0, s = parseFloat(i.width) || 0, c = parseFloat(i.height) || 0, l = Math.max(t.width, a, s), u = Math.max(t.height, o, c), d = l - t.width, f = u - t.height;
	return {
		left: t.left - d / 2,
		right: t.right + d / 2,
		top: t.top - f / 2,
		bottom: t.bottom + f / 2
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/composite/item/useCompositeItem.mjs
function hf(t = {}) {
	let { highlightItemOnHover: n, highlightedIndex: r, onHighlightedIndexChange: i } = Nn(), { ref: a, index: o } = od(t), s = r === o, c = e.useRef(null), l = wt(a, c);
	return {
		compositeProps: {
			tabIndex: s ? 0 : -1,
			onFocus() {
				i(o);
			},
			onMouseMove() {
				let e = c.current;
				if (!n || !e) return;
				let t = e.hasAttribute("disabled") || e.ariaDisabled === "true";
				!s && !t && e.focus();
			}
		},
		compositeRef: l,
		index: o
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/composite/item/CompositeItem.mjs
function gf(e) {
	let { render: t, className: n, style: r, state: i = Lt, props: a = It, refs: o = It, metadata: s, stateAttributesMapping: c, tag: l = "div", ...u } = e, { compositeProps: d, compositeRef: f } = hf({ metadata: s });
	return Vt(l, e, {
		state: i,
		ref: [f, ...o],
		props: [
			d,
			...a,
			u
		],
		stateAttributesMapping: c
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/utils/findRootOwnerId.mjs
function _f(e) {
	if (on(e) && e.hasAttribute("data-rootownerid")) return e.getAttribute("data-rootownerid");
	if (!vn(e)) return _f(xn(e));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/popups/useTriggerFocusGuards.mjs
function vf(t, n) {
	let r = e.useRef(null);
	function i(e) {
		l.flushSync(() => {
			t.setOpen(!1, Ur(Lr, e.nativeEvent, e.currentTarget));
		}), No(r.current)?.focus();
	}
	function a(e) {
		let r = t.select("positionerElement");
		if (r && Po(e, r)) t.context.beforeContentFocusGuardRef.current?.focus();
		else {
			l.flushSync(() => {
				t.setOpen(!1, Ur(Lr, e.nativeEvent, e.currentTarget));
			});
			let i = Mo(t.context.triggerFocusTargetRef.current || n.current);
			for (; i !== null && Q(r, i);) {
				let e = i;
				if (i = ko(i), i === e) break;
			}
			i?.focus();
		}
	}
	return {
		preFocusGuardRef: r,
		handlePreFocusGuardFocus: i,
		handleFocusTargetFocus: a
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/utils/useMixedToggleClickHandler.mjs
function yf(t) {
	let { enabled: n = !0, mouseDownAction: r, open: i } = t, a = e.useRef(!1);
	return e.useMemo(() => n ? {
		onMouseDown: (e) => {
			(r === "open" && !i || r === "close" && i) && (a.current = !0, Fn(e.currentTarget).addEventListener("click", () => {
				a.current = !1;
			}, { once: !0 }));
		},
		onClick: (e) => {
			a.current && (a.current = !1, e.preventBaseUIHandler());
		}
	} : Lt, [
		n,
		r,
		i
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/trigger/MenuTrigger.mjs
var bf = Kc(function(t, n) {
	let { render: r, className: i, style: a, disabled: o = !1, nativeButton: l = !0, id: u, openOnHover: d, delay: f = 100, closeDelay: p = 0, handle: m, payload: h, ...g } = t, _ = Xu(!0), v = Al(m) ?? _?.store;
	if (!v) throw Error(process.env.NODE_ENV === "production" ? xt(85) : "Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.");
	let y = fr(u), b = v.useState("isTriggerActive", y), x = v.useState("floatingRootContext"), S = v.useState("isOpenedByTrigger", y), C = v.useState("triggerPopupId", y), w = e.useRef(null), T = Sf(), E = Nn(!0), D = hs(), O = e.useMemo(() => D ?? new ds(), [D]), { registerTrigger: k, isMountedByThisTrigger: A } = pl(y, w, v, {
		payload: h,
		closeDelay: p,
		parent: T,
		floatingTreeRoot: O,
		floatingNodeId: gs(O),
		floatingParentNodeId: ms(),
		keyboardEventRelay: E?.relayKeyboardEvent
	}), j = T.type === "menubar", M = v.useState("disabled"), N = o || M || j && T.context.disabled, { getButtonProps: P, buttonRef: F } = Ln({
		disabled: N,
		native: l
	});
	e.useEffect(() => {
		!S && T.type === void 0 && (v.context.allowMouseUpTriggerRef.current = !1);
	}, [
		v,
		S,
		T.type
	]);
	let I = e.useRef(null), L = zi(), R = X((e) => {
		if (!I.current) return;
		L.clear(), v.context.allowMouseUpTriggerRef.current = !1;
		let t = e.target;
		Q(I.current, t) || Q(v.select("positionerElement"), t) || t === I.current || (t == null || _f(t) !== v.select("rootId")) && (pf(e, I.current) || O.events.emit("close", {
			domEvent: e,
			reason: Br
		}));
	});
	e.useEffect(() => {
		S && v.select("lastOpenChangeReason") === "trigger-hover" && Fn(I.current).addEventListener("mouseup", R, { once: !0 });
	}, [
		S,
		R,
		v
	]);
	let z = j && T.context.hasSubmenuOpen, ee = Hl(x, {
		enabled: (d ?? z) && !N && (!j || z && !A),
		handleClose: au({ blockPointerEvents: !j }),
		mouseOnly: !0,
		move: !1,
		restMs: T.type === void 0 ? f : void 0,
		delay: { close: p },
		triggerElementRef: w,
		externalTree: O,
		isActiveTrigger: b,
		isClosing: () => v.select("transitionStatus") === "ending"
	}), B = xf(S, v.select("lastOpenChangeReason")), V = Os(x, {
		enabled: !N,
		event: S && j ? "click" : "mousedown",
		toggle: !0,
		ignoreMouse: !1,
		stickIfOpen: T.type === void 0 && B
	}), H = Pl(x, { enabled: !N && z }), te = yf({
		open: S,
		enabled: j,
		mouseDownAction: "open"
	}), U = e.useMemo(() => ot(H.reference, V.reference), [H.reference, V.reference]), ne = v.useState("triggerProps", A), { preFocusGuardRef: W, handlePreFocusGuardFocus: re, handleFocusTargetFocus: ie } = vf(v, w), ae = {
		disabled: N,
		open: S
	}, oe = [
		I,
		n,
		F,
		k,
		w
	], se = [
		U,
		ee ?? Lt,
		ne,
		{
			"aria-haspopup": "menu",
			"aria-controls": C,
			id: y,
			onMouseDown: (e) => {
				v.select("open") || (L.start(200, () => {
					v.context.allowMouseUpTriggerRef.current = !0;
				}), Fn(e.currentTarget).addEventListener("mouseup", R, { once: !0 }));
			}
		},
		j ? { role: "menuitem" } : {},
		te,
		g,
		P
	], ce = Vt("button", t, {
		enabled: !j,
		stateAttributesMapping: ji,
		state: ae,
		ref: oe,
		props: se
	});
	return j ? /*#__PURE__*/ s(gf, {
		tag: "button",
		render: r,
		className: i,
		style: a,
		state: ae,
		refs: oe,
		props: se,
		stateAttributesMapping: ji
	}) : S ? /*#__PURE__*/ c(e.Fragment, { children: [
		/*#__PURE__*/ s(Aa, {
			ref: W,
			onFocus: re
		}, `${y}-pre-focus-guard`),
		/*#__PURE__*/ s(e.Fragment, { children: ce }, y),
		/*#__PURE__*/ s(Aa, {
			ref: v.context.triggerFocusTargetRef,
			onFocus: ie
		}, `${y}-post-focus-guard`)
	] }) : /*#__PURE__*/ s(e.Fragment, { children: ce }, y);
});
process.env.NODE_ENV !== "production" && (bf.displayName = "MenuTrigger");
function xf(t, n) {
	let r = zi(), [i, a] = e.useState(!1);
	return Z(() => {
		t && n === "trigger-hover" ? (a(!0), r.start(500, () => {
			a(!1);
		})) : t || (r.clear(), a(!1));
	}, [
		t,
		n,
		r
	]), i;
}
function Sf() {
	let t = tf(!0);
	return e.useMemo(() => t ? {
		type: "menubar",
		context: t
	} : { type: void 0 }, [t]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/separator/Separator.mjs
var Cf = /*#__PURE__*/ e.forwardRef(function(e, t) {
	let { className: n, render: r, orientation: i = "horizontal", style: a, ...o } = e;
	return Vt("div", e, {
		state: { orientation: i },
		ref: t,
		props: [{
			role: "separator",
			"aria-orientation": i
		}, o]
	});
});
process.env.NODE_ENV !== "production" && (Cf.displayName = "Separator");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.3.2_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/utils/isElementDisabled.mjs
function wf(e) {
	return e == null || e.hasAttribute("disabled") || e.getAttribute("aria-disabled") === "true";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/menu/submenu-trigger/MenuSubmenuTrigger.mjs
var Tf = { "aria-expanded": void 0 }, Ef = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, style: a, label: o, id: s, nativeButton: c = !1, openOnHover: l = !0, delay: u = 100, closeDelay: d = 0, disabled: f = !1, ...p } = t, m = cf();
	if (!m?.parentMenu) throw Error(process.env.NODE_ENV === "production" ? xt(37) : "Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.");
	let h = od({
		guess: !0,
		label: o
	}), g = Ju(), { store: _ } = Xu(), v = fr(s), y = _.useState("open"), b = _.useState("floatingRootContext"), x = _.useState("floatingTreeRoot"), S = _.useState("triggerPopupId", v), C = ul(v, _), w = e.useCallback((e) => {
		let t = C(e);
		return e !== null && _.select("open") && _.select("activeTriggerId") == null && _.update({
			activeTriggerId: v,
			activeTriggerElement: e,
			closeDelay: d
		}), t;
	}, [
		C,
		d,
		_,
		v
	]), T = e.useRef(null), E = e.useCallback((e) => {
		T.current = e, _.set("activeTriggerElement", e);
	}, [_]);
	_.useSyncedValue("closeDelay", d);
	let D = m.parentMenu, O = _.useState("disabled"), k = D.useState("disabled"), A = f || O || k;
	process.env.NODE_ENV !== "production" && e.useEffect(() => {
		let e = T.current;
		e && wf(e) && !A && Pt(`A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the \`disabled\` prop on the component instead of setting it on the rendered element.${Tn.captureOwnerStack?.() || ""}`);
	});
	let j = D.useState("itemProps"), M = D.useState("isActive", h.index), N = e.useMemo(() => ({
		type: "submenu-trigger",
		setActive() {
			D.select("highlightItemOnHover") && D.set("activeIndex", h.index);
		}
	}), [D, h.index]), { getItemProps: P, itemRef: F } = rd({
		closeOnClick: !1,
		disabled: A,
		highlighted: M,
		id: v,
		store: _,
		typingRef: D.context.typingRef,
		nativeButton: c,
		itemMetadata: N,
		nodeId: g?.context.nodeId
	}), I = Hl(b, {
		enabled: _.useState("hoverEnabled") && l && !A,
		handleClose: au({ blockPointerEvents: !0 }),
		mouseOnly: !0,
		move: !0,
		restMs: u,
		delay: {
			open: u,
			close: d
		},
		shouldOpen: u > 0 ? () => D.select("allowMouseEnter") : void 0,
		triggerElementRef: T,
		externalTree: x,
		isClosing: () => _.select("transitionStatus") === "ending",
		guardStaleOpen: !0
	}), L = Os(b, {
		enabled: !A,
		event: "mousedown",
		toggle: !l,
		ignoreMouse: l,
		stickIfOpen: !1
	}).reference ?? Lt, R = _.useState("triggerProps", !0);
	delete R.id;
	let z = {
		disabled: A,
		highlighted: M,
		open: y
	}, ee = _.useState("openMethod"), B = _.useState("lastOpenChangeReason") === "list-navigation" || ee === "keyboard";
	return Vt("div", t, {
		state: z,
		stateAttributesMapping: Ai,
		props: [
			L,
			I,
			R,
			j,
			y && B && Qi ? Tf : void 0,
			{
				"aria-controls": S,
				tabIndex: y || M ? 0 : -1,
				onBlur() {
					M && D.set("activeIndex", null);
				}
			},
			p,
			P
		],
		ref: [
			n,
			h.ref,
			F,
			w,
			E
		]
	});
});
process.env.NODE_ENV !== "production" && (Ef.displayName = "MenuSubmenuTrigger");
//#endregion
//#region src/components/ui/dropdown-menu.tsx
var Df = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/dropdown-menu.tsx";
function Of({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(lf, {
		"data-slot": "dropdown-menu",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 10,
		columnNumber: 10
	}, this);
}
function kf({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Sd, {
		"data-slot": "dropdown-menu-portal",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 14,
		columnNumber: 10
	}, this);
}
function Af({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(bf, {
		"data-slot": "dropdown-menu-trigger",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 18,
		columnNumber: 10
	}, this);
}
function jf({ align: e = "start", alignOffset: t = 0, side: n = "bottom", sideOffset: r = 4, className: i, ...a }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Sd, { children: /* @__PURE__ */ (0, Y.jsxDEV)(Kd, {
		className: "isolate z-50 outline-none",
		align: e,
		alignOffset: t,
		side: n,
		sideOffset: r,
		children: /* @__PURE__ */ (0, Y.jsxDEV)(yd, {
			"data-slot": "dropdown-menu-content",
			className: J("z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", i),
			...a
		}, void 0, !1, {
			fileName: Df,
			lineNumber: 42,
			columnNumber: 9
		}, this)
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 35,
		columnNumber: 7
	}, this) }, void 0, !1, {
		fileName: Df,
		lineNumber: 34,
		columnNumber: 5
	}, this);
}
function Mf({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(pd, {
		"data-slot": "dropdown-menu-group",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 53,
		columnNumber: 10
	}, this);
}
function Nf({ className: e, inset: t, ...n }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(md, {
		"data-slot": "dropdown-menu-label",
		"data-inset": t,
		className: J("px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7", e),
		...n
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 64,
		columnNumber: 5
	}, this);
}
function Pf({ className: e, inset: t, variant: n = "default", ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(hd, {
		"data-slot": "dropdown-menu-item",
		"data-inset": t,
		"data-variant": n,
		className: J("group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive", e),
		...r
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 86,
		columnNumber: 5
	}, this);
}
function Ff({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(df, {
		"data-slot": "dropdown-menu-sub",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 100,
		columnNumber: 10
	}, this);
}
function If({ className: e, inset: t, children: n, ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Ef, {
		"data-slot": "dropdown-menu-sub-trigger",
		"data-inset": t,
		className: J("flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", e),
		...r,
		children: [n, /* @__PURE__ */ (0, Y.jsxDEV)(yi, { className: "ml-auto" }, void 0, !1, {
			fileName: Df,
			lineNumber: 122,
			columnNumber: 7
		}, this)]
	}, void 0, !0, {
		fileName: Df,
		lineNumber: 112,
		columnNumber: 5
	}, this);
}
function Lf({ align: e = "start", alignOffset: t = -3, side: n = "right", sideOffset: r = 0, className: i, ...a }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(jf, {
		"data-slot": "dropdown-menu-sub-content",
		className: J("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", i),
		align: e,
		alignOffset: t,
		side: n,
		sideOffset: r,
		...a
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 136,
		columnNumber: 5
	}, this);
}
function Rf({ className: e, children: t, checked: n, inset: r, ...i }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(ld, {
		"data-slot": "dropdown-menu-checkbox-item",
		"data-inset": r,
		className: J("relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", e),
		checked: n,
		...i,
		children: [/* @__PURE__ */ (0, Y.jsxDEV)("span", {
			className: "pointer-events-none absolute right-2 flex items-center justify-center",
			"data-slot": "dropdown-menu-checkbox-item-indicator",
			children: /* @__PURE__ */ (0, Y.jsxDEV)(ud, { children: /* @__PURE__ */ (0, Y.jsxDEV)(vi, {}, void 0, !1, {
				fileName: Df,
				lineNumber: 173,
				columnNumber: 11
			}, this) }, void 0, !1, {
				fileName: Df,
				lineNumber: 172,
				columnNumber: 9
			}, this)
		}, void 0, !1, {
			fileName: Df,
			lineNumber: 168,
			columnNumber: 7
		}, this), t]
	}, void 0, !0, {
		fileName: Df,
		lineNumber: 158,
		columnNumber: 5
	}, this);
}
function zf({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Yd, {
		"data-slot": "dropdown-menu-radio-group",
		...e
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 184,
		columnNumber: 5
	}, this);
}
function Bf({ className: e, children: t, inset: n, ...r }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Qd, {
		"data-slot": "dropdown-menu-radio-item",
		"data-inset": n,
		className: J("relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", e),
		...r,
		children: [/* @__PURE__ */ (0, Y.jsxDEV)("span", {
			className: "pointer-events-none absolute right-2 flex items-center justify-center",
			"data-slot": "dropdown-menu-radio-item-indicator",
			children: /* @__PURE__ */ (0, Y.jsxDEV)($d, { children: /* @__PURE__ */ (0, Y.jsxDEV)(vi, {}, void 0, !1, {
				fileName: Df,
				lineNumber: 214,
				columnNumber: 11
			}, this) }, void 0, !1, {
				fileName: Df,
				lineNumber: 213,
				columnNumber: 9
			}, this)
		}, void 0, !1, {
			fileName: Df,
			lineNumber: 209,
			columnNumber: 7
		}, this), t]
	}, void 0, !0, {
		fileName: Df,
		lineNumber: 200,
		columnNumber: 5
	}, this);
}
function Vf({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Cf, {
		"data-slot": "dropdown-menu-separator",
		className: J("-mx-1 my-1 h-px bg-border", e),
		...t
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 228,
		columnNumber: 5
	}, this);
}
function Hf({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("span", {
		"data-slot": "dropdown-menu-shortcut",
		className: J("ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground", e),
		...t
	}, void 0, !1, {
		fileName: Df,
		lineNumber: 241,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs
function Uf(t = {}) {
	let { id: n, implicit: r = !1, controlRef: i } = t, { controlId: a, registerControlId: o } = Sr(), s = fr(n), c = r ? a : void 0, l = Ct(() => Symbol()), u = e.useRef(!1), d = e.useRef(n != null), f = X(() => {
		!u.current || o === Ft || (u.current = !1, o(l.current, void 0));
	});
	return Z(() => {
		if (o === Ft) return;
		let e;
		if (r) {
			let t = i?.current;
			e = an(t) && t.closest("label") != null ? n ?? null : c ?? s;
		} else if (n != null) d.current = !0, e = n;
		else if (d.current) e = s;
		else {
			f();
			return;
		}
		if (e === void 0) {
			f();
			return;
		}
		u.current = !0, o(l.current, e);
	}, [
		n,
		i,
		c,
		o,
		r,
		s,
		l,
		f
	]), e.useEffect(() => f, [f]), a ?? s;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/field/control/FieldControl.mjs
var Wf = /*#__PURE__*/ e.forwardRef(function(t, n) {
	let { render: r, className: i, id: a, name: o, value: s, disabled: c = !1, onValueChange: l, defaultValue: u, autoFocus: d = !1, style: f, ...p } = t, { state: m, name: h, disabled: g, setTouched: _, setDirty: v, validityData: y, setFocused: b, setFilled: x, validationMode: S, validation: C } = hr(), { clearErrors: w } = br(), T = g || c, E = h ?? o, D = {
		...m,
		disabled: T
	}, { labelId: O } = Sr(), k = Uf({ id: a });
	Z(() => {
		let e = s != null;
		C.inputRef.current?.value || e && s !== "" ? x(!0) : e && s === "" && x(!1);
	}, [
		C.inputRef,
		x,
		s
	]);
	let A = e.useRef(null);
	Z(() => {
		d && A.current === fa(Fn(A.current)) && b(!0);
	}, [d, b]);
	let [j] = Qn({
		controlled: s,
		default: u,
		name: "FieldControl",
		state: "value"
	}), M = s !== void 0, N = M ? j : void 0, P = X(() => C.inputRef.current?.value);
	return gr(C.inputRef, k, N, P, !T, o), Vt("input", t, {
		ref: [n, A],
		state: D,
		props: [
			{
				id: k,
				disabled: T,
				name: E,
				ref: C.inputRef,
				"aria-labelledby": O,
				autoFocus: d,
				...M ? { value: N } : { defaultValue: u },
				onChange(e) {
					let t = e.currentTarget.value;
					l?.(t, Ur(Ar, e.nativeEvent)), v(t !== (y.initialValue ?? "")), x(t !== ""), e.nativeEvent.defaultPrevented || (w(E), C.change(t));
				},
				onFocus() {
					b(!0);
				},
				onBlur(e) {
					_(!0), b(!1), S === "onBlur" && C.commit(e.currentTarget.value);
				},
				onKeyDown(e) {
					e.currentTarget.tagName === "INPUT" && e.key === "Enter" && (_(!0), C.commit(e.currentTarget.value));
				}
			},
			p,
			(e) => C.getValidationProps(T, e)
		],
		stateAttributesMapping: or
	});
});
process.env.NODE_ENV !== "production" && (Wf.displayName = "FieldControl");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.7.0_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/@base-ui/react/input/Input.mjs
var Gf = /*#__PURE__*/ e.forwardRef(function(e, t) {
	return /*#__PURE__*/ s(Wf, {
		ref: t,
		...e
	});
});
process.env.NODE_ENV !== "production" && (Gf.displayName = "Input");
//#endregion
//#region src/components/ui/input.tsx
var Kf = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/input.tsx";
function qf({ className: e, type: t, ...n }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Gf, {
		type: t,
		"data-slot": "input",
		className: J("h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40", e),
		...n
	}, void 0, !1, {
		fileName: Kf,
		lineNumber: 8,
		columnNumber: 5
	}, this);
}
//#endregion
//#region src/components/ui/label.tsx
var Jf = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/label.tsx";
function Yf({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("label", {
		"data-slot": "label",
		className: J("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", e),
		...t
	}, void 0, !1, {
		fileName: Jf,
		lineNumber: 9,
		columnNumber: 5
	}, this);
}
//#endregion
//#region src/components/ui/separator.tsx
var Xf = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/separator.tsx";
function Zf({ className: e, orientation: t = "horizontal", ...n }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Cf, {
		"data-slot": "separator",
		orientation: t,
		className: J("shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch", e),
		...n
	}, void 0, !1, {
		fileName: Xf,
		lineNumber: 14,
		columnNumber: 5
	}, this);
}
//#endregion
//#region src/components/ui/sheet.tsx
var Qf = "/home/radityra/projects/arclight/panel/packages/ui/src/components/ui/sheet.tsx";
function $f({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(ju, {
		"data-slot": "sheet",
		...e
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 11,
		columnNumber: 10
	}, this);
}
function ep({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Iu, {
		"data-slot": "sheet-trigger",
		...e
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 15,
		columnNumber: 10
	}, this);
}
function tp({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Fi, {
		"data-slot": "sheet-close",
		...e
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 19,
		columnNumber: 10
	}, this);
}
function np({ ...e }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(pu, {
		"data-slot": "sheet-portal",
		...e
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 23,
		columnNumber: 10
	}, this);
}
function rp({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Pi, {
		"data-slot": "sheet-overlay",
		className: J("fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs", e),
		...t
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 28,
		columnNumber: 5
	}, this);
}
function ip({ className: e, children: t, side: n = "right", showCloseButton: r = !0, ...i }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(np, { children: [/* @__PURE__ */ (0, Y.jsxDEV)(rp, {}, void 0, !1, {
		fileName: Qf,
		lineNumber: 51,
		columnNumber: 7
	}, this), /* @__PURE__ */ (0, Y.jsxDEV)(uu, {
		"data-slot": "sheet-content",
		"data-side": n,
		className: J("fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm", e),
		...i,
		children: [t, r && /* @__PURE__ */ (0, Y.jsxDEV)(Fi, {
			"data-slot": "sheet-close",
			render: /* @__PURE__ */ (0, Y.jsxDEV)(Un, {
				variant: "ghost",
				className: "absolute top-3 right-3",
				size: "icon-sm"
			}, void 0, !1, {
				fileName: Qf,
				lineNumber: 66,
				columnNumber: 15
			}, this),
			children: [/* @__PURE__ */ (0, Y.jsxDEV)(bi, {}, void 0, !1, {
				fileName: Qf,
				lineNumber: 73,
				columnNumber: 13
			}, this), /* @__PURE__ */ (0, Y.jsxDEV)("span", {
				className: "sr-only",
				children: "Close"
			}, void 0, !1, {
				fileName: Qf,
				lineNumber: 75,
				columnNumber: 13
			}, this)]
		}, void 0, !0, {
			fileName: Qf,
			lineNumber: 63,
			columnNumber: 11
		}, this)]
	}, void 0, !0, {
		fileName: Qf,
		lineNumber: 52,
		columnNumber: 7
	}, this)] }, void 0, !0, {
		fileName: Qf,
		lineNumber: 50,
		columnNumber: 5
	}, this);
}
function ap({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "sheet-header",
		className: J("flex flex-col gap-0.5 p-4", e),
		...t
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 85,
		columnNumber: 5
	}, this);
}
function op({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)("div", {
		"data-slot": "sheet-footer",
		className: J("mt-auto flex flex-col gap-2 p-4", e),
		...t
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 95,
		columnNumber: 5
	}, this);
}
function sp({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Mu, {
		"data-slot": "sheet-title",
		className: J("font-heading text-base font-medium text-foreground", e),
		...t
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 105,
		columnNumber: 5
	}, this);
}
function cp({ className: e, ...t }) {
	return /* @__PURE__ */ (0, Y.jsxDEV)(Ii, {
		"data-slot": "sheet-description",
		className: J("text-sm text-muted-foreground", e),
		...t
	}, void 0, !1, {
		fileName: Qf,
		lineNumber: 121,
		columnNumber: 5
	}, this);
}
//#endregion
//#region ../../node_modules/.pnpm/sonner@2.0.8_@types+react@19.2.18_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/sonner/dist/index.mjs
function lp(e) {
	if (!e || typeof document > "u") return;
	let t = document.head || document.getElementsByTagName("head")[0], n = document.createElement("style");
	n.type = "text/css", t.appendChild(n), n.styleSheet ? n.styleSheet.cssText = e : n.appendChild(document.createTextNode(e));
}
Array(12).fill(0);
var up = 1, dp = 100, fp = (e) => typeof e?.id == "number" || e?.id?.length > 0 ? e.id : up++, pp = new class {
	constructor() {
		this.subscribe = (e) => (this.subscribers.push(e), this.getActiveToasts().forEach((t) => e(t)), () => {
			let t = this.subscribers.indexOf(e);
			this.subscribers.splice(t, 1);
		}), this.publish = (e) => {
			this.subscribers.forEach((t) => t(e));
		}, this.addToast = (e) => {
			this.publish(e), this.toasts = [...this.toasts, e], this.trimHistory();
		}, this.trimHistory = () => {
			let e = this.toasts.length - dp;
			e <= 0 || (this.toasts = this.toasts.filter((t) => e > 0 && this.dismissedToasts.has(t.id) ? (this.dismissedToasts.delete(t.id), e--, !1) : !0));
		}, this.create = (e) => {
			let { message: t, ...n } = e, r = fp(e), i = this.pendingDismissals.get(r);
			i !== void 0 && (cancelAnimationFrame(i), this.pendingDismissals.delete(r), this.dismissedToasts.delete(r));
			let a = this.dismissedToasts.has(r), o = e.dismissible === void 0 || e.dismissible;
			return a && (this.dismissedToasts.delete(r), this.toasts = this.toasts.filter((e) => e.id !== r)), !a && this.toasts.find((e) => e.id === r) ? this.toasts = this.toasts.map((n) => n.id === r ? (this.publish({
				...n,
				...e,
				id: r,
				title: t
			}), {
				...n,
				...e,
				id: r,
				dismissible: o,
				title: t
			}) : n) : this.addToast({
				title: t,
				...n,
				dismissible: o,
				id: r
			}), r;
		}, this.dismiss = (e) => {
			if (e == null) return this.getActiveToasts().forEach((e) => {
				this.dismissedToasts.add(e.id), this.subscribers.forEach((t) => t({
					id: e.id,
					dismiss: !0
				}));
			}), e;
			this.dismissedToasts.add(e);
			let t = this.pendingDismissals.get(e);
			return t !== void 0 && cancelAnimationFrame(t), this.pendingDismissals.set(e, requestAnimationFrame(() => {
				this.pendingDismissals.delete(e), this.subscribers.forEach((t) => t({
					id: e,
					dismiss: !0
				}));
			})), e;
		}, this.message = (e, t) => this.create({
			...t,
			message: e,
			type: void 0
		}), this.error = (e, t) => this.create({
			...t,
			message: e,
			type: "error"
		}), this.success = (e, t) => this.create({
			...t,
			type: "success",
			message: e
		}), this.info = (e, t) => this.create({
			...t,
			type: "info",
			message: e
		}), this.warning = (e, t) => this.create({
			...t,
			type: "warning",
			message: e
		}), this.loading = (e, t) => this.create({
			...t,
			type: "loading",
			message: e
		}), this.promise = (e, n) => {
			if (!n) return;
			let r;
			n.loading !== void 0 && (r = this.create({
				...n,
				promise: e,
				type: "loading",
				message: n.loading,
				description: typeof n.description == "function" ? void 0 : n.description
			}));
			let i = Promise.resolve(e instanceof Function ? e() : e), a = r !== void 0, o, s = i.then(async (e) => {
				if (o = ["resolve", e], t.isValidElement(e)) a = !1, this.create({
					id: r,
					type: "default",
					message: e
				});
				else if (hp(e) && !e.ok) {
					a = !1;
					let i = typeof n.error == "function" ? await n.error(`HTTP error! status: ${e.status}`) : n.error, o = typeof n.description == "function" ? await n.description(`HTTP error! status: ${e.status}`) : n.description, s = typeof i == "object" && !t.isValidElement(i) ? i : { message: i };
					this.create({
						id: r,
						type: "error",
						description: o,
						...s
					});
				} else if (e instanceof Error) {
					a = !1;
					let i = typeof n.error == "function" ? await n.error(e) : n.error, o = typeof n.description == "function" ? await n.description(e) : n.description, s = typeof i == "object" && !t.isValidElement(i) ? i : { message: i };
					this.create({
						id: r,
						type: "error",
						description: o,
						...s
					});
				} else if (n.success !== void 0) {
					a = !1;
					let i = typeof n.success == "function" ? await n.success(e) : n.success, o = typeof n.description == "function" ? await n.description(e) : n.description, s = typeof i == "object" && !t.isValidElement(i) ? i : { message: i };
					this.create({
						id: r,
						type: "success",
						description: o,
						...s
					});
				}
			}).catch(async (e) => {
				if (o = ["reject", e], n.error !== void 0) {
					a = !1;
					let i = typeof n.error == "function" ? await n.error(e) : n.error, o = typeof n.description == "function" ? await n.description(e) : n.description, s = typeof i == "object" && !t.isValidElement(i) ? i : { message: i };
					this.create({
						id: r,
						type: "error",
						description: o,
						...s
					});
				}
			}).finally(() => {
				a && (this.dismiss(r), r = void 0), n.finally == null || n.finally.call(n);
			}), c = () => new Promise((e, t) => s.then(() => o[0] === "reject" ? t(o[1]) : e(o[1])).catch(t));
			return typeof r != "string" && typeof r != "number" ? { unwrap: c } : Object.assign(r, { unwrap: c });
		}, this.custom = (e, t) => {
			let n = fp(t);
			return this.create({
				...t,
				jsx: e(n),
				id: n,
				type: void 0
			}), n;
		}, this.getActiveToasts = () => this.toasts.filter((e) => !this.dismissedToasts.has(e.id)), this.subscribers = [], this.toasts = [], this.dismissedToasts = /* @__PURE__ */ new Set(), this.pendingDismissals = /* @__PURE__ */ new Map();
	}
}(), mp = (e, t) => pp.message(e, t), hp = (e) => e && typeof e == "object" && "ok" in e && typeof e.ok == "boolean" && "status" in e && typeof e.status == "number", gp = Object.assign(mp, {
	success: pp.success,
	info: pp.info,
	warning: pp.warning,
	error: pp.error,
	custom: pp.custom,
	message: pp.message,
	promise: pp.promise,
	dismiss: pp.dismiss,
	loading: pp.loading
}, {
	getHistory: () => pp.toasts,
	getToasts: () => pp.getActiveToasts()
});
lp("[data-sonner-toaster][dir=ltr],html[dir=ltr]{--toast-icon-margin-start:-3px;--toast-icon-margin-end:4px;--toast-svg-margin-start:-1px;--toast-svg-margin-end:0px;--toast-button-margin-start:auto;--toast-button-margin-end:0;--toast-close-button-start:0;--toast-close-button-end:unset;--toast-close-button-transform:translate(-35%, -35%)}[data-sonner-toaster][dir=rtl],html[dir=rtl]{--toast-icon-margin-start:4px;--toast-icon-margin-end:-3px;--toast-svg-margin-start:0px;--toast-svg-margin-end:-1px;--toast-button-margin-start:0;--toast-button-margin-end:auto;--toast-close-button-start:unset;--toast-close-button-end:0;--toast-close-button-transform:translate(35%, -35%)}[data-sonner-toaster]{position:fixed;width:var(--width);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;--gray1:hsl(0, 0%, 99%);--gray2:hsl(0, 0%, 97.3%);--gray3:hsl(0, 0%, 95.1%);--gray4:hsl(0, 0%, 93%);--gray5:hsl(0, 0%, 90.9%);--gray6:hsl(0, 0%, 88.7%);--gray7:hsl(0, 0%, 85.8%);--gray8:hsl(0, 0%, 78%);--gray9:hsl(0, 0%, 56.1%);--gray10:hsl(0, 0%, 52.3%);--gray11:hsl(0, 0%, 43.5%);--gray12:hsl(0, 0%, 9%);--border-radius:8px;box-sizing:border-box;padding:0;margin:0;list-style:none;outline:0;z-index:999999999;transition:transform .4s ease}@media (hover:none) and (pointer:coarse){[data-sonner-toaster][data-lifted=true]{transform:none}}[data-sonner-toaster][data-x-position=right]{right:var(--offset-right)}[data-sonner-toaster][data-x-position=left]{left:var(--offset-left)}[data-sonner-toaster][data-x-position=center]{left:50%;transform:translateX(-50%)}[data-sonner-toaster][data-y-position=top]{top:var(--offset-top)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--offset-bottom)}[data-sonner-toast]{--y:translateY(100%);--lift-amount:calc(var(--lift) * var(--gap));z-index:var(--z-index);position:absolute;opacity:0;transform:var(--y);touch-action:none;transition:transform .4s,opacity .4s,height .4s,box-shadow .2s;box-sizing:border-box;outline:0;overflow-wrap:anywhere}[data-sonner-toast][data-styled=true]{padding:16px;background:var(--normal-bg);border:1px solid var(--normal-border);color:var(--normal-text);border-radius:var(--border-radius);box-shadow:0 4px 12px rgba(0,0,0,.1);width:var(--width);font-size:13px;display:flex;align-items:center;gap:6px}[data-sonner-toast]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-y-position=top]{top:0;--y:translateY(-100%);--lift:1;--lift-amount:calc(1 * var(--gap))}[data-sonner-toast][data-y-position=bottom]{bottom:0;--y:translateY(100%);--lift:-1;--lift-amount:calc(var(--lift) * var(--gap))}[data-sonner-toast][data-styled=true] [data-description]{font-weight:400;line-height:1.4;color:#3f3f3f}[data-rich-colors=true][data-sonner-toast][data-styled=true] [data-description]{color:inherit}[data-sonner-toaster][data-sonner-theme=dark] [data-description]{color:#e8e8e8}[data-sonner-toast][data-styled=true] [data-title]{font-weight:500;line-height:1.5;color:inherit}[data-sonner-toast][data-styled=true] [data-icon]{display:flex;height:16px;width:16px;position:relative;justify-content:flex-start;align-items:center;flex-shrink:0;margin-left:var(--toast-icon-margin-start);margin-right:var(--toast-icon-margin-end)}[data-sonner-toast][data-promise=true] [data-icon]>svg{opacity:0;transform:scale(.8);transform-origin:center;animation:sonner-fade-in .3s ease forwards}[data-sonner-toast][data-styled=true] [data-icon]>*{flex-shrink:0}[data-sonner-toast][data-styled=true] [data-icon] svg{margin-left:var(--toast-svg-margin-start);margin-right:var(--toast-svg-margin-end)}[data-sonner-toast][data-styled=true] [data-content]{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}[data-sonner-toast][data-styled=true] [data-button]{border-radius:4px;padding-left:8px;padding-right:8px;height:24px;font-size:12px;color:var(--normal-bg);background:var(--normal-text);margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end);border:none;font-weight:500;cursor:pointer;outline:0;display:flex;align-items:center;flex-shrink:0;transition:opacity .4s,box-shadow .2s}[data-sonner-toast][data-styled=true] [data-button]:focus-visible{box-shadow:0 0 0 2px rgba(0,0,0,.4)}[data-sonner-toast][data-styled=true] [data-button]:first-of-type{margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end)}[data-sonner-toast][data-styled=true] [data-cancel]{color:var(--normal-text);background:rgba(0,0,0,.08)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-styled=true] [data-cancel]{background:rgba(255,255,255,.3)}[data-sonner-toast][data-styled=true] [data-close-button]{position:absolute;left:var(--toast-close-button-start);right:var(--toast-close-button-end);top:0;height:20px;width:20px;display:flex;justify-content:center;align-items:center;padding:0;color:var(--normal-text);background:var(--normal-bg);border:1px solid var(--normal-border);transform:var(--toast-close-button-transform);border-radius:50%;cursor:pointer;z-index:1;transition:opacity .1s,background .2s,border-color .2s}[data-sonner-toast][data-styled=true] [data-close-button]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-styled=true] [data-disabled=true]{cursor:not-allowed}[data-sonner-toast][data-styled=true]:hover [data-close-button]:hover{background:var(--gray2);border-color:var(--gray5)}[data-sonner-toast][data-swiping=true]::before{content:'';position:absolute;left:-100%;right:-100%;height:100%;z-index:-1}[data-sonner-toast][data-y-position=top][data-swiping=true]::before{bottom:50%;transform:scaleY(3) translateY(50%)}[data-sonner-toast][data-y-position=bottom][data-swiping=true]::before{top:50%;transform:scaleY(3) translateY(-50%)}[data-sonner-toast][data-swiping=false][data-removed=true]::before{content:'';position:absolute;inset:0;transform:scaleY(2)}[data-sonner-toast][data-expanded=true]::after{content:'';position:absolute;left:0;height:calc(var(--gap) + 1px);bottom:100%;width:100%}[data-sonner-toast][data-mounted=true]{--y:translateY(0);opacity:1}[data-sonner-toast][data-expanded=false][data-front=false]{--scale:var(--toasts-before) * 0.05 + 1;--y:translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));height:var(--front-toast-height)}[data-sonner-toast]>*{transition:opacity .4s}[data-sonner-toast][data-x-position=right]{right:0}[data-sonner-toast][data-x-position=left]{left:0}[data-sonner-toast][data-expanded=false][data-front=false][data-styled=true]>*{opacity:0}[data-sonner-toast][data-visible=false]{opacity:0;pointer-events:none}[data-sonner-toast][data-mounted=true][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset)));height:var(--initial-height)}[data-sonner-toast][data-removed=true][data-front=true][data-swipe-out=false]{--y:translateY(calc(var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=false]{--y:translateY(40%);opacity:0;transition:transform .5s,opacity .2s}[data-sonner-toast][data-removed=true][data-front=false]::before{height:calc(var(--initial-height) + 20%)}[data-sonner-toast][data-swiping=true]{transform:var(--y) translateY(var(--swipe-amount-y,0)) translateX(var(--swipe-amount-x,0));transition:none}[data-sonner-toast][data-swiped=true]{-webkit-user-select:none;user-select:none}[data-sonner-toast][data-swipe-out=true][data-y-position=bottom],[data-sonner-toast][data-swipe-out=true][data-y-position=top]{animation-duration:.2s;animation-timing-function:ease-out;animation-fill-mode:forwards}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=left]{animation-name:swipe-out-left}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=right]{animation-name:swipe-out-right}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=up]{animation-name:swipe-out-up}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=down]{animation-name:swipe-out-down}@keyframes swipe-out-left{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) - 100%));opacity:0}}@keyframes swipe-out-right{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) + 100%));opacity:0}}@keyframes swipe-out-up{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) - 100%));opacity:0}}@keyframes swipe-out-down{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) + 100%));opacity:0}}@media (max-width:600px){[data-sonner-toaster]{position:fixed;right:var(--mobile-offset-right);left:var(--mobile-offset-left);width:100%}[data-sonner-toaster][dir=rtl]{left:calc(var(--mobile-offset-left) * -1)}[data-sonner-toaster] [data-sonner-toast]{left:0;right:0;width:calc(100% - var(--mobile-offset-left) * 2)}[data-sonner-toaster][data-x-position=left]{left:var(--mobile-offset-left)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--mobile-offset-bottom)}[data-sonner-toaster][data-y-position=top]{top:var(--mobile-offset-top)}[data-sonner-toaster][data-x-position=center]{left:var(--mobile-offset-left);right:var(--mobile-offset-right);transform:none}}[data-sonner-toaster][data-sonner-theme=light]{--normal-bg:#fff;--normal-border:var(--gray4);--normal-text:var(--gray12);--success-bg:hsl(143, 85%, 96%);--success-border:hsl(145, 92%, 87%);--success-text:hsl(140, 100%, 27%);--info-bg:hsl(208, 100%, 97%);--info-border:hsl(221, 91%, 93%);--info-text:hsl(210, 92%, 45%);--warning-bg:hsl(49, 100%, 97%);--warning-border:hsl(49, 91%, 84%);--warning-text:hsl(31, 92%, 45%);--error-bg:hsl(359, 100%, 97%);--error-border:hsl(359, 100%, 94%);--error-text:hsl(360, 100%, 45%)}[data-sonner-toaster][data-sonner-theme=light] [data-sonner-toast][data-invert=true]{--normal-bg:#000;--normal-border:hsl(0, 0%, 20%);--normal-text:var(--gray1)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-invert=true]{--normal-bg:#fff;--normal-border:var(--gray3);--normal-text:var(--gray12)}[data-sonner-toaster][data-sonner-theme=dark]{--normal-bg:#000;--normal-bg-hover:hsl(0, 0%, 12%);--normal-border:hsl(0, 0%, 20%);--normal-border-hover:hsl(0, 0%, 25%);--normal-text:var(--gray1);--success-bg:hsl(150, 100%, 6%);--success-border:hsl(147, 100%, 12%);--success-text:hsl(150, 86%, 65%);--info-bg:hsl(215, 100%, 6%);--info-border:hsl(223, 43%, 17%);--info-text:hsl(216, 87%, 65%);--warning-bg:hsl(64, 100%, 6%);--warning-border:hsl(60, 100%, 9%);--warning-text:hsl(46, 87%, 65%);--error-bg:hsl(358, 76%, 10%);--error-border:hsl(357, 89%, 16%);--error-text:hsl(358, 100%, 81%)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]{background:var(--normal-bg);border-color:var(--normal-border);color:var(--normal-text)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]:hover{background:var(--normal-bg-hover);border-color:var(--normal-border-hover)}[data-rich-colors=true][data-sonner-toast][data-type=success]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=success] [data-close-button]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=info]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=info] [data-close-button]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning] [data-close-button]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=error]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}[data-rich-colors=true][data-sonner-toast][data-type=error] [data-close-button]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}.sonner-loading-wrapper{--size:16px;height:var(--size);width:var(--size);position:absolute;inset:0;z-index:10}.sonner-loading-wrapper[data-visible=false]{transform-origin:center;animation:sonner-fade-out .2s ease forwards}.sonner-spinner{position:relative;top:50%;left:50%;height:var(--size);width:var(--size)}.sonner-loading-bar{animation:sonner-spin 1.2s linear infinite;background:var(--gray11);border-radius:6px;height:8%;left:-10%;position:absolute;top:-3.9%;width:24%}.sonner-loading-bar:first-child{animation-delay:-1.2s;transform:rotate(.0001deg) translate(146%)}.sonner-loading-bar:nth-child(2){animation-delay:-1.1s;transform:rotate(30deg) translate(146%)}.sonner-loading-bar:nth-child(3){animation-delay:-1s;transform:rotate(60deg) translate(146%)}.sonner-loading-bar:nth-child(4){animation-delay:-.9s;transform:rotate(90deg) translate(146%)}.sonner-loading-bar:nth-child(5){animation-delay:-.8s;transform:rotate(120deg) translate(146%)}.sonner-loading-bar:nth-child(6){animation-delay:-.7s;transform:rotate(150deg) translate(146%)}.sonner-loading-bar:nth-child(7){animation-delay:-.6s;transform:rotate(180deg) translate(146%)}.sonner-loading-bar:nth-child(8){animation-delay:-.5s;transform:rotate(210deg) translate(146%)}.sonner-loading-bar:nth-child(9){animation-delay:-.4s;transform:rotate(240deg) translate(146%)}.sonner-loading-bar:nth-child(10){animation-delay:-.3s;transform:rotate(270deg) translate(146%)}.sonner-loading-bar:nth-child(11){animation-delay:-.2s;transform:rotate(300deg) translate(146%)}.sonner-loading-bar:nth-child(12){animation-delay:-.1s;transform:rotate(330deg) translate(146%)}@keyframes sonner-fade-in{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}@keyframes sonner-fade-out{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.8)}}@keyframes sonner-spin{0%{opacity:1}100%{opacity:.15}}@media (prefers-reduced-motion){.sonner-loading-bar,[data-sonner-toast],[data-sonner-toast]>*{transition:none!important;animation:none!important}}.sonner-loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transform-origin:center;transition:opacity .2s,transform .2s}.sonner-loader[data-visible=false]{opacity:0;transform:scale(.8) translate(-50%,-50%)}");
//#endregion
export { tt as Alert, rt as AlertDescription, nt as AlertTitle, Qt as Badge, Un as Button, Gn as Card, Yn as CardAction, Xn as CardContent, Jn as CardDescription, Zn as CardFooter, Kn as CardHeader, qn as CardTitle, Si as Checkbox, Ru as Dialog, Hu as DialogContent, Ku as DialogDescription, Wu as DialogFooter, Uu as DialogHeader, Gu as DialogTitle, zu as DialogTrigger, Of as DropdownMenu, Rf as DropdownMenuCheckboxItem, jf as DropdownMenuContent, Mf as DropdownMenuGroup, Pf as DropdownMenuItem, Nf as DropdownMenuLabel, kf as DropdownMenuPortal, zf as DropdownMenuRadioGroup, Bf as DropdownMenuRadioItem, Vf as DropdownMenuSeparator, Hf as DropdownMenuShortcut, Ff as DropdownMenuSub, Lf as DropdownMenuSubContent, If as DropdownMenuSubTrigger, Af as DropdownMenuTrigger, qf as Input, Yf as Label, Zf as Separator, $f as Sheet, tp as SheetClose, ip as SheetContent, cp as SheetDescription, op as SheetFooter, ap as SheetHeader, sp as SheetTitle, ep as SheetTrigger, Zt as badgeVariants, Hn as buttonVariants, J as cn, gp as toast };

//# sourceMappingURL=index.js.map