import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
const source=new URL("../src/atmosphere/display.wgsl",import.meta.url);
const target=new URL("../src/atmosphere/generated/",import.meta.url);
mkdirSync(target,{recursive:true});
writeFileSync(new URL("display.ts",target),"// Generated from display.wgsl. Run npm run shaders.\nexport const displayShader = "+JSON.stringify(readFileSync(source,"utf8"))+";\n");
