from pathlib import Path
import shutil
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
shutil.copy2(Path(__file__).parent/'aerial-stage/atmosphere/tests/browser/aerial.js',root/'tests/browser/aerial.js')
f=root/'tests/browser/validate.js';s=f.read_text(encoding='utf-8');s='import { validateAerial } from "./aerial.js";\n'+s;s=s.replace('        const lossCheck = await AtmosphereSky.create','        report.aerial = await validateAerial(device);\n        failures.push(...report.aerial.failures);\n        const lossCheck = await AtmosphereSky.create');f.write_text(s,encoding='utf-8',newline='\n')
print('Added finite-distance CPU/GPU comparisons to the existing packed-consumer WebGPU test.')
