// The functions whose inputs and outputs are recorded in io/ios.txt (see io/engine.mjs).
import { newPresentation, textExpr, goalsOf, toStarlog, parseRuntime, draftSlides, addSlide, pString } from '../lib/present.js';

export const title = 'Visual Starlog';

const PROLOG = [
  'greeting(Name, S) :- string_concat("Hello, ", Name, S).',
  'double(X, Y) :- Y is X * 2.\nsquare(X, Y) :- Y is X * X.',
  'main :- writeln(hello).',
  'reverse_words(S, R) :- split_string(S, " ", "", W), reverse(W, V), atomic_list_concat(V, " ", R).',
  'fact(0, 1) :- !.\nfact(N, F) :- N1 is N - 1, fact(N1, F1), F is N * F1.',
  ''
];

export const cases = [
  { name: 'textExpr', run: textExpr, make: (rnd) => [rnd.pick([rnd.sentence(), `Total: {${rnd.pick(['X', 'Total', 'N'])}}`, `"Quoted" ${rnd.words(1, 3)}`, `{A} and {B}`, `back\\slash ${rnd.words(1, 2)}`])] },
  { name: 'pString', run: pString, make: (rnd) => [rnd.words(1, 4) + rnd.pick(['', ' "x"', ' \\ ', '\n'])] },
  { name: 'goalsOf', run: goalsOf, make: (rnd) => [rnd.pick(PROLOG)] },
  { name: 'toStarlog', run: (title, slides) => { let p = newPresentation(title); for (const s of slides) p = addSlide(p, s); return toStarlog(p); }, make: (rnd) => [rnd.words(1, 3), Array.from({ length: rnd.int(1, 3) }, () => ({ kind: rnd.pick(['title', 'text', 'list', 'result']), title: rnd.words(1, 3), text: rnd.sentence(), items: [rnd.words(1, 2), rnd.words(1, 2)], goal: rnd.pick(['double(3, Y)', 'greeting("Lucian", S)', '']) }))] },
  { name: 'parseRuntime', run: parseRuntime, make: (rnd) => [rnd.pick([`{"slides":[{"title":"${rnd.words(1, 2)}","text":"${rnd.words(1, 3)}"}]}`, `{"error":"${rnd.words(2, 4)}"}`, 'not json', `junk before\n{"slides":[]}`, ''])] },
  { name: 'draftSlides', run: (title, prolog) => draftSlides({ ...newPresentation(title), prolog }).map(({ id, ...s }) => s), make: (rnd) => [rnd.words(1, 3), rnd.pick(PROLOG)] }
];
