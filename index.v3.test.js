import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('V3 browser module has valid JavaScript syntax', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'module script exists in index.html');
  const withoutImports = script.replace(/^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];\s*/gm, '');
  assert.doesNotThrow(() => new Function(withoutImports));
});
