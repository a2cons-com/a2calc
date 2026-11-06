#!/usr/bin/env python3
"""Fills the Google Play store listing from docs/store-listing/listing.json
(title, short and full description, contact details) and replaces its
graphics with docs/store-listing/play/ (phone, 7" and 10" tablet
screenshots, feature graphic, icon). Doesn't touch releases or tracks.

Usage: PLAY_KEY_PATH=<service account key.json> python3 scripts/play-listing.py [--dry-run]
(scripts/play-release.sh's secrets/play.env sets PLAY_KEY_PATH.)
"""
import importlib.util
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('pub', os.path.join(ROOT, 'scripts/publish-play-release.py'))
pub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pub)

LISTING = json.load(open(os.path.join(ROOT, 'docs/store-listing/listing.json')))
PLAY = os.path.join(ROOT, 'docs/store-listing/play')
IMAGES = {  # Play image type -> files
    'phoneScreenshots': 'phone',
    'sevenInchScreenshots': 'tablet7',
    'tenInchScreenshots': 'tablet10',
    'featureGraphic': 'feature-graphic.png',
    'icon': 'icon-512.png',
}
DRY = '--dry-run' in sys.argv


def files(entry):
    path = os.path.join(PLAY, entry)
    if os.path.isdir(path):
        return [os.path.join(path, f) for f in sorted(os.listdir(path)) if f.endswith('.png')][:8]
    return [path]


def upload(token, edit_id, image_type, path):
    url = (f'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/'
           f'{pub.PACKAGE}/edits/{edit_id}/listings/en-US/{image_type}?uploadType=media')
    with open(path, 'rb') as f:
        req = urllib.request.Request(url, data=f.read(), method='POST',
                                     headers={'Authorization': f'Bearer {token}', 'Content-Type': 'image/png'})
    with urllib.request.urlopen(req) as resp:
        json.load(resp)


def main():
    if not pub.KEY_PATH or not os.path.exists(pub.KEY_PATH):
        raise SystemExit('PLAY_KEY_PATH must point at the Play service-account key (secrets/play.env)')
    play = LISTING['play']
    listing = {
        'language': 'en-US',
        'title': play['title'],
        'shortDescription': play['shortDescription'],
        'fullDescription': LISTING['description'],
    }
    details = {
        'defaultLanguage': 'en-US',
        'contactEmail': 'support@a2cons.com',
        'contactWebsite': LISTING['marketingUrl'],
    }
    if DRY:
        print(json.dumps({'listing': listing, 'details': details}, indent=1)[:1500])
        for t, e in IMAGES.items():
            print(t, [os.path.relpath(p, ROOT) for p in files(e)])
        return
    token = pub.get_access_token()
    edit_id = pub.api(token, 'POST', '/edits')['id']
    print('edit', edit_id)
    pub.api(token, 'PUT', f'/edits/{edit_id}/listings/en-US', body=listing)
    print('listing: title, short and full description')
    pub.api(token, 'PATCH', f'/edits/{edit_id}/details', body=details)
    print('details: contact email and website')
    for image_type, entry in IMAGES.items():
        pub.api(token, 'DELETE', f'/edits/{edit_id}/listings/en-US/{image_type}')
        paths = files(entry)
        for p in paths:
            upload(token, edit_id, image_type, p)
        print(f'{image_type}: {len(paths)} uploaded')
    print('committed:', pub.api(token, 'POST', f'/edits/{edit_id}:commit').get('id'))


if __name__ == '__main__':
    main()
