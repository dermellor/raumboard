#!/usr/bin/env python3
"""Deploy dist/ to Bunny CDN (storage zone + pull zone `lernraum-board`).

First run creates both zones and stores the storage password in
~/_AGENTS/.env (LERNRAUM_STORAGE_PASSWORD). Later runs just upload + purge.
Secrets are never printed.
"""

import json
import mimetypes
import os
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ENV_PATH = Path.home() / '_AGENTS' / '.env'
DIST = Path(__file__).resolve().parent.parent / 'dist'
ZONE_NAME = 'lernraum-board'
REGION = 'DE'  # Falkenstein
STORAGE_HOST = 'storage.bunnycdn.com'
API = 'https://api.bunny.net'


def load_env() -> dict[str, str]:
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def api(method: str, path: str, key: str, body: dict | None = None) -> dict | list:
    req = Request(
        f'{API}{path}',
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'AccessKey': key, 'Content-Type': 'application/json', 'Accept': 'application/json'},
    )
    with urlopen(req) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def ensure_zones(key: str, env: dict[str, str]) -> str:
    """Create storage + pull zone if needed; return storage password."""
    if 'LERNRAUM_STORAGE_PASSWORD' in env:
        return env['LERNRAUM_STORAGE_PASSWORD']

    zones = api('GET', '/storagezone', key)
    zone = next((z for z in zones if z['Name'] == ZONE_NAME), None)
    if zone is None:
        zone = api('POST', '/storagezone', key, {'Name': ZONE_NAME, 'Region': REGION})
        print(f'storage zone created: id={zone["Id"]}')
    password = zone['Password']

    pulls = api('GET', '/pullzone', key)
    pull = next((p for p in pulls if p['Name'] == ZONE_NAME), None)
    if pull is None:
        pull = api('POST', '/pullzone', key, {'Name': ZONE_NAME, 'StorageZoneId': zone['Id']})
        print(f'pull zone created: id={pull["Id"]}, host={ZONE_NAME}.b-cdn.net')

    with ENV_PATH.open('a') as f:
        f.write(f'\n# lernraum-board — Bunny storage zone password (deploy-bunny.py)\n')
        f.write(f'LERNRAUM_STORAGE_PASSWORD={password}\n')
    os.chmod(ENV_PATH, 0o600)
    print('storage password stored in ~/_AGENTS/.env')
    return password


def upload(password: str) -> int:
    count = 0
    for file in sorted(DIST.rglob('*')):
        if not file.is_file():
            continue
        rel = file.relative_to(DIST).as_posix()
        ctype = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        req = Request(
            f'https://{STORAGE_HOST}/{ZONE_NAME}/{rel}',
            method='PUT',
            data=file.read_bytes(),
            headers={'AccessKey': password, 'Content-Type': ctype},
        )
        with urlopen(req) as resp:
            resp.read()
        print(f'  up: {rel} ({ctype})')
        count += 1
    return count


def purge(key: str) -> None:
    pulls = api('GET', '/pullzone', key)
    pull = next((p for p in pulls if p['Name'] == ZONE_NAME), None)
    if pull:
        api('POST', f'/pullzone/{pull["Id"]}/purgeCache', key, {})
        print('pull zone cache purged')


def main() -> None:
    if not DIST.is_dir():
        sys.exit('dist/ fehlt — erst `npm run build`')
    env = load_env()
    key = env.get('BUNNY_ACCOUNT_API_KEY')
    if not key:
        sys.exit('BUNNY_ACCOUNT_API_KEY fehlt in ~/_AGENTS/.env')
    try:
        password = ensure_zones(key, env)
        n = upload(password)
        purge(key)
    except HTTPError as e:
        sys.exit(f'Bunny API error {e.code} on {e.url}: {e.read().decode()[:300]}')
    print(f'deployed {n} files → https://{ZONE_NAME}.b-cdn.net')


if __name__ == '__main__':
    main()
