"""Use the packaged renderer with a Windows Word PDF-conversion adapter.

The bundled runtime does not contain LibreOffice on this host. The initial
canonical conversion failed before rendering. Keep its rasterization and DPI
logic, replacing only the unavailable conversion stage with installed Word.
"""
from pathlib import Path
import importlib.util,os,subprocess

HERE=Path(__file__).resolve().parent
SKILL=Path(r'C:/Users/GuillaumePelletier/.codex/plugins/cache/openai-primary-runtime/documents/26.1104.11149/skills/documents')
POPPLER=Path(r'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1104-709-0_26.1104.709.0_x64__3k8sg7r9htsxt/dependencies/native/poppler/Library/bin')
os.environ['PATH']=str(POPPLER)+os.pathsep+os.environ.get('PATH','')
spec=importlib.util.spec_from_file_location('canonical_docx_renderer',SKILL/'render_docx.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def convert(doc_path,user_profile,convert_tmp_dir,stem,verbose):
    out=Path(convert_tmp_dir)/f'{stem}.pdf'
    command=[r'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-File',str(HERE/'export-word.ps1'),'-InputPath',str(Path(doc_path).resolve()),'-OutputPath',str(out),'-UpdateFields']
    result=subprocess.run(command,capture_output=True,text=True,timeout=180)
    if result.returncode or not out.exists():raise RuntimeError(result.stdout+'\n'+result.stderr)
    print(result.stdout.strip());return str(out),result.stdout
module.convert_to_pdf=convert
module.main()
