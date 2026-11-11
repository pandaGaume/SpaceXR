import fs from 'node:fs';
const root='.cache/harness-conduct-transfer';
const source=JSON.parse(fs.readFileSync(`${root}/src/graphs/decision.json`,'utf8'));
const document={version:4,harness:{id:'agents-system',version:'executable.2',
  entries:Object.fromEntries(Object.keys(source.harness.entries).map(key=>[key,'parent.start']))},model:{nodes:[],connections:[]}};
const nodes=document.model.nodes, edges=document.model.connections;
function edge(from,port,to,input='in',mode='continue',delegateId){
  edges.push({typeId:delegateId?'harness.delegation-link':'harness.link',from:{node:from,port},to:{node:to,port:input},
    data:{mode,context:mode==='result'?'result-only':'project',...(delegateId?{delegateId}:{})}});
}
function node(id,type,resolver,inputs,outputs,config={}){
 nodes.push({id,typeId:type,data:{region:id.startsWith('worker.')?'specialist':'conductor',resolver,
   inputPorts:inputs.map(slot=>({slot,optional:false})),outputPorts:outputs.map(slot=>({slot,optional:false})),
   activation:'each-message',needs:[],config}});
}
for(const prefix of ['parent','worker']){
 for(const original of source.model.nodes){
   const copy=structuredClone(original); copy.id=`${prefix}.${copy.id}`;
   copy.data.region=prefix;
   if(copy.id.endsWith('.execute'))copy.data.outputPorts=copy.data.outputPorts.map(port=>port.slot==='web.search'?{...port,slot:`${prefix}.web.search`}:port);
   if(copy.id.endsWith('.loop'))copy.data.config.maxDecisions=prefix==='parent'?4:3;
   if(prefix==='worker'&&original.id==='start')copy.data.inputPorts=[{slot:'in',optional:false}];
   nodes.push(copy);
 }
 for(const original of source.model.connections){
   if(prefix==='parent'&&original.from.node==='observe'&&original.to.node==='context')continue;
   edge(`${prefix}.${original.from.node}`,original.from.node==='execute'&&original.from.port==='web.search'?`${prefix}.web.search`:original.from.port,
     `${prefix}.${original.to.node}`,original.to.port);
 }
}
node('delegate.analysis','harness.delegate','agent.delegate',['in'],['launched','finished','fault','spawn'],
 {role:'analyst',description:'Delegate an analysis to an isolated specialist',maxDepth:2,contextKeys:['publicFacts']});
nodes.find(n=>n.id==='delegate.analysis').data.asyncMode='concurrent';
nodes.find(n=>n.id==='parent.execute').data.outputPorts.push({slot:'delegate.analysis',optional:false});
node('parent.join','harness.agent-join','agent.join',['in'],['out','ignored','fault']);
nodes.find(n=>n.id==='worker.end').data.outputPorts.push({slot:'result',optional:false});
edge('parent.execute','delegate.analysis','delegate.analysis');
edge('delegate.analysis','spawn','worker.start','in','spawn','delegate.analysis');
edge('worker.end','result','parent.join','in','result','delegate.analysis');
edge('delegate.analysis','fault','parent.end');edge('parent.join','fault','parent.end');edge('parent.join','out','parent.observe-after');
function conduct(id,resolver,inputs,outputs,config={}){
 node(id,'harness.conduct',resolver,inputs,[...outputs,'fault'],config);edge(id,'fault','parent.end');
}
conduct('conduct.ingress','conduct.ingress',['in'],['tick']);
conduct('proof.inputs','conduct.evidence',['in'],['value'],{proof:'inputs.ready'});
conduct('proof.authorized','conduct.evidence',['in'],['value'],{proof:'delegation.authorized'});
conduct('proof.budget','conduct.bound',['in'],['value'],{count:'delegation.attempts',atLeast:2});
conduct('proof.not-authorized','conduct.not',['in'],['value']);
conduct('proof.blocked','conduct.any',['authority','budget'],['value']);
conduct('proof.ready','conduct.all',['inputs','authority'],['value']);
conduct('stage.acquire','conduct.stage',['entered','passes'],['next','view'],{goal:'Collect the required inputs',tools:['parent.web.search']});
conduct('stage.delegate','conduct.stage',['entered'],['next','view'],{goal:'Delegate and verify the specialist result',tools:['delegate.analysis']});
conduct('gate.delegation','conduct.gate',['in'],['view'],{tools:['delegate.analysis'],reason:'Delegation needs authorization and an available attempt budget'});
conduct('conduct.commit','conduct.commit',['base','acquire','delegate','gate'],['out']);
edge('parent.observe','out','conduct.ingress');
for(const id of ['proof.inputs','proof.authorized','proof.budget'])edge('conduct.ingress','tick',id);
edge('conduct.ingress','tick','stage.acquire','entered');edge('conduct.ingress','tick','conduct.commit','base');
edge('proof.inputs','value','proof.ready','inputs');edge('proof.authorized','value','proof.ready','authority');
edge('proof.authorized','value','proof.not-authorized');edge('proof.not-authorized','value','proof.blocked','authority');
edge('proof.budget','value','proof.blocked','budget');edge('proof.blocked','value','gate.delegation');
edge('proof.ready','value','stage.acquire','passes');edge('stage.acquire','next','stage.delegate','entered');
edge('stage.acquire','view','conduct.commit','acquire');edge('stage.delegate','view','conduct.commit','delegate');
edge('gate.delegation','view','conduct.commit','gate');edge('conduct.commit','out','parent.context');
fs.writeFileSync(`${root}/src/graphs/agents.json`,JSON.stringify(document,null,2)+'\n');
