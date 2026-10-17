import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export function scriptPolicy(html: string): string {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1] ?? ''))
    .map(
      (match) =>
        `'sha256-${createHash('sha256')
          .update(match[2] ?? '')
          .digest('base64')}'`,
    );
  return `script-src 'self' ${hashes.join(' ')}`;
}

export function scriptCsp(): Plugin {
  return {
    name: 'inline-script-csp',
    transformIndexHtml: {
      // Run after Vite/React HTML transforms so dev refresh scripts are hashed too.
      order: 'post',
      handler: (html) => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: scriptPolicy(html),
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}
