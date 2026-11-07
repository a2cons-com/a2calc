<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

Every dimension field now opens the full calculator.

What changed

- Tapping a length, height or any other value in a takeoff opens the whole calculator: math, memory letters A to F, the tape and units. It starts on the current value, so a new number replaces it and + 2' or x 3 works on it. The = key turns into Done once there's a value to use.
- Answers worked out there land on the calculator's tape, and stored letters are shared with it.

What to check

- Stud wall: tap a wall's Length, type + 2' = Done; the wall grows by 2'.
- Type a plain number (like 30) in a Length field: it means feet, as the field says.
- A wrong kind (2' x 3' in a Length) says it's an area instead of using it.
- The calculator page works as before.
