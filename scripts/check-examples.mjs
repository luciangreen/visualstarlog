// Runs the example presentations in SWI-Prolog with the Starlog library (STARLOG_DIR) and
// checks what comes back: the slides as data, the standalone HTML, and the plain Prolog.
// Also runs a presentation written by Visual Starlog itself (toStarlog).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newPresentation, parseRuntime, toStarlog } from '../lib/present.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STARLOG = path.resolve(process.env.STARLOG_DIR ?? path.join(ROOT, '..', 'Starlog'));
const RUNTIME = path.join(ROOT, 'prolog', 'vs_runtime.pl');
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };
const run = (mode, file, ...more) => {
  try { return execFileSync('swipl', ['-q', '-g', 'vs_main', '-s', RUNTIME, '--', mode, STARLOG, file, ...more], { encoding: 'utf8', timeout: 60000 }); }
  catch (err) { console.log(`--- ${mode} ${file} failed:\n${err.stdout ?? ''}\n${err.stderr ?? ''}`); return ''; }
};
const ex = (f) => path.join(ROOT, 'examples', f);
const find = (deck, n) => deck?.slides.find((s) => s.n === n);

// hello: Starlog text and list joins, a method chain, the character
const hello = parseRuntime(run('json', ex('hello.pl')));
check(hello?.title === 'Hello from Starlog', 'hello: the title');
check(find(hello, 1)?.items[0]?.text === 'Hello World', 'hello: Greeting is "Hello" : " " : "World" gives Hello World');
check(find(hello, 1)?.items[2]?.kind === 'character', 'hello: the character speaks on slide 1');
check(find(hello, 2)?.items[0]?.text === 'There are 3 of us.', 'hello: Names is [..] & [..], Count is Names >> length');
check(JSON.stringify(find(hello, 2)?.items[1]?.items) === '["Ann","Ben","Cal"]', 'hello: the joined list as bullets');

// maths: run items show the goal, its Prolog and the answer
const maths = parseRuntime(run('json', ex('maths.pl')));
check(find(maths, 1)?.items[0]?.text === 'Twelve weeks of four lessons: 48', 'maths: a number joined to text');
const runs = find(maths, 2)?.items ?? [];
check(runs[0]?.answers?.[0] === 'L = [1,2,3,4]' && /append/.test(runs[0]?.prolog), `maths: L is [1,2] & [3,4] gives L = [1,2,3,4], shown in Prolog as append (${runs[0]?.prolog})`);
check(runs[1]?.answers?.[0] === 'R = [3,2,1]', 'maths: R is reverse([1,2,3])');
check(runs[2]?.answers?.[0] === 'N = 3', 'maths: N is reverse([1,2,3]) >> length');
check(find(maths, 1)?.items[1]?.answers?.[0] === 'X = 14', 'maths: X is 2 + 3 * 4');
const bad = find(maths, 3)?.items ?? [];
check(bad[0]?.ok === false && bad[0]?.answers?.[0] === 'false', 'maths: a failing goal says false');
check(bad[1]?.ok === false && /syntax/i.test(bad[1]?.answers?.[0] ?? '') && !/^error\(/.test(bad[1]?.answers?.[0] ?? ''), `maths: a goal that cannot be read says why, in words (${bad[1]?.answers?.[0]})`);

// office: a Writer document, a Counter table, an Etcher drawing, a missing file
const office = parseRuntime(run('json', ex('office.pl')));
const doc = find(office, 1)?.items[0];
check(doc?.kind === 'doc' && doc.title === 'Course plan' && doc.app === 'writer', 'office: the Writer document and its title');
check(JSON.stringify(doc?.blocks?.map((b) => b.text)) === JSON.stringify(['Ten minutes a day', 'Each lesson is short & practical.', 'music: connect it to breathing']), 'office: its blocks, without the hidden description or deleted lines');
check(JSON.stringify(find(office, 2)?.items[0]?.rows) === JSON.stringify([['Item', 'Price'], ['Lesson', '15'], ['Course', '1,200']]), 'office: the Counter table');
check(find(office, 2)?.items[1]?.app === 'counter', 'office: a button to open Counter');
check(/^<svg/.test(find(office, 3)?.items[0]?.svg ?? ''), 'office: the Etcher drawing');
check(find(office, 4)?.items[0]?.kind === 'error', 'office: a missing document is shown as a mistake on its slide, not a crash');

// the standalone HTML presentation
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-'));
const htmlFile = path.join(tmp, 'hello.html');
const said = run('html', ex('hello.pl'), htmlFile);
const html = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf8') : '';
check(/Wrote .* \(2 slides\)/.test(said), 'html: written');
check(html.includes('<h2>Hello World</h2>') && (html.match(/<section>/g) ?? []).length === 2, 'html: two slides, with the computed heading');
check(html.includes('&quot;') || !html.includes('"Hello'), 'html: text is escaped');

// Starlog to plain Prolog, with Starlog's own converter
const pl = run('prolog', ex('hello.pl'));
check(/string_concat/.test(pl) && /append/.test(pl), 'prolog: the presentation in plain Prolog (string_concat, append)');

// a presentation written by Visual Starlog itself
const gen = path.join(tmp, 'generated.pl');
fs.writeFileSync(gen, toStarlog(newPresentation('Made by Visual Starlog')));
const g = parseRuntime(run('json', gen));
check(g?.title === 'Made by Visual Starlog' && find(g, 2)?.items[0]?.text === '3 people, 48 lessons.', `generated: {Count} and {Total} filled in by Starlog (${find(g, 2)?.items[0]?.text})`);
check(find(g, 2)?.items[1]?.answers?.[0] === 'Greeting = "Hello World"', `generated: the run item's answer (${find(g, 2)?.items[1]?.answers?.[0]})`);

console.log(failures ? `${failures} failure(s)` : 'The Starlog examples run.');
process.exit(failures ? 1 : 0);
