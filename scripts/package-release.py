#!/usr/bin/env python3
"""Build a source-only release ZIP outside the repository using an allowlist."""
import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root.parent / f'dsh-codex-kit-{version}.zip'
if output.exists():
    raise SystemExit('Release archive already exists; move it aside before rebuilding')

files = []
top_files = {
    'package.json', 'package-lock.json', 'plugin.json', 'mcp.json', '.mcp.json',
    '.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'DSH-HANDOFF.md',
}
directories = {'.agents', '.codex-plugin', 'scripts', 'skills', 'tests', 'docs', 'licenses', 'vendor'}
skip = {'node_modules', '.git', '.local', '__pycache__'}

def visit(directory):
    for path in sorted(directory.iterdir()):
        if path.name in skip:
            continue
        if path.is_symlink():
            raise SystemExit('Refusing symlink in release tree')
        path.resolve().relative_to(root)
        if path.is_dir():
            visit(path)
        elif path.suffix != '.pyc':
            files.append(path)

for name in sorted(top_files):
    path = root / name
    if not path.is_file() or path.is_symlink():
        raise SystemExit(f'Missing regular release file: {name}')
    files.append(path)
for name in sorted(directories):
    visit(root / name)

manifest = []
for path in sorted(files):
    relative = path.relative_to(root).as_posix()
    if path.name.startswith('.env') or path.suffix in {'.log', '.db', '.jsonl'}:
        raise SystemExit('Runtime file detected; no archive written')
    data = path.read_bytes()
    manifest.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})

with ZipFile(output, 'x', compression=ZIP_DEFLATED) as archive:
    for item in manifest:
        archive.write(root / item['path'], f'{root.name}/{item["path"]}')
    archive.writestr(f'{root.name}/RELEASE-MANIFEST.json', json.dumps({'version': version, 'files': manifest}, ensure_ascii=False, indent=2) + '\n')
with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('ZIP integrity check failed')
    for item in manifest:
        data = archive.read(f'{root.name}/{item["path"]}')
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise SystemExit('ZIP content hash differs')
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n', encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps({'archive': str(output), 'files': len(manifest) + 1, 'bytes': output.stat().st_size, 'sha256': digest}, ensure_ascii=False))
