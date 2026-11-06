<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

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
