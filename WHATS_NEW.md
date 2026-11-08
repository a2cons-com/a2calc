<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

New Stairs takeoff, a first draft: risers, treads, landings and the stringer layout between two floors.

What changed

- Stairs in the menu and in Takeoffs: enter the rough rise and the finish floor at the bottom and top, and get the riser count and height, treads, total run and angle
- Risers and landings pick themselves from the code limits (IRC for homes, IBC for commercial), or set them with minus and plus
- Stringer layout: the first rise cut short for the tread and finish, the top drop below the upper subfloor, what's left under the notches, stringers across, lengths, and a cut list
- The floor opening needed for 6 foot 8 headroom, from the upper floor depth
- Section, plan and 3D views, warnings when a limit is broken, and the code reminders at the bottom
- Stairs can be saved to a project and exported to PDF and CSV

What to check

- Enter a real stair from a job and compare the riser height and run with what you'd lay out by hand
- Change the finish floors and watch the first rise and the top drop on the stringer change
- Make the rise tall enough to need a landing, then try the section, plan and 3D views
- Save it to a project and export the PDF
