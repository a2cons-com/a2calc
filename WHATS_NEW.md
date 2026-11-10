<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

Stairs can turn at a landing, and every takeoff keeps its drawing in view while you edit.

What changed

- Stairs: a landing can turn, L or U, left or right; set the space past the last riser and before the next one (0 by default), a gap between U flights, a different width above, and a wall notch at any corner
- Plan and 3D show the turned stair; the floor opening is figured in plan; a turning stair gets a section per straight run, swipe across them
- Adding a landing asks which flight it goes in
- 3D stringers are one solid cut piece; the treads sit on the cuts
- Stair inputs are split into tabs: Levels, Steps, Landings, Stringer, Materials
- All takeoffs: the drawing stays on screen. Small floats in a corner (drag it to another corner, drag its handle to size it), Large sits under the header, or hide it

What to check

- Lay out an L and a U stair you know and compare the landing sizes and heights
- Move and resize the small drawing on a phone; try Large and Hide
