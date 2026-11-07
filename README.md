# A2 Calc

A free calculator for feet, inches and fractions, with quick concrete, block
fill grout and stud wall takeoffs. No ads, no account, nothing leaves the
phone. Made by A2 Labs.

- Calculator: feet-inch-fraction entry, parentheses, areas and volumes,
  unit conversion, memory letters A-F, a tape of past answers
- Convert: length, area, volume, length by width by depth
- Takeoff: concrete to order, block fill grout, stud walls with doors and
  windows

Built with SvelteKit as a static app and wrapped for iOS and Android with
Capacitor; `ios/` and `android/` share the same web build and the identity
in `config/app.json`.

```sh
npm install
npm run dev            # web, http://localhost:5180
npm run check && npm test
scripts/build-sim.sh --run       # iOS Simulator
scripts/build-android.sh --run   # Android emulator or connected phone
```

Release builds: `scripts/testflight.sh` (TestFlight; needs
`secrets/testflight.env`, see `secrets.env.example`) and
`scripts/play-release.sh` (Play Internal testing; needs `secrets/play.env`
with `PLAY_KEY_PATH` and `android/keystore.properties` for the upload key).
Both read the build notes from `WHATS_NEW.md`. The Mac app
(`macos/`, a native AppKit window around the same web build) uploads with
`scripts/mac-release.sh`.

Windows: `windows/` is a Tauri app around the same web build, shown in the
system's WebView2. GitHub Actions builds it (`.github/workflows/windows.yml`);
pushing a version tag such as `v0.1.2` attaches an installer and a
standalone `.exe` to that release. The exe is not code-signed, so Windows
shows a SmartScreen prompt the first time (More info, then Run anyway).

## Notes

Results are an estimating aid: check them before building or ordering. They
are not engineering advice or a sealed calculation.

Block fill grout volumes are based on an industry technical note on
estimating masonry materials (the app's grout screen gives the citation).
Names of other organizations, publications and products are used only to
identify a source and belong to their owners; any trademarks among them are
the property of their respective owners. A2 Calc is not affiliated with,
sponsored or endorsed by any of them.

© 2026 A2 Labs.

## Support

Questions, problems or ideas: email A2 Labs support at
support@a2cons.com, or [open an issue](https://github.com/a2cons-com/a2calc/issues).
The app is available on the App Store (iPhone, iPad and Mac) and Google
Play as "A2 Takeoff Calc".

## Website

https://calc.a2cons.com: the landing page, a guide, support, and the
terms and privacy pages (made from TERMS.md and PRIVACY.md). Sources are
in `site/` (`pages/` wrapped by `scripts/site-build.mjs` into `_site/`);
`.github/workflows/pages.yml` publishes it to GitHub Pages on every push
that touches them. Screenshots come from `scripts/store/shots.cjs` with
`RAW=<dir>` (WebP, 600 px wide); the videos are the promos re-encoded to
720x1280 and start loading only after the page has. Once the App Store
version is live, set `APP_STORE_LIVE` in the build script.

## Terms and privacy

[Terms of Use](TERMS.md) (use at your own risk; no warranty) and
[Privacy Policy](PRIVACY.md) (the app collects nothing). The app shows
the same files on its Terms and Privacy screens, and the store listings
link to them here.

## License

The code is released under the [MIT License](LICENSE), © 2026 A2 Labs.

The license covers the code only. The A2 Calc name, the A2 logo and the
app icons (`resources/`, the icon sets under `ios/`, `android/`,
`macos/` and `windows/`, `static/`) identify A2 Labs and are not
licensed for use in other apps, including forks: rename and re-icon a
fork before publishing it.

Everything the app ships with is MIT-licensed open-source software;
`scripts/gen-licenses.mjs` collects their license texts into
`src/lib/licenses.json` (on every `npm run config`), and the About
screen lists them.
