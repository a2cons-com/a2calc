# Store listings

Everything the App Store and Google Play listings need, in one place.

| Path | What |
| --- | --- |
| `listing.json` | Name, subtitle, description, keywords, URLs, categories, App Review notes, Play title and short description |
| `screenshots/APP_IPHONE_67`, `APP_IPAD_PRO_3GEN_129`, `APP_DESKTOP` | App Store: iPhone 6.9" (1320x2868), iPad 13" (2048x2732), Mac (2880x1800) |
| `play/phone`, `play/tablet7`, `play/tablet10`, `play/feature-graphic.png`, `play/icon-512.png` | Google Play graphics |
| `video/a2calc-promo.mp4` | 30 s vertical promo (1080x1920) for social media and the website |
| `video/a2calc-promo-trucks.mp4` | The second, funnier promo ("One truck. The right truck."), 34 s, 1080x1920 |
| `video/a2calc-app-preview.mp4` | The first promo at 886x1920, within Apple's app preview specs (not uploaded) |

Regenerate the screenshots with `scripts/store/` (see `shots.cjs`), the
video with `scripts/promo/`. Push them with:

- `node scripts/asc-listing.mjs --screenshots [--build N] [--mac-build N]`
  (with `secrets/testflight.env` loaded): App Store text, screenshots,
  age rating, categories, price (free) and availability (all territories)
  for the iOS and macOS draft versions. Never submits.
- `python3 scripts/play-listing.py` (with `secrets/play.env` loaded): Play
  listing text, contact details and graphics. Doesn't touch releases.

## Fixed answers

| Field | Value |
| --- | --- |
| Name | A2 Takeoff Calc (A2 Calc under the icon) |
| Category | App Store: Utilities, then Productivity. Play: Tools |
| Price | Free, all territories |
| Age rating | 4+ / Everyone (no objectionable content) |
| Privacy Policy URL | https://github.com/a2cons-com/a2calc/blob/main/PRIVACY.md |
| Support URL | https://github.com/a2cons-com/a2calc#support (support@a2cons.com) |
| Copyright | 2026 A2 Labs |
| License | Apple's standard EULA; the app's own terms are in TERMS.md |
| Export compliance | No encryption (no network use at all) |

## By hand: App Store Connect

1. **App Privacy**: Get Started > "No, we do not collect data from this
   app" > Publish. (The API can't set it.)
2. **App Review contact** (both the iOS and macOS versions): name, phone
   and email. Or run the script with `REVIEW_CONTACT_FIRST / _LAST /
   _EMAIL / _PHONE` set.
3. **Build**: pick the 0.2.0 build on each version (or `--build` /
   `--mac-build` once it has processed).
4. **Add for Review**, then Submit. Release is set to manual: once
   approved, press Release.

## By hand: Google Play Console

1. **App content**: privacy policy (the URL above); ads: no; app access:
   all functionality without restrictions; content rating questionnaire
   (utility, nothing objectionable); target audience 18+ (not designed
   for children); data safety: no data collected, no data shared;
   government, financial, health and news declarations: none.
2. **Store settings**: category Tools, contact email (already set).
3. **Release**: promote the internal-testing build to Production (or
   closed testing first; a personal developer account needs a closed test
   with 12 testers for 14 days before Production is unlocked).
