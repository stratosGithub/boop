# Boop! — an interactive shape playground

A tiny web app for little hands. Each screen gives a playful instruction — tap, rub,
press, tilt, shake, blow, or clap — and the friendly shapes react on the next screen.
Circles, triangles, squares and stars in lots of colours wake up, multiply, slide,
scatter and throw a little party.

It's a fully offline-capable web app that runs full-screen on a phone or tablet
(and works on a laptop too, using the on-screen buttons where a device has no sensors).

**Original work.** All artwork, text, shapes and flow are original. The interactions
(tap / rub / tilt / shake / blow / clap) are generic touch and sensor mechanics.

## Files

- `index.html` — app shell
- `style.css` — layout, colours, shapes, animations
- `pages.js` — the screen-by-screen content (text, shape layouts, action per screen)
- `app.js` — engine: rendering, touch (tap/rub/multi-tap/hold), motion (tilt/shake/
  stand-up) and microphone (blow/clap) detection
- `manifest.webmanifest`, `icon.svg`, `sw.js` — PWA (installable + offline)

## Interactions

| Gesture | How it's detected | Fallback |
|---|---|---|
| Tap / multi-tap / press-all | touch | — |
| Rub | finger travel over a shape | Skip button |
| Tilt left / right, stand upright | device orientation (gravity) | Skip button |
| Shake | device motion | Skip button |
| Blow, clap | microphone | Skip button |

Sensor screens reveal a **Skip ▸** button after a few seconds so a child is never
stuck. The **⋯** menu (top-right) has Back / Skip / Start over / Next and a **⚙ Tune**
panel with live sliders for the blow/clap/shake/tilt sensitivity (saved on the device).

On a phone/tablet the first tap asks once for **Motion** and **Microphone** permission —
an adult taps Allow. Both need HTTPS, which GitHub Pages provides.

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` on the same machine (localhost counts as secure, so
motion/mic work for testing). Desktop testing: use the ← / → arrow keys to move
between screens.

## Publish on GitHub Pages

1. Push these files to a **public** repo's `main` branch.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Open the `https://<user>.github.io/<repo>/` URL on the device.
4. In Safari: **Share → Add to Home Screen** for a full-screen, app-like icon.

## Tuning detection

Open the **⋯** menu → **⚙ Tune** in the running app: live sliders with a real-time
readout of what each sensor is reading. Defaults live in the `DEFAULTS` object at the
top of `app.js`.
