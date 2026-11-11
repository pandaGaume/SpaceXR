from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/examples/babylon-earth')
for name in ['index.html','orbital.html','atmosphere.html']:
 p=r/name;s=p.read_text(encoding='utf-8');s=s.replace('            <label><input id="atmosphere" type="checkbox" checked /> Atmosphère</label>\n','');s=s.replace('        <canvas id="earth"></canvas>','''        <canvas id="earth"></canvas>
        <section id="render-hud" aria-label="Mesure du rendu">
            <output id="fps" aria-label="Images par seconde">... FPS</output>
            <label><input id="atmosphere" type="checkbox" checked /> Atmosphère</label>
            <output id="atmosphere-state">ON</output>
        </section>''');p.write_text(s,encoding='utf-8')
p=r/'src/style.css';s=p.read_text(encoding='utf-8');s+='''
#render-hud {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid #6584a877;
    border-radius: 8px;
    background: #08101de8;
    font-variant-numeric: tabular-nums;
    user-select: none;
}
#render-hud label { margin: 0; cursor: pointer; }
#fps { min-width: 70px; font-size: 18px; font-weight: 600; }
#atmosphere-state { min-width: 28px; color: #b7dcff; }
''';p.write_text(s,encoding='utf-8')
p=r/'src/main.ts';s=p.read_text(encoding='utf-8').replace('        atmosphere.onchange = () => runtime.setAtmosphereEnabled(atmosphere.checked);','''        const showAtmosphereState=()=>{element<HTMLOutputElement>("atmosphere-state").value=atmosphere.checked?"ON":"OFF";};
        showAtmosphereState();
        atmosphere.onchange = () => {runtime.setAtmosphereEnabled(atmosphere.checked);showAtmosphereState();};''');s=s.replace('                    const resources = runtime.terrain.getStatistics();','                    element<HTMLOutputElement>("fps").value=`${Math.round(engine.getFps())} FPS`;\n                    const resources = runtime.terrain.getStatistics();').replace('status.textContent = withAtmosphere','status.textContent = withAtmosphere && atmosphere.checked');p.write_text(s,encoding='utf-8')
