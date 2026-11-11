import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const root = process.cwd();
const source = path.resolve(root, '../Gaume/co2-scrubber-governed-agent');
const stage = path.resolve(root, '.cache/harness-generic-transfer');
const require = createRequire(path.join(stage, 'package.json'));
const ts = require('typescript');
const copied = [];
const units = [
  ['harness/core/claims.ts', 'src/acquired/claims.ts'],
  ['harness/core/problems.ts', 'src/acquired/problems.ts'],
  ['harness/core/episodes.ts', 'src/acquired/episodes.ts'],
  ['harness/lib/execution-errors.ts', 'src/acquired/execution-errors.ts'],
  ['lib/ordered-delivery.ts', 'src/acquired/ordered-delivery.ts'],
];
const contents = units.map(([from, to]) => ({from, to, text: fs.readFileSync(path.join(source, from), 'utf8')}));
const interfaces = new Set(contents.flatMap(({text}) => Array.from(text.matchAll(/\binterface\s+([A-Za-z_]\w*)/g), m => m[1])));
const names = Object.fromEntries([...interfaces].filter(name => !/^I[A-Z]/.test(name)).map(name => [name, `I${name}`]));
const replaceNames = text => text.replace(/\b[A-Za-z_]\w*\b/g, word => Object.hasOwn(names, word) ? names[word] : word);
const write = (file, text) => {
  if (text.includes('\u2014')) text = text.replaceAll('\u2014', ',');
  fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
  fs.writeFileSync(path.join(stage, file), text.replaceAll('\r\n', '\n'));
};
for (const item of contents) {
  let text = replaceNames(item.text).replace('from "@spiky-panda/harness"', 'from "../contracts/graph.js"');
  write(item.to, text);
  copied.push({source: item.from, target: item.to, sourceSha256: crypto.createHash('sha256').update(item.text).digest('hex'), adaptations: ['Interface names use the I prefix.', 'JSON values reuse the active graph contract.', 'Forbidden punctuation is normalized.']});
}
for (const [from, target, imported] of [
  ['tests/claims.test.ts', 'tests/acquired-claims.test.mjs', '../harness/core/claims.js'],
  ['tests/problems.test.ts', 'tests/acquired-problems.test.mjs', '../harness/core/problems.js'],
  ['tests/ordered-delivery.test.ts', 'tests/acquired-delivery.test.mjs', '../lib/ordered-delivery.js'],
]) {
  const input = fs.readFileSync(path.join(source, from), 'utf8');
  const moduleName = path.basename(imported);
  const adapted = replaceNames(input).replace(imported, `../dist/acquired/${moduleName}`);
  write(target, ts.transpileModule(adapted, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText);
  copied.push({source: from, target, sourceSha256: crypto.createHash('sha256').update(input).digest('hex'), adaptations: ['Test transpiled to the existing node:test layout.', 'Imports target the transferred active module.']});
}
write('src/acquired/index.ts', units.map(([, target]) => `export * from "./${path.basename(target, '.ts')}.js";`).join('\n') + '\n');
write('doc/transfers/co2-scrubber-2026-11-06.json', JSON.stringify({
  version: 1,
  sourceRepository: 'https://github.com/pandaGaume/co2-scrubber-governed-agent',
  sourceRevision: '62a8e6c',
  sourceLicense: 'Apache-2.0',
  description: 'Portable mechanisms from the executable application; no domain model or archived topology is promoted.',
  files: copied,
}, null, 2) + '\n');
console.log(JSON.stringify({stage, transferred: copied.length, interfaces: names}));
