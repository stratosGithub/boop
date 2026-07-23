/* Page data for "Boop!" — an original interactive shape playground.
 * Coordinates are percentages of the stage. r = radius (% of the smaller screen side).
 * Colors: r red, y yellow, b blue, g green, p purple, o orange, k pink, w white.
 * Shapes: circle (default), triangle, square, star.
 * action.type drives the interaction; enter drives the entrance animation.
 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['r', 'y', 'b', 'g', 'p', 'o', 'k'];
const SHAPES = ['circle', 'triangle', 'square', 'star'];

// scattered mix of colors and shapes
function scatter(n, seed, xmin, xmax, ymin, ymax, r) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      c: COLORS[Math.floor(rnd() * COLORS.length)],
      shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
      x: xmin + (xmax - xmin) * rnd(),
      y: ymin + (ymax - ymin) * rnd(),
      r,
    });
  }
  return out;
}

// a vertical stack of one colour + shape
function col(x, color, shape, r) {
  return [13, 31.5, 50, 68.5, 87].map((y) => ({ c: color, shape, x, y, r }));
}

// a horizontal line, cycling colours + shapes
function row(n, r, seed) {
  const rnd = mulberry32(seed || 7);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      c: COLORS[i % COLORS.length],
      shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
      x: 6 + (88 * i) / (n - 1),
      y: 50,
      r,
    });
  }
  return out;
}

// a gentle arch of shapes
function arc(n, r, seed) {
  const rnd = mulberry32(seed || 11);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({
      c: COLORS[i % COLORS.length],
      shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
      x: 8 + 84 * t,
      y: 58 - 34 * Math.sin(Math.PI * t),
      r,
    });
  }
  return out;
}

// shapes bunched near the top
function topRow(n, seed, r) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      c: COLORS[i % COLORS.length],
      shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
      x: 8 + (84 * i) / (n - 1),
      y: 8 + rnd() * 10,
      r,
    });
  }
  return out;
}

const PAGES = [
  { id: 'cover', kind: 'cover' },

  { id: 'ready', kind: 'intro', text: 'Want to play?',
    dots: [{ c: 'b', shape: 'circle', x: 50, y: 48, r: 9 }],
    action: { type: 'tapDot' }, enter: 'pop' },

  { id: 'p1', text: 'Hello, little circle!\nGive it a gentle boop.',
    dots: [{ c: 'b', shape: 'circle', x: 50, y: 48, r: 9 }],
    action: { type: 'tapDot' }, enter: 'pop' },

  { id: 'p2', text: 'It woke up a friend!\nBoop the blue circle again.',
    // the original circle stays centred; the new friend appears on the left
    dots: [{ c: 'b', shape: 'circle', x: 50, y: 48, r: 9 }, { c: 'o', shape: 'triangle', x: 27, y: 48, r: 9 }],
    action: { type: 'tapDot', target: 0 }, enter: 'pop' },

  { id: 'p3', text: 'Three friends now!\nRub the shape on the left to tickle it.',
    dots: [{ c: 'o', shape: 'triangle', x: 27, y: 46, r: 8.5 }, { c: 'b', shape: 'circle', x: 50, y: 46, r: 8.5 }, { c: 'g', shape: 'square', x: 73, y: 46, r: 8.5 }],
    action: { type: 'rub', target: 0 }, enter: 'pop' },

  { id: 'p4', text: 'It giggled pink!\nNow rub the one on the right.',
    dots: [{ c: 'k', shape: 'triangle', x: 27, y: 46, r: 8.5 }, { c: 'b', shape: 'circle', x: 50, y: 46, r: 8.5 }, { c: 'g', shape: 'square', x: 73, y: 46, r: 8.5 }],
    action: { type: 'rub', target: 2 }, enter: 'none' },

  { id: 'p5', text: 'Ta-da, a purple star!\nTap the blue circle four times.',
    dots: [{ c: 'k', shape: 'triangle', x: 27, y: 46, r: 8.5 }, { c: 'b', shape: 'circle', x: 50, y: 46, r: 8.5 }, { c: 'p', shape: 'star', x: 73, y: 46, r: 9 }],
    action: { type: 'tapCount', color: 'b', count: 4 }, enter: 'none' },

  { id: 'p6', text: 'They multiply when tapped!\nNow four taps on the pink triangle.',
    dots: [{ c: 'k', shape: 'triangle', x: 24, y: 50, r: 7.5 }, ...col(50, 'b', 'circle', 7.5), { c: 'p', shape: 'star', x: 76, y: 50, r: 8 }],
    action: { type: 'tapCount', color: 'k', count: 4 }, enter: 'grow' },

  { id: 'p7', text: 'Almost a whole crowd!\nFour taps on the purple star.',
    dots: [...col(24, 'k', 'triangle', 7.5), ...col(50, 'b', 'circle', 7.5), { c: 'p', shape: 'star', x: 76, y: 50, r: 8 }],
    action: { type: 'tapCount', color: 'p', count: 4 }, enter: 'grow' },

  { id: 'p8', text: 'What a bunch!\nGive the screen a little shake.',
    dots: [...col(24, 'k', 'triangle', 7), ...col(50, 'b', 'circle', 7), ...col(76, 'p', 'star', 7.5)],
    action: { type: 'shake' }, enter: 'grow' },

  { id: 'p9', text: 'They love that!\nShake a bit harder.',
    dots: scatter(15, 4101, 12, 88, 14, 80, 7),
    action: { type: 'shake' }, enter: 'jitter' },

  { id: 'p10', text: 'Wheee! Now tip the screen\ngently to the left.',
    dots: scatter(15, 4102, 12, 88, 12, 84, 7),
    action: { type: 'tiltLeft' }, enter: 'jitter' },

  { id: 'p11', text: 'They slid over!\nNow tip it to the right.',
    dots: scatter(15, 4103, 5, 32, 8, 90, 7),
    action: { type: 'tiltRight' }, enter: 'slideL' },

  { id: 'p12', text: 'Slippy shapes!\nOne more shake to line them up.',
    dots: scatter(15, 4104, 68, 95, 8, 90, 7),
    action: { type: 'shake' }, enter: 'slideR' },

  { id: 'p13', text: 'All in a row!\nPress and hold every yellow one.',
    dots: row(12, 5.5, 21),
    action: { type: 'tapAll', color: 'y' }, enter: 'settle' },

  { id: 'p14', text: 'Uh-oh, lights out!\nTap the glowing shapes to switch them on.', bg: 'dark',
    dots: row(12, 5.5, 21).filter((d) => d.c === 'y'),
    action: { type: 'tapAll' }, enter: 'none' },

  { id: 'p15', text: 'Bright again!\nNow squish them all — press every shape.',
    dots: row(12, 5.5, 21),
    action: { type: 'tapAll' }, enter: 'pop' },

  { id: 'p16', text: 'Squishy!\nGive them a shake in the dark.', bg: 'dark',
    dots: row(12, 5.5, 21),
    action: { type: 'shake' }, enter: 'none' },

  { id: 'p17', text: 'Pretty glow, isn’t it?\nBlow softly to sweep the dark away.', bg: 'dark',
    dots: arc(12, 6, 33),
    action: { type: 'blow' }, enter: 'jitter' },

  { id: 'p18', text: 'Almost there —\ngive it one more puff!', bg: 'half',
    dots: arc(12, 6, 33),
    action: { type: 'blow' }, enter: 'none' },

  { id: 'p19', text: 'Whoops, they floated up!\nHold the screen up straight so they tumble down.',
    dots: topRow(12, 4105, 6),
    action: { type: 'upright' }, enter: 'none' },

  { id: 'p20', text: 'Everyone’s happy!\nGive one big clap.',
    dots: scatter(9, 4106, 16, 84, 15, 78, 8),
    action: { type: 'clap', count: 1 }, enter: 'drop' },

  { id: 'p21', text: 'They bounced! Clap twice.',
    dots: scatter(9, 4107, 15, 85, 14, 80, 10),
    action: { type: 'clap', count: 2 }, enter: 'grow' },

  { id: 'p22', text: 'Bigger! Clap three times.', blend: true,
    dots: scatter(9, 4108, 18, 82, 16, 80, 13),
    action: { type: 'clap', count: 3 }, enter: 'grow' },

  { id: 'p23', text: 'Keep it going!', blend: true,
    dots: scatter(9, 4109, 20, 80, 18, 78, 16),
    action: { type: 'clap', count: 1 }, enter: 'grow' },

  { id: 'p24', text: 'Woohoo — a shape party!', blend: true,
    dots: scatter(7, 4110, 22, 78, 20, 76, 20),
    action: { type: 'clap', count: 1 }, enter: 'grow' },

  { id: 'p25', text: 'So much noise!\nTap the little white star to settle down.',
    dots: [{ c: 'p', shape: 'circle', x: 50, y: 50, r: 40 }, { c: 'o', shape: 'triangle', x: 84, y: 26, r: 16 }, { c: 'g', shape: 'square', x: 16, y: 74, r: 16 }, { c: 'w', shape: 'star', x: 56, y: 46, r: 6 }],
    action: { type: 'tapWhite' }, enter: 'grow' },

  { id: 'p26', text: 'Phew! That was fun.\nTap to play it all again.',
    dots: [{ c: 'b', shape: 'circle', x: 50, y: 48, r: 9 }],
    action: { type: 'tapDot', restart: true }, enter: 'pop' },
];
