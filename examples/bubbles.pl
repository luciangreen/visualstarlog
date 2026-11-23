% Bubbles: a small PrologScript program for a slide. Tap to blow a bubble; drag one to move it.
title("Bubbles").
canvas(640, 320, "#eaf6ff").

popup_menu(context, [menu("Colour", [item("Sky", nb_setval(colour, sky)), item("Pink", nb_setval(colour, pink)), item("Gold", nb_setval(colour, gold))]),
                     item("Pop them all", pop_all)]).

on(start) :- nb_setval(colour, sky), nb_setval(held, none-0-0), pointer(hand), say("Tap to blow a bubble; drag one to move it.").
on(down(X, Y)) :- shape_at(X, Y, Id), !, nb_setval(held, Id-X-Y).
on(down(X, Y)) :- nb_getval(colour, C), new_id(bubble, Id), R is 18 + (X + Y) mod 22,
    shape(Id, circle(X, Y, R), [fill(C), stroke(white), width(3)]).
on(drag(X, Y)) :- nb_getval(held, Id-X0-Y0), Id \== none, DX is X - X0, DY is Y - Y0, move(Id, DX, DY), nb_setval(held, Id-X-Y).
on(up(_, _)) :- nb_setval(held, none-0-0).
pop_all :- shapes(All), forall(member(B, All), delete(B)), say("Pop!").
