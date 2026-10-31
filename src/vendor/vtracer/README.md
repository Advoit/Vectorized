# VTracer WASM (vendored)

This directory contains an unmodified copy of `vtracer-wasm@0.1.0`:

- `vtracer.js` and `vtracer.d.ts` from the npm package
- `vtracer.wasm` from the npm package
- `LICENSE` (MIT, © 2025 jsscheller)

Upstream: https://github.com/jsscheller/vtracer-wasm

The build wraps VTracer / visioncortex:

- VTracer: https://github.com/visioncortex/vtracer (MIT)
- visioncortex: https://github.com/visioncortex/visioncortex (MIT)

Vendoring keeps the exact engine and its WASM asset under version control and
avoids runtime CDN dependencies. The wrapper in `index.ts` only adds types.

Do not edit `vtracer.js` or `vtracer.wasm`. Replace both files together when
upgrading, and update `THIRD_PARTY_NOTICES.md`.
