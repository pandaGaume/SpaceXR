import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const workspace = process.cwd();
const harness = 'C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spikypanda-harness';
const core = 'C:/Users/GuillaumePelletier/Documents/GitHub/spikypanda';
const sha = file => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const files = [];
function add(source, destination) {
  files.push({source: path.resolve(source), destination, before: sha(destination), after: sha(source)});
}
const stage = path.join(workspace,'.cache/harness-decision-transfer');
for(const relative of [
  'README.md','package.json','src/index.ts','src/graph/nodes.ts','src/broker/slots.ts',
  'src/decision/contracts.ts','src/decision/session.ts','src/decision/nodes.ts','src/decision/factory.ts','src/decision/index.ts',
  'src/graphs/decision.json','src/graphs/decision.ts',
  'tests/broker-slots.test.mjs','tests/decision-runtime.test.mjs','tests/decision-broker.test.mjs',
  'doc/graphe-decision-executable.md',
]) add(path.join(stage,relative),`${harness}/${relative}`);
for(const name of ['execution.scheduler.ts','execution.session.ts','execution.graph.ts','execution.interfaces.ts']) {
  add(path.join(workspace,'.cache/core-decision-runtime/src/execution',name), `${core}/packages/dev/core/src/execution/${name}`);
}
add(path.join(workspace,'.cache/core-decision-runtime/dynamic-async.test.ts'), `${core}/packages/tests/execution/dynamic-async.test.ts`);
add(path.join(workspace,'.cache/core-decision-runtime/async-dynamic-traversal.md'),`${core}/docs/architecture/async-dynamic-traversal.md`);
fs.writeFileSync(path.join(workspace,'.cache/decision-deploy.json'),JSON.stringify({roots:[harness,core],files},null,2));
