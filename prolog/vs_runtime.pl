% Visual Starlog runtime: runs a presentation written in Prolog with Starlog syntax and gives
% its slides as JSON (for the Visual Starlog app in LucianOS), as a standalone HTML
% presentation (Prolog/HTML), or as plain Prolog (Starlog's own converter).
%
%   swipl -q -g vs_main -s vs_runtime.pl -- json  STARLOG_DIR pres.pl
%   swipl -q -g vs_main -s vs_runtime.pl -- html  STARLOG_DIR pres.pl pres.html
%   swipl -q -g vs_main -s vs_runtime.pl -- prolog STARLOG_DIR pres.pl
%
% A presentation is facts or rules:
%   title(Text).
%   slide(Number, Title, Items) :- ...Starlog or Prolog goals...
% Items: text(T), heading(T), quote(T), bullets([T, ...]), run(GoalText) (show a goal in
% Starlog, its plain Prolog, and its answers), doc(Path) (a Lucian Office document),
% csv(Path) (a table, e.g. from Counter), svg(Path) (a drawing, e.g. from Etcher),
% image(Path), character(T) (the RetroMR character says it), open(App) (opens a LucianOS
% app). Paths are relative to the presentation's folder.

:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(csv)).
:- use_module(library(lists)).
:- use_module(library(apply)).

:- dynamic title/1, slide/3.
:- discontiguous title/1, slide/3.

vs_main :-
    current_prolog_flag(argv, Raw),
    ( append(_, ['--'|Args], Raw) -> true ; Args = Raw ),
    catch(vs_run(Args), E, (message_to_codes(E, Msg), format(user_error, "Visual Starlog: ~s~n", [Msg]), halt(1))),
    halt(0).

message_to_codes(E, Codes) :- message_to_codes(E, [], Codes0), !, Codes = Codes0.
message_to_codes(E, _, Codes) :- format(codes(Codes), "~q", [E]).

vs_run([json, Dir, File]) :- !, vs_load(Dir, File), vs_json(File).
vs_run([html, Dir, File, Out]) :- !, vs_load(Dir, File), vs_html(File, Out).
vs_run([prolog, Dir, File]) :- !, vs_load_starlog(Dir), starlog:starlog_to_prolog_file(File).
vs_run(Args) :- throw(error(format("usage: json|html|prolog STARLOG_DIR FILE [OUT], not ~q", [Args]), _)).

% Starlog first, so its goal expansion turns the presentation's Starlog into Prolog as it loads.
vs_load_starlog(Dir) :-
    atomic_list_concat([Dir, '/starlog'], Lib),
    use_module(user:Lib),
    assertz(user:file_search_path(library, Dir)).
vs_load(Dir, File) :-
    vs_load_starlog(Dir),
    retractall(title(_)), retractall(slide(_, _, _)),
    load_files(user:File, [module(user)]).

% ---------------------------------------------------------------- slides as data
vs_slides(File, Slides) :-
    file_directory_name(File, Base),
    findall(N, clause(user:slide(N, _, _), _), Ns0), sort(Ns0, Ns),
    maplist(vs_slide(Base), Ns, Slides).

vs_slide(Base, N, _{n:N, title:T, items:Items}) :-
    (   catch(once(user:slide(N, T0, Items0)), E, (vs_error_text(E, Msg), T0 = "This slide could not run", Items0 = [error(Msg)]))
    ->  true
    ;   T0 = "This slide could not run", Items0 = [error("its goals failed")]
    ),
    vs_string(T0, T),
    ( is_list(Items0) -> true ; Items0 = [Items0] ),
    maplist(vs_item(Base), Items0, Items).

vs_error_text(E, S) :- message_to_codes(E, C), string_codes(S, C).

vs_string(X, S) :- string(X), !, S = X.
vs_string(X, S) :- atom(X), !, atom_string(X, S).
vs_string(X, S) :- number(X), !, number_string(X, S).
vs_string(X, S) :- is_list(X), catch(string_codes(S, X), _, fail), !.
vs_string(X, S) :- format(string(S), "~w", [X]).

vs_path(Base, P, Abs) :- vs_string(P, S), ( sub_atom(S, 0, 1, _, '/') -> Abs = S ; atomic_list_concat([Base, '/', S], Abs) ).

vs_item(_, text(X), _{kind:text, text:S}) :- !, vs_string(X, S).
vs_item(_, heading(X), _{kind:heading, text:S}) :- !, vs_string(X, S).
vs_item(_, quote(X), _{kind:quote, text:S}) :- !, vs_string(X, S).
vs_item(_, bullets(L), _{kind:bullets, items:Ss}) :- !, maplist(vs_string, L, Ss).
vs_item(_, character(X), _{kind:character, text:S}) :- !, vs_string(X, S).
vs_item(_, open(A), _{kind:open, app:S}) :- !, vs_string(A, S).
vs_item(_, image(P), _{kind:image, path:S}) :- !, vs_string(P, S).
vs_item(_, error(M), _{kind:error, text:S}) :- !, vs_string(M, S).
vs_item(_, run(G), Item) :- !, vs_run_item(G, Item).
vs_item(Base, doc(P), Item) :- !, catch(vs_doc(Base, P, Item), E, (vs_error_text(E, M), vs_string(P, PS), Item = _{kind:error, text:M, path:PS})).
vs_item(Base, csv(P), Item) :- !, catch(vs_csv(Base, P, Item), E, (vs_error_text(E, M), Item = _{kind:error, text:M})).
vs_item(Base, svg(P), Item) :- !, catch(vs_svg(Base, P, Item), E, (vs_error_text(E, M), Item = _{kind:error, text:M})).
vs_item(_, X, _{kind:text, text:S}) :- vs_string(X, S).

% run("X is \"Hello\" : \" \" : \"World\""): the goal as written (Starlog), its plain Prolog
% (from Starlog's converter), and the answer it gives.
vs_run_item(G0, _{kind:run, starlog:Src, prolog:Pl, answers:Answers, ok:Ok}) :-
    vs_string(G0, Src),
    catch((term_string(G, Src, [variable_names(Vs)]), Read = ok), E0, Read = err(E0)),
    (   Read == ok
    ->  copy_term(G, G2),
        ( catch(starlog:starlog_to_prolog_code(G2, P), _, fail) -> with_output_to(string(Pl), (numbervars(P, 0, _), print(P))) ; Pl = "" ),
        catch((starlog:starlog_call(G) -> R = yes ; R = no), E, R = err(E)),
        (   R == yes
        ->  Ok = true,
            findall(A, (member(Name=V, Vs), \+ sub_atom(Name, 0, 1, _, '_'), format(string(A), "~w = ~q", [Name, V])), Answers0),
            ( Answers0 == [] -> Answers = ["true"] ; Answers = Answers0 )
        ;   R == no
        ->  Ok = false, Answers = ["false"]
        ;   R = err(E1), vs_error_text(E1, M1), Ok = false, Answers = [M1]
        )
    ;   Read = err(E2), vs_error_text(E2, M2), Pl = "", Ok = false, Answers = [M2]
    ).

% A Lucian Office document (lucianoffice/1 JSON): its title and the text of its blocks.
vs_doc(Base, P, _{kind:doc, path:PS, title:T, app:App, blocks:Blocks}) :-
    vs_path(Base, P, Abs), vs_string(P, PS),
    setup_call_cleanup(open(Abs, read, In, [encoding(utf8)]), json_read_dict(In, D), close(In)),
    ( get_dict(title, D, T0) -> vs_string(T0, T) ; T = "" ),
    ( get_dict(app, D, A0) -> vs_string(A0, App) ; App = "" ),
    ( get_dict(blocks, D, Bs) -> true ; Bs = [] ),
    include([B]>>(get_dict(text, B, X), X \== "", \+ get_dict(deleted, B, true), \+ (get_dict(type, B, Ty), Ty == "description")), Bs, Keep),
    maplist([B, _{type:Ty, text:Tx}]>>(( get_dict(type, B, Ty0) -> vs_string(Ty0, Ty) ; Ty = "paragraph" ), get_dict(text, B, Tx0), vs_string(Tx0, Tx)), Keep, Blocks).

vs_csv(Base, P, _{kind:table, rows:Rows}) :-
    vs_path(Base, P, Abs),
    csv_read_file(Abs, Rs, [convert(false)]),
    maplist([R, Cells]>>(R =.. [_|Cs], maplist(vs_string, Cs, Cells)), Rs, Rows).

vs_svg(Base, P, _{kind:svg, svg:S}) :-
    vs_path(Base, P, Abs),
    read_file_to_string(Abs, S0, [encoding(utf8)]),
    ( sub_string(S0, Before, _, _, "<svg") -> sub_string(S0, Before, _, 0, S) ; throw(error(format("~w is not an SVG drawing", [P]), _)) ).

vs_title(T) :- ( catch(user:title(T0), _, fail) -> vs_string(T0, T) ; T = "Untitled presentation" ).

vs_json(File) :-
    vs_title(T), vs_slides(File, Slides),
    json_write_dict(current_output, _{title:T, slides:Slides}, [width(0)]), nl.

% ---------------------------------------------------------------- a standalone HTML presentation
vs_html(File, Out) :-
    vs_title(T), vs_slides(File, Slides),
    setup_call_cleanup(open(Out, write, S, [encoding(utf8)]), vs_write_html(S, T, Slides), close(S)),
    length(Slides, N), format("Wrote ~w (~d slides)~n", [Out, N]).

esc(X, E) :- vs_string(X, S), split_string(S, "", "", _), string_codes(S, Cs), foldl(esc_c, Cs, [], Rev), reverse(Rev, Out), string_codes(E0, Out), E = E0.
esc_c(0'&, A, B) :- !, append(`;pma&`, A, B).
esc_c(0'<, A, B) :- !, append(`;tl&`, A, B).
esc_c(0'>, A, B) :- !, append(`;tg&`, A, B).
esc_c(0'", A, B) :- !, append(`;touq&`, A, B).
esc_c(C, A, [C|A]).

vs_write_html(S, T, Slides) :-
    esc(T, ET),
    format(S, "<!doctype html>~n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>~w</title>~n<style>~w</style></head><body>~n", [ET, "body{margin:0;font-family:system-ui,sans-serif;background:#1d1f24;color:#222}section{display:none;box-sizing:border-box;min-height:100vh;padding:5vh 7vw;background:#fbfaf6}section.on{display:block}h1{font-size:2.4rem;margin:0 0 .6em}h2{font-size:1.5rem}li{font-size:1.35rem;margin:.3em 0}p{font-size:1.25rem;line-height:1.5}blockquote{font-style:italic;border-left:5px solid #e2a03f;padding-left:1em}pre{background:#f0eee6;padding:.6em .9em;border-radius:6px;overflow-x:auto}.run .ans{color:#1d6b45}.run .bad{color:#a33}.say{display:flex;gap:.8em;align-items:center;margin:1em 0}.say .face{font-size:2.6rem}.say .bubble{background:#fff;border:2px solid #334;border-radius:1em;padding:.5em 1em;font-size:1.2rem}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.3em .7em}.nav{position:fixed;right:1em;bottom:1em;color:#666;font-size:.9rem}.err{color:#a33}"]),
    forall(member(Sl, Slides), vs_write_slide(S, Sl)),
    length(Slides, N),
    format(S, "<div class=\"nav\"><span id=\"at\">1</span> / ~d · ← →</div>~n<script>let i=0;const s=[...document.querySelectorAll('section')];const show=()=>{s.forEach((x,k)=>x.classList.toggle('on',k===i));document.getElementById('at').textContent=i+1};addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')i=Math.min(s.length-1,i+1);if(e.key==='ArrowLeft')i=Math.max(0,i-1);show()});addEventListener('click',e=>{if(e.target.closest('a,button'))return;i=e.clientX>innerWidth/3?Math.min(s.length-1,i+1):Math.max(0,i-1);show()});show();</script>~n</body></html>~n", [N]).

vs_write_slide(S, Sl) :-
    esc(Sl.title, ET),
    format(S, "<section><h1>~w</h1>~n", [ET]),
    forall(member(I, Sl.items), vs_write_item(S, I)),
    format(S, "</section>~n", []).

vs_write_item(S, I) :- get_dict(kind, I, K), vs_item_html(K, I, S), !.
vs_write_item(_, _).
vs_item_html(text, I, S) :- esc(I.text, E), format(S, "<p>~w</p>~n", [E]).
vs_item_html(heading, I, S) :- esc(I.text, E), format(S, "<h2>~w</h2>~n", [E]).
vs_item_html(quote, I, S) :- esc(I.text, E), format(S, "<blockquote>~w</blockquote>~n", [E]).
vs_item_html(error, I, S) :- esc(I.text, E), format(S, "<p class=\"err\">~w</p>~n", [E]).
vs_item_html(bullets, I, S) :- format(S, "<ul>", []), forall(member(X, I.items), (esc(X, E), format(S, "<li>~w</li>", [E]))), format(S, "</ul>~n", []).
vs_item_html(character, I, S) :- esc(I.text, E), format(S, "<div class=\"say\"><span class=\"face\">🙂</span><span class=\"bubble\">~w</span></div>~n", [E]).
vs_item_html(open, I, S) :- esc(I.app, E), format(S, "<p><em>Opens ~w in LucianOS</em></p>~n", [E]).
vs_item_html(image, I, S) :- esc(I.path, E), format(S, "<p><img src=\"~w\" alt=\"\" style=\"max-width:100%\"></p>~n", [E]).
vs_item_html(svg, I, S) :- format(S, "<div>~w</div>~n", [I.svg]).
vs_item_html(run, I, S) :-
    esc(I.starlog, E1), esc(I.prolog, E2),
    format(S, "<div class=\"run\"><pre>~w</pre>", [E1]),
    ( I.prolog \== "" -> format(S, "<pre>% in Prolog~n~w</pre>", [E2]) ; true ),
    ( I.ok == true -> Cls = ans ; Cls = bad ),
    forall(member(A, I.answers), (esc(A, EA), format(S, "<p class=\"~w\">~w</p>", [Cls, EA]))),
    format(S, "</div>~n", []).
vs_item_html(doc, I, S) :-
    esc(I.title, ET), format(S, "<h2>~w</h2>", [ET]),
    forall(member(B, I.blocks), (esc(B.text, E), ( B.type == "heading" -> format(S, "<h3>~w</h3>", [E]) ; B.type == "inspiration" -> format(S, "<blockquote>~w</blockquote>", [E]) ; format(S, "<p>~w</p>", [E]) ))), nl(S).
vs_item_html(table, I, S) :-
    format(S, "<table>", []),
    forall(nth1(K, I.rows, R), ( format(S, "<tr>", []), forall(member(C, R), (esc(C, E), ( K =:= 1 -> format(S, "<th>~w</th>", [E]) ; format(S, "<td>~w</td>", [E]) ))), format(S, "</tr>", []) )),
    format(S, "</table>~n", []).
