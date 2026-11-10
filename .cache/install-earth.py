from pathlib import Path
import shutil,json
base=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume');render=base/'spacexr-rendering'
stage=Path(__file__).parent/'earth-stage'
for source in stage.rglob('*'):
    if source.is_file():
        dest=render/source.relative_to(stage);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
file=render/'package.json';data=json.loads(file.read_text());
data['workspaces']=['packages/core','packages/tools','packages/babylon-earth','examples/*']
data['dependencies'].update({'@spacexr/celestial-core':'file:../celestial-core','@spacexr/atmosphere':'file:../spacexr-atmosphere'})
data['scripts'].update({'example:earth':'npm run dev --workspace @spacexr/example-babylon-earth','example:earth:preview':'npm run preview --workspace @spacexr/example-babylon-earth'})
file.write_text(json.dumps(data,indent=4)+'\n')
script=render/'scripts/framework.mjs';text=script.read_text()
text=text.replace('"../../terrain-core/", "../"','"../../terrain-core/", "../../quantia/", "../../celestial-core/", "../../spacexr-atmosphere/", "../"')
text=text.replace('const args = action ===', 'const command = action === "check" && ["../../quantia/", "../../celestial-core/", "../../spacexr-atmosphere/"].includes(relative) ? "build" : action;\n    const args = command ===')
text=text.replace('["run", action]', '["run", command]')
script.write_text(text)
for name in ['SpaceXR-Framework.code-workspace','SpaceXR-Applications.code-workspace','spacexr-rendering.code-workspace']:
    file=render/name;data=json.loads(file.read_text());names={f['name'] for f in data['folders']}
    for label,path in [('Celestial','../celestial-core'),('Atmosphere','../spacexr-atmosphere')]:
        if label not in names:data['folders'].append({'name':label,'path':path})
    if name=='SpaceXR-Applications.code-workspace':
        data['folders'].append({'name':'Earth sample','path':'examples/babylon-earth'})
    tasks=data.get('tasks',{}).get('tasks',[])
    if name!='spacexr-rendering.code-workspace':tasks.append({'label':'Earth: dev','type':'shell','command':'npm run example:earth','options':{'cwd':'${workspaceFolder:Rendering}'},'problemMatcher':[],'isBackground':True})
    file.write_text(json.dumps(data,indent=4)+'\n')
ci=render/'.github/workflows/ci.yml';text=ci.read_text();marker='      - name: Check rendering'
if 'Build Earth dependencies' not in text:
    insertion=''
    for repo in ['quantia','celestial-core','spacexr-atmosphere']:
        insertion+=f'      - uses: actions/checkout@v7\n        with:\n          repository: pandaGaume/{repo}\n          path: {repo}\n'
    insertion+='      - name: Build Earth dependencies\n        run: |\n'
    for repo in ['quantia','celestial-core','spacexr-atmosphere']:
        insertion+=f'          npm --prefix {repo} ci --install-links=false\n          npm --prefix {repo} run build\n'
    text=text.replace(marker,insertion+marker);ci.write_text(text)
print('Installed Earth composition and sample, updated workspace wiring.')
