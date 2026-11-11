from pathlib import Path
import json
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=root/'scripts/verify-framework.mjs';s=f.read_text(encoding='utf-8').replace('import { createRequire } from "node:module";\n','').replace('import { fileURLToPath } from "node:url";','import { fileURLToPath, pathToFileURL } from "node:url";').replace('    const require = createRequire(resolve(scope, "package.json"));\n','').replace('dirname(require.resolve(name))','dirname(fileURLToPath(import.meta.resolve(name, pathToFileURL(resolve(scope, "package.json")).href)))');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'package.json';d=json.loads(f.read_text(encoding='utf-8'));d['scripts']['framework:verify']='node --experimental-import-meta-resolve scripts/verify-framework.mjs';f.write_text(json.dumps(d,indent=4)+'\n',encoding='utf-8',newline='\n')
