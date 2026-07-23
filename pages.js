/* Page data for "Boop!" — an original interactive shape playground.
 * Coordinates are percentages of the stage. r = radius (% of the smaller screen side).
 * Colors: r red, y yellow, b blue, g green, p purple, o orange, k pink, w white.
 * Shapes: circle (default), triangle, square, star, heart.
 *
 * Actions:
 *   tapDot {target?, restart?}   - tap a shape (target = only this index advances; others wiggle)
 *   tapCount {target, count}     - tap a shape N times; a copy pops out each tap
 *   tapAll {color?}              - tap every shape (of a colour) to clear them
 *   rub {target}                 - rub a shape
 *   hold {target, ms}            - press and hold a shape until it grows
 *   countQuiz {answer, max, match} - count the matching shapes, tap the number on the pad
 *   tiltLeft | tiltRight | shake | upright | blow | clap {count}
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
const SHAPES = ['circle', 'triangle', 'square', 'star', 'heart'];

// scattered mix of colours and shapes (for the shake / tilt / blow / clap scenes)
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

const PAGES = [
  { id: 'cover', kind: 'cover' },

  { id: 'ready', kind: 'intro', text: 'Ready to play?\nTap the star!',
    dots: [{ c: 'b', shape: 'star', x: 50, y: 47, r: 11 }],
    action: { type: 'tapDot' }, enter: 'pop' },

  // ---- Find #1 (easy): the blue circle ----
  { id: 'find1', text: 'Find the blue circle\nand give it a boop!',
    dots: [
      { c: 'b', shape: 'circle', x: 32, y: 32, r: 9 },   // 0 = target
      { c: 'r', shape: 'circle', x: 70, y: 27, r: 9 },
      { c: 'b', shape: 'triangle', x: 74, y: 62, r: 9 },
      { c: 'g', shape: 'square', x: 25, y: 63, r: 9 },
      { c: 'y', shape: 'star', x: 50, y: 47, r: 9 },
      { c: 'b', shape: 'square', x: 49, y: 72, r: 8 },
    ],
    action: { type: 'tapDot', target: 0 }, enter: 'pop' },

  // ---- Count & tap: make 3 ----
  { id: 'count3', text: 'Tap the purple circle three times —\nwatch three friends pop out!',
    dots: [{ c: 'p', shape: 'circle', x: 50, y: 44, r: 11 }],
    action: { type: 'tapCount', target: 0, count: 3 }, enter: 'pop' },

  // ---- Pop all the yellow ----
  { id: 'popyellow', text: 'Pop ALL the yellow shapes!',
    dots: [
      { c: 'y', shape: 'circle', x: 22, y: 30, r: 9 },
      { c: 'y', shape: 'triangle', x: 78, y: 32, r: 9 },
      { c: 'y', shape: 'star', x: 50, y: 66, r: 9 },
      { c: 'r', shape: 'square', x: 30, y: 62, r: 9 },
      { c: 'b', shape: 'circle', x: 72, y: 64, r: 9 },
      { c: 'g', shape: 'heart', x: 50, y: 26, r: 9 },
    ],
    action: { type: 'tapAll', color: 'y' }, enter: 'grow' },

  // ---- Count quiz #1: how many red? ----
  { id: 'quizred', text: 'How many RED shapes?\nTap the number.',
    dots: [
      { c: 'r', shape: 'circle', x: 24, y: 28, r: 9 },
      { c: 'r', shape: 'triangle', x: 54, y: 30, r: 9 },
      { c: 'r', shape: 'star', x: 78, y: 58, r: 9 },
      { c: 'b', shape: 'square', x: 30, y: 62, r: 9 },
      { c: 'g', shape: 'circle', x: 72, y: 26, r: 9 },
      { c: 'y', shape: 'heart', x: 50, y: 66, r: 9 },
    ],
    action: { type: 'countQuiz', answer: 3, max: 5, match: { c: 'r' } }, enter: 'pop' },

  // ---- Rub clean ----
  { id: 'rub', text: 'This one rolled in the mud!\nRub it until it shines.',
    dots: [{ c: 'o', shape: 'circle', x: 50, y: 44, r: 13 }],
    action: { type: 'rub', target: 0 }, enter: 'pop' },

  // ---- Press & hold to grow ----
  { id: 'hold', text: 'Press and hold the balloon —\npuff it up bigger and BIGGER!',
    dots: [{ c: 'r', shape: 'circle', x: 50, y: 46, r: 8 }],
    action: { type: 'hold', target: 0, ms: 900 }, enter: 'pop' },

  // ---- Find #2 (medium): the one blue heart ----
  { id: 'find2', text: 'So many shapes!\nFind the ONE blue heart.',
    dots: [
      { c: 'b', shape: 'heart', x: 50, y: 30, r: 9 },    // 0 = target
      { c: 'r', shape: 'heart', x: 24, y: 26, r: 9 },
      { c: 'p', shape: 'heart', x: 76, y: 28, r: 9 },
      { c: 'y', shape: 'heart', x: 30, y: 62, r: 9 },
      { c: 'g', shape: 'heart', x: 70, y: 62, r: 9 },
      { c: 'b', shape: 'circle', x: 50, y: 64, r: 9 },
      { c: 'b', shape: 'triangle', x: 15, y: 46, r: 9 },
      { c: 'b', shape: 'square', x: 85, y: 48, r: 9 },
    ],
    action: { type: 'tapDot', target: 0 }, enter: 'pop' },

  // ---- Count quiz #2: how many blue hearts? ----
  { id: 'quizhearts', text: 'How many BLUE hearts?\nTap the number.',
    dots: [
      { c: 'b', shape: 'heart', x: 26, y: 28, r: 9 },
      { c: 'b', shape: 'heart', x: 72, y: 60, r: 9 },
      { c: 'r', shape: 'heart', x: 50, y: 24, r: 9 },
      { c: 'g', shape: 'heart', x: 78, y: 30, r: 9 },
      { c: 'b', shape: 'circle', x: 24, y: 60, r: 9 },
      { c: 'b', shape: 'square', x: 52, y: 62, r: 9 },
      { c: 'p', shape: 'heart', x: 16, y: 45, r: 9 },
    ],
    action: { type: 'countQuiz', answer: 2, max: 5, match: { c: 'b', shape: 'heart' } }, enter: 'pop' },

  // ---- Tilt ----
  { id: 'tilt', text: 'Tip the screen to the LEFT —\nwhee, they slide!',
    dots: scatter(14, 5201, 12, 88, 14, 74, 8),
    action: { type: 'tiltLeft' }, enter: 'jitter' },

  // ---- Shake ----
  { id: 'shake', text: 'Now give it a big SHAKE\nto jumble them up!',
    dots: scatter(14, 5202, 10, 90, 12, 78, 8),
    action: { type: 'shake' }, enter: 'slideL' },

  // ---- Count & tap: make 4 ----
  { id: 'count4', text: 'Tap the green square four times\nto build a tower of four!',
    dots: [{ c: 'g', shape: 'square', x: 50, y: 44, r: 11 }],
    action: { type: 'tapCount', target: 0, count: 4 }, enter: 'pop' },

  // ---- Find #3 (hard): the green star ----
  { id: 'find3', text: 'Trickier!\nWhere is the green star?',
    dots: [
      { c: 'g', shape: 'star', x: 50, y: 44, r: 8 },     // 0 = target
      { c: 'r', shape: 'star', x: 22, y: 24, r: 8 },
      { c: 'b', shape: 'star', x: 78, y: 24, r: 8 },
      { c: 'y', shape: 'star', x: 50, y: 22, r: 8 },
      { c: 'g', shape: 'circle', x: 24, y: 58, r: 8 },
      { c: 'g', shape: 'triangle', x: 76, y: 58, r: 8 },
      { c: 'g', shape: 'square', x: 15, y: 41, r: 8 },
      { c: 'p', shape: 'star', x: 85, y: 42, r: 8 },
      { c: 'o', shape: 'star', x: 50, y: 66, r: 8 },
    ],
    action: { type: 'tapDot', target: 0 }, enter: 'pop' },

  // ---- Count quiz #3: how many stars? ----
  { id: 'quizstars', text: 'How many STARS can you count?\nTap the number.',
    dots: [
      { c: 'r', shape: 'star', x: 22, y: 26, r: 8 },
      { c: 'b', shape: 'star', x: 52, y: 24, r: 8 },
      { c: 'g', shape: 'star', x: 80, y: 30, r: 8 },
      { c: 'p', shape: 'star', x: 34, y: 60, r: 8 },
      { c: 'y', shape: 'circle', x: 66, y: 60, r: 8 },
      { c: 'o', shape: 'square', x: 50, y: 46, r: 8 },
      { c: 'k', shape: 'heart', x: 16, y: 46, r: 8 },
    ],
    action: { type: 'countQuiz', answer: 4, max: 6, match: { shape: 'star' } }, enter: 'pop' },

  // ---- Blow (used sparingly) ----
  { id: 'blow', text: 'Take a big breath…\nand BLOW!',
    dots: scatter(12, 5203, 14, 86, 14, 74, 8),
    action: { type: 'blow' }, enter: 'jitter' },

  // ---- Clap (used sparingly) ----
  { id: 'clap', text: 'Clap once to start the parade!',
    dots: scatter(10, 5204, 16, 84, 16, 76, 10),
    action: { type: 'clap', count: 1 }, enter: 'drop' },

  // ---- Find #4 (hardest): the orange square ----
  { id: 'find4', text: 'Last one —\nfind the orange square!',
    dots: [
      { c: 'o', shape: 'square', x: 50, y: 44, r: 8 },   // 0 = target
      { c: 'o', shape: 'circle', x: 24, y: 26, r: 8 },
      { c: 'o', shape: 'triangle', x: 76, y: 26, r: 8 },
      { c: 'o', shape: 'star', x: 50, y: 22, r: 8 },
      { c: 'r', shape: 'square', x: 26, y: 60, r: 8 },
      { c: 'b', shape: 'square', x: 74, y: 60, r: 8 },
      { c: 'g', shape: 'square', x: 16, y: 44, r: 8 },
      { c: 'p', shape: 'heart', x: 84, y: 44, r: 8 },
      { c: 'y', shape: 'circle', x: 50, y: 66, r: 8 },
    ],
    action: { type: 'tapDot', target: 0 }, enter: 'pop' },

  // ---- Finale ----
  { id: 'finale', text: 'Hooray, you did it!\nTap the heart to play again.',
    dots: [{ c: 'k', shape: 'heart', x: 50, y: 46, r: 12 }],
    action: { type: 'tapDot', restart: true }, enter: 'pop' },
];
