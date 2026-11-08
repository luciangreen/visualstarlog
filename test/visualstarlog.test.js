import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, addSlide, draftSlides, goalsOf, moveItem, newPresentation, pString, parseRuntime, safeSVG, slideHTML, textExpr, toStarlog } from '../lib/present.js';
import { newVSDoc, presOf, slideIndex, vsCommands } from '../lib/commands.js';

test('text with {Name} becomes a Starlog join; text without stays a string', () => {
  assert.deepEqual(textExpr('We have {Total} students'), { expr: '"We have " : Total : " students"', vars: ['Total'] });
  assert.deepEqual(textExpr('{Count}'), { expr: '"" : Count', vars: ['Count'] });
  assert.deepEqual(textExpr('No {lowercase} names, "quotes" \\ kept'), { expr: '"No {lowercase} names, \\"quotes\\" \\\\ kept"', vars: [] });
  assert.equal(pString('two\nlines'), '"two\\nlines"');
  assert.deepEqual(goalsOf('Total is 12 * 4,\nNames is ["Ann"] & ["Ben"].\n'), ['Total is 12 * 4', 'Names is ["Ann"] & ["Ben"]']);
});

test('the presentation is written as Prolog with Starlog syntax, facts where it can and rules where it must', () => {
  const pl = toStarlog(newPresentation('Our course'));
  assert.match(pl, /^% Made with Visual Starlog/);
  assert.match(pl, /\ntitle\("Our course"\)\.\n/);
  assert.match(pl, /slide\(1, "Welcome", \[text\("A presentation written in Prolog, with Starlog\."\),\n        character\("Hello! Press the right arrow to go on\."\)\]\)\./);
  assert.match(pl, /slide\(2, "Starlog does the sums", Items\) :-\n    Total is 12 \* 4,\n    Names is \["Ann"\] & \["Ben", "Cal"\],\n    Count is Names >> length,\n    T1 is Count : " people, " : Total : " lessons\.",\n    Items = \[text\(T1\),\n        run\("Greeting is \\"Hello\\" : \\" \\" : \\"World\\""\)\]\./);
  const p = addItem(addSlide(newPresentation(), 'Files'), 2, { kind: 'doc', path: 'plan.writer.json' });
  assert.match(toStarlog(addItem(p, 2, { kind: 'bullets', items: ['one', 'Total: {Total}'] })), /slide\(3, "Files", Items\) :-\n    T1 is "Total: " : Total,\n    Items = \[doc\("plan\.writer\.json"\),\n        bullets\(\["one", T1\]\)\]\./);
});

test('slides show as HTML, safely, before running and from the runtime', () => {
  const drafts = draftSlides(newPresentation());
  assert.match(slideHTML(drafts[1]), /<p>\{Count\} people, \{Total\} lessons\.<\/p>/);
  assert.match(slideHTML(drafts[1]), /run the presentation to see the answer/);
  const deck = parseRuntime('% noise\n{"title":"T","slides":[{"n":1,"title":"A <b>","items":[{"kind":"run","starlog":"L is [1]&[2]","prolog":"append([1],[2],A)","answers":["L = [1,2]"],"ok":true},{"kind":"table","rows":[["a","b"],["1","2"]]},{"kind":"svg","svg":"<svg onload=\\"x()\\"><script>bad()</script><a href=\\"javascript:x\\">k</a></svg>"},{"kind":"character","text":"Hi \\"you\\""}]}]}');
  const html = slideHTML(deck.slides[0]);
  assert.match(html, /^<h1>A &lt;b&gt;<\/h1>/);
  assert.match(html, /<pre class="starlog">L is \[1\]&amp;\[2\]<\/pre><pre class="prolog"><span>in Prolog<\/span>\nappend\(\[1\],\[2\],A\)<\/pre><p class="ans">L = \[1,2\]<\/p>/);
  assert.match(html, /<table><tr><th>a<\/th><th>b<\/th><\/tr><tr><td>1<\/td><td>2<\/td><\/tr><\/table>/);
  assert.ok(!/onload|<script|javascript:/.test(html), 'scripts and handlers are taken out of drawings');
  assert.match(html, /data-say="Hi &quot;you&quot;"/);
  assert.equal(safeSVG('<svg><circle onclick="x()" r="1"/></svg>'), '<svg><circle r="1"/></svg>');
  assert.equal(parseRuntime('nothing'), null);
  assert.deepEqual(moveItem(newPresentation(), 0, 1, 0).slides[0].items.map((i) => i.kind), ['character', 'text']);
});

test('the character builds the presentation and moves between slides, and changes can be undone', async () => {
  let doc = newVSDoc(newPresentation('Course'));
  let current = 0; let presenting = false;
  const ctx = { current: () => current, go: (i) => { current = i; }, present: () => { presenting = true; } };
  const cmds = vsCommands();
  const say = async (text) => { const r = await cmds.perform(text, doc, { ctx }); assert.ok(r.matched, `understood "${text}"`); doc = r.doc; return r.say; };
  assert.equal(slideIndex(presOf(doc), 'the second slide'), 1);
  assert.equal(slideIndex(presOf(doc), 'slide 9'), -1);
  assert.match(await say('add a slide called Prices'), /Added slide 3, Prices/);
  assert.match(await say('add a point to slide 3: lessons are $15'), /slide 3/);
  await say('add a point to the last slide: courses are $49');
  assert.deepEqual(presOf(doc).slides[2].items, [{ kind: 'bullets', items: ['lessons are $15', 'courses are $49'] }]);
  assert.match(await say('say on slide 3: here are the prices'), /I'll say: here are the prices/);
  assert.match(await say('add a goal to slide 3: Total is 15 * 4'), /show Total is 15 \* 4, in Prolog, and its answer/);
  assert.match(await say('go to slide 3'), /Slide 3: Prices/);
  assert.equal(current, 2);
  assert.match(await say('previous slide'), /Slide 2/);
  assert.match(await say('set the title to Our course'), /called Our course/);
  assert.equal(doc.title, 'Our course');
  await say('present');
  assert.ok(presenting);
  assert.match(await say('delete slide 3'), /Deleted slide 3/);
  assert.equal(presOf(doc).slides.length, 2);
  await say('undo that');
  assert.equal(presOf(doc).slides.length, 3);
  assert.match(await say('go to slide 7'), /There's no slide 7/);
});
