
## 0.1.0 (6), 2026-11-05

First build of A2 Calc: a feet-inch-fraction calculator with concrete, block grout and stud wall takeoffs.

What changed

- Calculator for feet, inches and fractions, with areas and volumes, unit chips, precision and a tape
- Type the whole formula, with parentheses; the answer appears only when you press equals
- Memory letters A to F above the keys: store an answer, then use it in a formula
- Quick keys for square and cubic feet and cubic yards, plus x squared, x cubed and square root
- After an answer, switch its unit or give a plain number one
- Landscape layout with the tape on the side
- Convert: length, area, volume, and length by width by depth
- Takeoffs: concrete to order, block fill grout, and stud walls with doors and windows

What to check

- Type a few tape-measure numbers (5 feet 3 and a half inches, then plus, then 2 feet 10 and three quarters) and check the answer
- Try a formula with parentheses, store the answer in A and use it again
- Turn the phone sideways
- Try each takeoff with a real job's numbers

## 0.1.1 (10), 2026-11-05

New app icon: four calculator keys, with a dark-mode version.

What changed

- New icon: feet, inches, a nine and three quarter inch key, and equals; a darker version shows when the phone is in dark mode
- The A2 logo with "Calc" in the calculator header and welcome screen; the new icon on the welcome screen and in About
- Light launch screen with the new icon
- Block fill grout now names its source in full (TEK 4-2A from the Concrete Masonry and Hardscapes Association), and About lists sources

What to check

- The icon on your home screen, in light and dark mode
- The grout screen's Source section

## 0.1.2 (14), 2026-11-05

The keypad now fits on the screen, and the screens moved into a menu.

What changed

- Fixed: the bottom row of keys (0 and the decimal point) was hidden under the tabs on a real iPhone; the keys now fit the screen
- No more tabs at the bottom: Calculator, Convert, the takeoffs and About are in a menu, from the four-squares button at the top right
- The header shows the app icon and A2 Calc

What to check

- All keys are visible and easy to hit, including 0, the decimal point and equals
- Open the menu and move between screens; the back arrow returns to the calculator

## 0.1.3 (27), 2026-11-06

One feet key for feet, square and cubic feet, and doors and windows you can drag along the wall.

What changed

- Feet key: tap once for feet, again for square feet, again for cubic feet, again back to feet; the inch key does the same with inches. Hold either key to pick from a menu. The separate square and cubic keys are gone; Unit has the rest
- Stud wall: a new door or window goes into free wall a foot from the others, and the wall grows when there is no room
- Stud wall: drag a door or window along the wall in the drawing; its distance from the left end shows while it moves. Long walls scroll sideways
- Keyboard support (iPad with a keyboard)
- Fractions show as 1/2, 1/16; About names A2 Labs and has a Legal section

What to check

- Type 5, then tap the feet key several times; then hold it
- Add two windows to a short wall, then drag them around

## 0.1.4 (30), 2026-11-06

After plus or minus, the next number takes the unit of the one before.

What changed

- 5 cubic feet plus 3 now reads 3 cubic feet as soon as you type the 3; 12 feet plus 4 is 4 feet. Tap the feet or inch key to change it (12 feet plus 4 inches still works), or pick from Unit
- Times and divide leave the next number plain, so 12 feet times 3 is 36 feet
- After an answer, plus or minus carries the unit the answer is shown in

What to check

- Add a few cubic or square feet numbers in a row
- Add inches to feet: 12, feet key, plus, 4, inch key

## 0.1.5 (33), 2026-11-06

Tap the answer to copy it, and long presses no longer select the page.

What changed

- Tap the answer to copy it; it pastes as plain text, like 8' 2 1/4", into messages, email or a spreadsheet
- Holding the feet or inch key (or a memory letter) no longer selects text or shows the iPhone copy menu
- Uses the iPhone's own clipboard

What to check

- Work out something, tap the answer, paste it into Messages or Notes
- Hold the feet key: only the feet, square, cubic choice should appear

## 0.1.6 (37), 2026-11-06

The feet and inch keys now change how an answer is shown.

What changed

- After an answer, tap the feet key to switch between feet and inches (8 feet 2 1/4) and decimal feet (8.1875); tap the inch key for inches with fractions (98 1/4) or decimal inches (98.25). Areas and volumes switch between square feet and yards, cubic feet and yards, or square and cubic inches
- Hold either key after an answer to see every format with its value and pick one
- A plain number answer becomes feet or inches with one tap
- The unit chips under the answer now show only with the phone sideways; upright, the format is named under the answer

What to check

- Get a length answer, then tap the feet and inch keys a few times
- Hold the feet key after an answer

## 0.1.7 (40), 2026-11-06

The stud wall takeoff gets a dimensioned floor plan and a 3D view.

What changed

- Floor plan: every wall drawn from above with its length dimensioned
  outside, doors with their swing, windows with glass.
- Tap a wall in the plan (or its chip) to edit it; the selected wall
  gets a dimension string to each door and window edge.
- Each added wall can turn left or right; a room that doesn't close
  shows by how much it misses.
- 3D: the whole framing, member by member, to turn and zoom.

What to check

- Stud wall: add walls, tap them in the plan, flip a turn to Left.
- Switch Plan to 3D: drag to turn, pinch to zoom, two fingers to move.

## 0.1.8 (43), 2026-11-06

Plan and 3D views for every takeoff: stud walls, block walls and concrete.

What changed

- Block wall: walls drawn one by one like the stud wall (length, turn,
  doors and windows), with a dimensioned floor plan and a 3D view that
  shows the grouted cells through the block. Corners, wall ends, jambs
  and opening areas now come from the walls instead of typed counts.
- Concrete: each piece has Sketch, Plan (top view, dimensioned) and 3D
  (every piece side by side, the selected one tinted).
- Stud wall (new in 0.1.7): floor plan with dimensions, tap a wall to
  edit it, left/right turns, 3D framing.
- About: the app is open source under the MIT License; the open-source
  packages it uses are listed with their licenses.

What to check

- Block wall: add walls, a door and a window; drag them in the wall
  drawing; switch Solid / 48″ and look at the plan and 3D.
- Concrete: switch Sketch / Plan / 3D with a few pieces.
- About: tap MIT License and a package.

## 0.1.9 (46), 2026-11-06

Block walls now grout a lintel over every door and window, and the cells beside them.

What changed

- Every door and window in a block wall gets a grouted lintel over it
  (one course up to 6′ wide, two courses wider, bearing 8″ each side)
  and a grouted cell each side, whatever the spacing.
- The lintels' grout shows on its own line in the results.
- Openings are laid to the block module (a 3′ door is a 40″ masonry
  opening, heads and sills on course lines), and grout is counted cell
  by cell from what's drawn.

What to check

- Block wall at 48″: add a door and a wide window; look at the lintels
  in the wall drawing and in 3D, and the Lintels line in the results.

## 0.1.10 (50), 2026-11-06

Block wall lintels can be grouted or poured; terms of use and privacy policy added.

What changed

- Block wall: choose lintel block, grouted (in the grout order) or
  formed and poured (concrete on its own line; no grout or block there).
- Block wall: wall height has its own Wall section with quick picks.
- Terms of Use (use at your own risk) and Privacy Policy (nothing is
  collected), linked from About and the welcome screen.

What to check

- Block wall with a door: switch the lintel between grouted and poured
  and watch the results, the wall drawing and 3D.
- About: open Terms of Use and Privacy Policy.

## 0.2.0 (53), 2026-11-06

0.2.0: the release candidate for the App Store and Google Play.

What changed

- Version 0.2.0, the first public version
- Terms and Privacy give A2 Labs support (support@a2cons.com) as the contact

What to check

- About > Terms of Use and Privacy Policy show the support email
- Everything else as in 0.1.10: calculator, the three takeoffs with Plan and 3D

## 0.2.1 (73), 2026-11-07

Fixes the calculator display on smaller phones, and the Mac app's blank window.

What changed

- On smaller phones, the top of the answer and the formula above it could be cut off. Both now always fit.
- Mac: the app no longer opens to a blank window, and the window can be dragged by its title bar.

What to check

- On a small phone (or a short window), type 5' 3 1/2" + 2' 10 3/4" = and check that the formula and the whole answer show.
- Mac: the window opens with the calculator and moves by its title bar.

## 0.2.2 (76), 2026-11-07

Every dimension field now opens the full calculator.

What changed

- Tapping a length, height or any other value in a takeoff opens the whole calculator: math, memory letters A to F, the tape and units. It starts on the current value, so a new number replaces it and + 2' or x 3 works on it. The = key turns into Done once there's a value to use.
- Answers worked out there land on the calculator's tape, and stored letters are shared with it.

What to check

- Stud wall: tap a wall's Length, type + 2' = Done; the wall grows by 2'.
- Type a plain number (like 30) in a Length field: it means feet, as the field says.
- A wrong kind (2' x 3' in a Length) says it's an area instead of using it.
- The calculator page works as before.

## 0.2.3 (81), 2026-11-07

Paste anything with numbers in it, and a fraction next to a length is inches.

What changed

- Paste takes a value or a whole formula (12' + 4' 6" x 2, 12 ft x 10 ft) and leaves out what it doesn't know: degree signs, $, words, commas in 1,234.
- Paste works in a field's calculator too, not only on the calculator page.
- Mac: Cmd-V pastes right away, with no extra "Paste" button to click.
- A bare fraction added to or taken from a length is inches, as on a tape: 12' + 3/4 is 12' 3/4". Times or divided, it stays a plain number (12' x 3/4 is 9').

What to check

- Copy 45° (or $1,234.50) from anywhere and paste: 45 (1234.5).
- Copy 12' + 4' 6" and paste, then =: 16' 6".
- Type 12' + 3/4 =: 12' 3/4".
- Mac: Cmd-V pastes at once, also in a Stud wall field's calculator.

## 0.2.4 (87), 2026-11-07

Choose light or dark in the menu, a clearer dark mode, and panels close by swiping down.

What changed

- Menu > Appearance: Auto (as the phone is set), Light or Dark.
- Dark mode: fields and keys stand out from the background, so it's clear what can be tapped.
- Every panel that slides up from the bottom (history, memory, units, the menu) closes when you drag its top bar down, or swipe down on it once its list is scrolled to the top.

What to check

- Menu > Appearance > Dark, then look through every screen: is everything tappable easy to spot?
- Switch back and forth with a 3D view open: it repaints.
- Open the history and swipe down on the bar: it closes.
