# Third-Party Notices

Kontur bundles the following third-party software. All runtime components are
MIT-licensed. The MIT permission text below applies to each component and its
copyright notice.

## Runtime components

| Component | Version | License | Copyright |
| --- | --- | --- | --- |
| [vtracer-wasm](https://github.com/jsscheller/vtracer-wasm) | 0.1.0 | MIT | Copyright (c) 2025 jsscheller |
| [VTracer](https://github.com/visioncortex/vtracer) | 0.8.8 (inside vtracer-wasm) | MIT | Copyright (c) 2024 TSANG, Hao Fung |
| [visioncortex](https://github.com/visioncortex/visioncortex) | inside VTracer | MIT OR Apache-2.0 (MIT used) | Copyright (c) 2026 TSANG, Hao Fung |
| [React](https://github.com/facebook/react) | 19.3.1 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates |
| [React DOM](https://github.com/facebook/react) | 19.3.1 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates |
| [scheduler](https://github.com/facebook/react/tree/main/packages/scheduler) | 0.28.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates |
| [Tabler Icons](https://github.com/tabler/tabler-icons) (`@tabler/icons`, `@tabler/icons-react`) | 3.50.0 | MIT | Copyright (c) 2020-2026 Paweł Kuna |

The vendored engine files in `src/vendor/vtracer/` are an unmodified copy of
`vtracer-wasm@0.1.0`. Its original license text is kept at
`src/vendor/vtracer/LICENSE`.

Development-only packages (Vite, TypeScript, Vitest, Playwright and their
transitive dependencies) are not distributed with the built site. Their
licenses are listed in `package-lock.json` and in each package's own license
file under `node_modules/`.

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
