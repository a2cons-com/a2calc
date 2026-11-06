# A2 Calc

A free calculator for feet, inches and fractions, with quick concrete, block
fill grout and stud wall takeoffs. No ads, no account, nothing leaves the
phone. Made by A2 Labs.

- Calculator: feet-inch-fraction entry, parentheses, areas and volumes,
  unit conversion, memory letters A-F, a tape of past answers
- Convert: length, area, volume, length by width by depth
- Takeoff: concrete to order, block fill grout, stud walls with doors and
  windows

Built with SvelteKit as a static app and wrapped for iOS with Capacitor.

```sh
npm install
npm run dev            # web, http://localhost:5180
npm run check && npm test
scripts/build-sim.sh --run   # iOS Simulator
```

Release builds: `scripts/testflight.sh` (needs `secrets/testflight.env`, see
`secrets.env.example`).

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
