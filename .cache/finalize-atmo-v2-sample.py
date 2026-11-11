from pathlib import Path
import json
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'packages/babylon-earth/package.json';s=p.read_text(encoding='utf-8').replace('        "README.md"','        "README.md",\n        "THIRD-PARTY-NOTICES.md"');p.write_text(s,encoding='utf-8')
p=r/'examples/babylon-earth/src/main.ts';s=p.read_text(encoding='utf-8');s=s.replace('        const horizonView = query.get("view") === "horizon";','''        const horizonView = query.get("view") === "horizon";
        const initialHour=Number(query.get("hour")??12);
        if(!Number.isFinite(initialHour)||initialHour<0||initialHour>24)throw new RangeError("hour must be between 0 and 24 UTC.");
        const initialDate=new Date(Date.UTC(2026,5,21)+initialHour*3600000);''').replace('            date: new Date("2026-06-21T12:00:00Z"),','            date: initialDate,').replace('        hour.oninput = () => showTime(dateAt(Number(hour.value)));','        showTime(initialDate);\n        hour.oninput = () => showTime(dateAt(Number(hour.value)));');p.write_text(s,encoding='utf-8')
p=r/'examples/babylon-earth/README.md';s=p.read_text(encoding='utf-8');s+='\nUse `/atmosphere.html?hour=10&sse=20` to reproduce the daytime horizon at 10:00 UTC directly. `hour` accepts values from 0 to 24.\n';p.write_text(s,encoding='utf-8')
