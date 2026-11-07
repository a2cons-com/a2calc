<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

Fixes the calculator display on smaller phones, and the Mac app's blank window.

What changed

- On smaller phones, the top of the answer and the formula above it could be cut off. Both now always fit.
- Mac: the app no longer opens to a blank window, and the window can be dragged by its title bar.

What to check

- On a small phone (or a short window), type 5' 3 1/2" + 2' 10 3/4" = and check that the formula and the whole answer show.
- Mac: the window opens with the calculator and moves by its title bar.
