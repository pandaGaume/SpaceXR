from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
(a/'tests/browser/aerial-horizon.js').write_text(Path('.cache/aerial-horizon-test.js').read_text(encoding='utf-8'),encoding='utf-8')
p=a/'tests/browser/validate.js';s=p.read_text(encoding='utf-8');s='import {validateAerialHorizon} from "./aerial-horizon.js";\n'+s;s=s.replace('        report.aerial = await validateAerial(device);','        report.aerialHorizon=await validateAerialHorizon(device);\n        failures.push(...report.aerialHorizon.failures);\n        report.aerial = await validateAerial(device);');p.write_text(s,encoding='utf-8')
