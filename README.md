# Visual Starlog

Visual Starlog makes **presentations written in Prolog**, with [Starlog](https://github.com/luciangreen/Starlog) syntax. It is part of [Lucian Office](https://github.com/luciangreen/lucianoffice), inside [LucianOS](https://github.com/luciangreen/lucianos).

Build slides visually, and Visual Starlog writes them as a Starlog file. It runs the file in SWI-Prolog with your Starlog library and shows the slides, which can hold:

- text, headings, quotes and bullet points;
- values worked out by the slide's own goals;
- **Prolog goals**, each shown in Starlog, in plain Prolog and with its answer;
- **Lucian Office documents** (Writer), **tables** (Counter's CSV) and **drawings** (Etcher's SVG);
- pictures;
- buttons that **open LucianOS apps**;
- lines the **RetroMR character** says when the slide is shown.

## Starlog in a slide

Starlog writes `Result is function(Args)`:

- `"a" : "b"` joins text;
- `[1] & [2]` joins lists;
- `L >> length` chains.

A slide's goals run first. In its text, `{Name}` shows a variable:

```prolog
slide(2, "Starlog does the sums", Items) :-
    Total is 12 * 4,
    Names is ["Ann"] & ["Ben", "Cal"],
    Count is Names >> length,
    T1 is Count : " people, " : Total : " lessons.",
    Items = [text(T1), run("Greeting is \"Hello\" : \" \" : \"World\"")].
```

That is what Visual Starlog writes for the text "{Count} people, {Total} lessons." The slide shows "3 people, 48 lessons.", then the goal, its Prolog (`string_concat("Hello"," ",A),string_concat(A,"World",B)`) and its answer, `Greeting = "Hello World"`.

You can also write presentations by hand: `title(Text).` and `slide(N, Title, Items)` facts or rules. See `examples/`.

Items:

- `text(T)`, `heading(T)`, `quote(T)`, `bullets([T, ...])`;
- `run(GoalText)`;
- `doc(Path)` (a `.writer.json` or any Lucian Office document);
- `csv(Path)`, `svg(Path)`, `image(Path)`;
- `character(T)`, `open(App)`.

Paths are relative to the presentation's folder. A slide whose goals fail, or whose file is missing, shows the mistake on that slide; the rest still run.

## Using it

- **Run** writes `presentation.pl` (Starlog) into the presentation's folder (`Documents/Visual Starlog/<title>/`). It runs the file with `prolog/vs_runtime.pl` as a LucianOS job, then shows the slides as run.
- **Present** goes full screen. Use the arrow keys or space (Escape stops); the character speaks each slide's lines, and buttons open apps.
- **Starlog** and **Prolog** tabs show the presentation both ways. The plain Prolog comes from Starlog's own converter.
- **Export**: the Starlog file, a **standalone HTML presentation** (written by Prolog; opens in any browser, arrow keys or tap to move), or the plain Prolog.
- **Settings**: where your Starlog folder is (`Dropbox/GitHub-private2/Starlog` unless you change it).
- **Tell Lucian**: "add a slide called Prices", "add a point to slide 2: ten minutes a day", "add text to slide 1: welcome", "say on slide 2: here are the prices", "add a goal to slide 2: X is [1] & [2]", "set the title to Our course", "go to slide 3", "next slide", "previous slide", "delete slide 3", "present", "undo that".

The runtime can also be used on its own:

```sh
swipl -q -g vs_main -s prolog/vs_runtime.pl -- json   STARLOG_DIR presentation.pl
swipl -q -g vs_main -s prolog/vs_runtime.pl -- html   STARLOG_DIR presentation.pl presentation.html
swipl -q -g vs_main -s prolog/vs_runtime.pl -- prolog STARLOG_DIR presentation.pl
```

## Install

From your `lucianos` folder:

```sh
git clone https://github.com/luciangreen/lucianoffice apps/lucianoffice
git clone https://github.com/luciangreen/visualstarlog apps/visualstarlog
```

It needs SWI-Prolog and your Starlog folder.

## Tests

```sh
npm test                                              # unit tests
STARLOG_DIR=../Starlog npm run check-examples          # the examples in SWI-Prolog with Starlog
```

`check-examples` (run by GitHub Actions with real SWI-Prolog and Starlog) runs `examples/` and checks:

- text and list joins, method chains, and numbers joined to text;
- goals with their Prolog and answers, including a failing goal and one that cannot be read (said in words);
- a Writer document (without hidden or deleted lines), a Counter table, an Etcher drawing, and a missing file shown as a mistake;
- the HTML presentation and the plain Prolog;
- a presentation written by Visual Starlog itself, with its `{Name}` values filled in by Starlog.

## Later

Controlling the computer through LucianOS from a presentation.
