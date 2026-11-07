#!/usr/bin/env python3
"""Uploads android/app/build/outputs/bundle/release/app-release.aab to the
Internal testing track and rolls it out immediately (scripts/play-release.sh
builds it first). Release notes are the "What changed" bullets of
WHATS_NEW.md, which testers see in Play.

Usage: PLAY_KEY_PATH=<service account key.json> python3 scripts/publish-play-release.py
Needs the `cryptography` package.
"""
import base64
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

KEY_PATH = os.path.expanduser(os.environ.get('PLAY_KEY_PATH', ''))
SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AAB_PATH = os.path.join(REPO_ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')
WHATS_NEW_PATH = os.path.join(REPO_ROOT, 'WHATS_NEW.md')
CONFIG_PATH = os.path.join(REPO_ROOT, 'config/app.json')
CONFIG = json.load(open(CONFIG_PATH))
PACKAGE = CONFIG['appId']


def get_access_token() -> str:
    with open(KEY_PATH) as f:
        creds = json.load(f)

    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

    now = int(time.time())
    header = {'alg': 'RS256', 'typ': 'JWT'}
    claims = {
        'iss': creds['client_email'],
        'scope': SCOPE,
        'aud': 'https://oauth2.googleapis.com/token',
        'iat': now,
        'exp': now + 3600,
    }
    signing_input = b64url(json.dumps(header).encode()) + '.' + b64url(json.dumps(claims).encode())
    private_key = serialization.load_pem_private_key(creds['private_key'].encode(), password=None)
    signature = private_key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    jwt = signing_input + '.' + b64url(signature)

    data = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': jwt,
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)['access_token']


def api(token, method, path, body=None):
    url = f'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}{path}'
    headers = {'Authorization': f'Bearer {token}'}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp) if resp.length != 0 else {}
    except urllib.error.HTTPError as e:
        print('ERROR', method, path, e.code, e.read().decode())
        raise


def release_notes(marketing_version: str) -> str:
    """The "What changed" bullets of WHATS_NEW.md, cut on a bullet boundary
    if they run past Play's 500 characters per language."""
    with open(WHATS_NEW_PATH) as f:
        whats_new = f.read()
    match = re.search(r'What changed\n\n(.*?)\n\nWhat to check', whats_new, re.DOTALL)
    notes = match.group(1).strip() if match else f"{CONFIG['appName']} {marketing_version}"
    if len(notes) > 500:
        truncated = notes[:497]
        last_bullet = truncated.rfind('\n- ')
        notes = (truncated[:last_bullet] if last_bullet > 0 else truncated) + '...'
    return notes


def main():
    if not os.path.exists(AAB_PATH):
        raise SystemExit(f'{AAB_PATH} not found: run scripts/play-release.sh')
    if not KEY_PATH or not os.path.exists(KEY_PATH):
        raise SystemExit('PLAY_KEY_PATH must point at the Play service-account key (secrets/play.env)')

    marketing_version = CONFIG['marketingVersion']

    token = get_access_token()
    edit = api(token, 'POST', '/edits')
    edit_id = edit['id']
    print('edit', edit_id)

    with open(AAB_PATH, 'rb') as f:
        raw = f.read()
    url = f'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}/edits/{edit_id}/bundles?uploadType=media'
    req = urllib.request.Request(url, data=raw, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/octet-stream',
    }, method='POST')
    with urllib.request.urlopen(req) as resp:
        bundle_result = json.load(resp)
    print('bundle uploaded:', bundle_result)
    version_code = bundle_result['versionCode']

    # R8 mapping (minifyEnabled): Play de-obfuscates crash and ANR stack traces with it.
    mapping = os.path.join(os.path.dirname(AAB_PATH), '..', '..', 'mapping', 'release', 'mapping.txt')
    if os.path.exists(mapping):
        with open(mapping, 'rb') as f:
            req = urllib.request.Request(
                f'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}/edits/{edit_id}/apks/{version_code}/deobfuscationFiles/proguard?uploadType=media',
                data=f.read(), headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/octet-stream'}, method='POST')
        with urllib.request.urlopen(req) as resp:
            print('mapping uploaded:', json.load(resp))
    else:
        print('no R8 mapping file at', mapping)

    notes = release_notes(marketing_version)
    # PLAY_TRACK=production (or alpha, beta) releases straight to that track;
    # the default is Internal testing.
    track_name = os.environ.get('PLAY_TRACK', 'internal')
    track = api(token, 'PUT', f'/edits/{edit_id}/tracks/{track_name}', body={
        'track': track_name,
        'releases': [{
            'versionCodes': [str(version_code)],
            'status': 'completed',
            'releaseNotes': [{'language': 'en-US', 'text': notes}],
        }],
    })
    print('track updated:', json.dumps(track, indent=2))

    commit = api(token, 'POST', f'/edits/{edit_id}:commit')
    print('committed:', commit)
    print('VERSION_CODE', version_code, 'MARKETING_VERSION', marketing_version)


if __name__ == '__main__':
    main()
