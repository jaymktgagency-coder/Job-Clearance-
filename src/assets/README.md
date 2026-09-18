# Assets

## hello-apple.json

The "hello" animation — the Apple-style cursive word, drawn on by hand as if
written with a pen.

- **Downloaded from:** <https://lottiefiles.com/free-animation/hello-apple-AoREfCSh5U>
- **Title:** Hello (apple)
- **Author:** Noé M, on LottieFiles
- **Licence:** LottieFiles Free / Simple Licence — free for personal and
  commercial use. Attribution is not required, but this file records where it
  came from so nobody has to go looking later.

**Do not hand-edit this file.** It is the publisher's original, byte for byte.
Anything we want changed about it — the colour, how fast it plays, how much of
it plays — is done at runtime in `src/components/hello-lottie.tsx`, so the
asset stays a clean copy of what was downloaded and can be re-downloaded and
swapped in without losing our changes.

### What is actually inside it

One stroked path with a "trim paths" animation over it — the stroke is
revealed a bit at a time, which is what makes the word look handwritten.
It runs at 120 frames per second for 720 frames (6 seconds), in three parts:

| Frames | Seconds | What happens |
|---|---|---|
| 25 – 300 | 0.2 – 2.5 | The word writes itself on |
| 300 – 499 | 2.5 – 4.2 | It sits there, finished |
| 499 – 690 | 4.2 – 5.8 | It un-writes itself and disappears |

We only ever play the **first part** and stop, so the word writes on and then
stays put. Playing all 6 seconds would mean the greeting rubbing itself out
while the visitor is still reading the headline next to it.

The stroke is flat black in the original. We tint it to the brand orange at
runtime so it matches everything else on the page.
