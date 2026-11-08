% Lucian Office documents on slides: a Writer document, a Counter table, an Etcher drawing.
title("Our course").

slide(1, "The plan (from Writer)", [doc("plan.writer.json"), character("This came straight from Writer.")]).
slide(2, "Prices (from Counter)", [csv("prices.csv"), open("counter")]).
slide(3, "How it works (from Etcher)", [svg("flow.svg")]).
slide(4, "A slide with a mistake", [doc("missing.json")]).
