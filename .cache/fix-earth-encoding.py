from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
for folder in ['packages/babylon-earth','examples/babylon-earth']:
    for file in (root/folder).rglob('*'):
        if file.is_file() and file.suffix in ['.ts','.html','.md','.json','.wgsl','.mjs'] and 'dist' not in file.parts and 'node_modules' not in file.parts:
            raw=file.read_bytes();text=raw.decode('utf-8',errors='surrogateescape')
            text=''.join(bytes([ord(c)-0xdc00]).decode('cp1252') if 0xdc80<=ord(c)<=0xdcff else c for c in text)
            file.write_text(text.replace('\r\n','\n'),encoding='utf-8',newline='\n')
print('Normalized new source files to UTF-8 and LF.')
