<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

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
