% A presentation with a PrologScript program in a slide: the program runs in the slide,
% with the PrologScript plug-in. Tap, drag, and right-click (or hold a finger down) on it.
title("Programs that draw").

slide(1, "Prolog in place of JavaScript", Items) :-
    Items = [text("PrologScript turns Prolog commands into menus, painting, shapes and pointers."),
             bullets(["on(down(X, Y)) answers a tap", "paint(dot(X, Y)) paints", "shape(Id, circle(X, Y, R)) draws a shape that stays"])].

slide(2, "Try it", Items) :-
    Items = [prologscript("bubbles.pl"),
             character("Tap the picture to blow bubbles. Right-click for colours.")].
