<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

The drawing at the top of a takeoff: Small no longer floats, Float is its own choice, and Pin is up to you.

What changed

- Small and Large sit full width at the top again. Pin keeps them under the page head while you scroll; turn it off and they scroll away with the page. Each size remembers its own Pin (Small starts pinned, Large doesn't).
- Float is a separate choice: the drawing in a corner over the inputs, to drag and size as before, with Small, Large and Hide on its bar.

What to check

- Switch between Hide, Small, Large and Float in a few tools, and turn Pin on and off for Small and Large; scroll and make sure each stays or goes as set, and is remembered after leaving the tool.
