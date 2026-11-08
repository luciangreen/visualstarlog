% Starlog goals shown on slides: each run(...) item shows the goal, its plain Prolog and the answer.
title("Sums and lists").

slide(1, "Arithmetic", Items) :-
    Lessons is 12 * 4,
    Text is "Twelve weeks of four lessons: " : Lessons,
    Items = [text(Text), run("X is 2 + 3 * 4")].

slide(2, "Lists", [
    run("L is [1, 2] & [3, 4]"),
    run("R is reverse([1, 2, 3])"),
    run("N is reverse([1, 2, 3]) >> length")
]).

slide(3, "When a goal fails or is wrong", [
    run("1 =:= 2"),
    run("X is foo(")
]).
