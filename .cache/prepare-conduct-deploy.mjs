import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const workspace=process.cwd();
const harness='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spikypanda-harness';
const core='C:/Users/GuillaumePelletier/Documents/GitHub/spikypanda';
const previous=JSON.parse(fs.readFileSync('.cache/decision-deploy.json','utf8'));
const known=new Map(previous.files.map(file=>[path.resolve(file.destination).toLowerCase(),file.after]));
const sha=file=>fs.existsSync(file)?createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;
const files=[];
function add(source,destination,fallback=null){
  const before=known.get(path.resolve(destination).toLowerCase())??fallback;
  if(sha(destination)!==before)throw new Error(`Destination differs from the previous lot: ${destination}`);
  files.push({source:path.resolve(source),destination,before,after:sha(source)});
}
const stage=path.join(workspace,'.cache/harness-conduct-transfer');
for(const relative of [
  'README.md','package.json','src/index.ts','src/decision/contracts.ts','src/decision/session.ts','src/decision/nodes.ts',
  'src/conduct/contracts.ts','src/conduct/nodes.ts',
  'src/agents/contracts.ts','src/agents/session.ts','src/agents/nodes.ts','src/agents/links.ts','src/agents/factory.ts','src/agents/index.ts',
  'src/graphs/agents.json','src/graphs/agents.ts',
  'tests/agent-fixture.mjs','tests/conduct-delegation.test.mjs','tests/delegation-broker.test.mjs',
  'doc/graphe-decision-executable.md','doc/reprise-conduite-delegation.md','doc/slots-reprise.md',
])add(path.join(stage,relative),`${harness}/${relative}`);
for(const name of ['execution.interfaces.ts','execution.scheduler.ts','execution.session.ts','execution.node.ts']){
  add(`.cache/core-concurrent-transfer/src/execution/${name}`,`${core}/packages/dev/core/src/execution/${name}`,
    name==='execution.node.ts'?sha(`.cache/core-decision-runtime/src/execution/${name}`):null);
}
add('.cache/core-concurrent-transfer/dynamic-async.test.ts',`${core}/packages/tests/execution/dynamic-async.test.ts`);
add('.cache/core-concurrent-transfer/async-dynamic-traversal.md',`${core}/docs/architecture/async-dynamic-traversal.md`);
fs.writeFileSync('.cache/conduct-deploy.json',JSON.stringify({roots:[harness,core],files},null,2));
