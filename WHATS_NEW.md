<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

Stairs with landings now show the rise and run of every flight and the height of every landing.

What changed

- A Flights list under the drawing when the stair has a landing: each flight's risers, treads, rise and run, each landing's height and depth, and the totals
- Landing heights are to the finished landing surface from the finished floor below; the framing top above the rough floor is shown too
- The section dimensions each flight's run and each landing's depth above the total run, and labels each landing's height
- The PDF and CSV exports include the Flights table

What to check

- Make the rise tall enough for a landing (or add one with plus) and check each flight's rise and run against a stair you built
- Export the PDF and look at the Flights table
