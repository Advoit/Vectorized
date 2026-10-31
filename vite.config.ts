import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages project sites live under /<repository>/.
 * - In GitHub Actions GITHUB_REPOSITORY is available automatically.
 * - BASE_PATH can override the value (e.g. "/" for a custom domain).
 * - Local development always uses "/" unless explicitly overridden.
 */
function resolveBase(): string {
  const explicit = process.env.BASE_PATH;
  if (explicit !== undefined && explicit.trim() !== '') {
    return explicit.endsWith('/') ? explicit : `${explicit}/`;
  }

  const repoFullName = process.env.GITHUB_REPOSITORY;
  if (!repoFullName) return '/';

  const repo = repoFullName.split('/')[1] ?? '';
  if (!repo || repo.endsWith('.github.io')) return '/';

  return `/${repo}/`;
}

export default defineConfig({
  base: resolveBase(),
  plugins: [
    react(),
    {
      name: 'kontur-csp',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          if (ctx.server) return html;
          const csp = [
            "default-src 'self'",
            "script-src 'self' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' blob: data:",
            "worker-src 'self' blob:",
            "connect-src 'self' blob:",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
          ].join('; ');
          return html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
        },
      },
    },
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  worker: {
    format: 'es',
  },
});
