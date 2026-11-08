% Hello, in Starlog: "a":"b" joins text.
title("Hello from Starlog").

slide(1, "Hello", Items) :-
    Greeting is "Hello" : " " : "World",
    Items = [heading(Greeting), text("Written in Prolog with Starlog syntax."), character("Hello! I'm the RetroMR character.")].

slide(2, "Who is here", Items) :-
    Names is ["Ann", "Ben"] & ["Cal"],
    Count is Names >> length,
    Line is "There are " : Count : " of us.",
    Items = [text(Line), bullets(Names)].
