import fs from 'node:fs';
const rows = [
  ['start', 'decision.start', [], ['out']],
  ['loop', 'decision.loop', ['in'], ['body', 'done', 'exhausted'], {maxDecisions: 8}],
  ['observe', 'decision.observe', ['in'], ['out']],
  ['context', 'decision.context', ['in'], ['out']],
  ['lookup', 'decision.lookup', ['in'], ['out']],
  ['gate', 'decision.gate', ['in'], ['policy', 'reason']],
  ['request', 'decision.request', ['in'], ['out']],
  ['reason', 'mcp.reason', ['in'], ['out'], {slot: 'reasoner', tool: 'decide'}],
  ['merge', 'decision.merge', ['in'], ['out']],
  ['guard', 'decision.guard', ['in'], ['out']],
  ['execute', 'decision.dispatch', ['in'], ['web.search', 'bypass']],
  ['web.search', 'mcp.call', ['in'], ['out'], {slot: 'web', tool: 'search'}],
  ['observe-after', 'decision.observe-after', ['in'], ['out']],
  ['evaluate', 'decision.evaluate', ['in'], ['out']],
  ['record', 'decision.record', ['in'], ['out']],
  ['end', 'decision.end', ['in'], []],
];
const edges = [
  ['start', 'out', 'loop'], ['loop', 'body', 'observe'], ['loop', 'done', 'end'], ['loop', 'exhausted', 'end'],
  ['observe', 'out', 'context'], ['context', 'out', 'lookup'], ['lookup', 'out', 'gate'],
  ['gate', 'policy', 'merge'], ['gate', 'reason', 'request'], ['request', 'out', 'reason'], ['reason', 'out', 'merge'],
  ['merge', 'out', 'guard'], ['guard', 'out', 'execute'], ['execute', 'web.search', 'web.search'],
  ['execute', 'bypass', 'observe-after'], ['web.search', 'out', 'observe-after'],
  ['observe-after', 'out', 'evaluate'], ['evaluate', 'out', 'record'], ['record', 'out', 'loop'],
];
const kinds = ['question','procedure-request','alarm','telemetry','equipment-discovered','external-response',
  'authorization-result','async-result','deadline','source-invalidated','cancel'];
const nodes = rows.map(([id, resolver, inputs, outputs, config = {}]) => ({
  id, typeId: resolver.startsWith('mcp.') ? 'harness.mcp-action' : 'harness.decision',
  data: {region: resolver.startsWith('mcp.') ? 'capabilities' : 'decision', resolver,
    inputPorts: inputs.map(slot => ({slot, optional:false})),
    outputPorts: [...outputs, ...(id !== 'end' ? ['fault'] : [])].map(slot => ({slot, optional:false})),
    activation:'each-message', needs:[], config},
}));
for (const [id] of rows) if(id !== 'end') edges.push([id,'fault','end']);
const document = {version:4, harness:{id:'decision-system',version:'executable.1',
  entries:Object.fromEntries(kinds.map(kind => [kind,'start']))},
  model:{nodes, connections:edges.map(([from,port,to]) => ({typeId:'harness.link',from:{node:from,port},to:{node:to,port:'in'},
    data:{mode:'continue',context:'project'}}))}};
fs.writeFileSync('.cache/harness-decision-transfer/src/graphs/decision.json', JSON.stringify(document,null,2)+'\n');
