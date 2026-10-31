# UniMCP

MCP server that gives an agent access to the systems of Argentine universities: the virtual classroom (Moodle) and SIU Guaraní. It runs locally over STDIO (`npx unimcp`) or hosted and multi-user over HTTP with OAuth. For something new, copy how `src/aula-virtual/` is built.

## Module layout

```
src/
  index.ts          CLI: picks STDIO, --http or `login`
  login.ts          `unimcp login`: choose the campus, then each platform's login
  http-server.ts    HTTP entry point
  oauth/            authorization server of the HTTP mode: aula login, tokens, access policy
  mcp-server.ts     createServer(platforms): registers the tools of the platforms the campus has
  shared/           what serves more than one platform (campus registry, credentials, http, html, documents, logger, paths, input)
  <platform>/       aula-virtual/ (Moodle web service), guarani/ (SIU Guaraní 3 autogestión, G3W)
    tools.ts        MCP tool registration
    client/         talks to the platform: session, login, requests, types of its responses
    format/         builds what the model sees, using the client
    login.ts        that platform's part of `unimcp login`
```

Each layer has a single job and dependencies go in one direction only: `tools.ts` → `format/` → `client/` → `shared/`.

- **`tools.ts`** exports `register<Platform>Tools(server, session, ...)`. Each tool is a name, a description, a zod schema and a call into `format/`. Logic goes in the other layers.
- **`client/`** knows the platform and nothing else: it doesn't import from MCP or know a model exists. It exposes thin functions over the platform and in `types.ts` types only the fields we use.
- **`format/`** decides what the model sees and how much it costs: navigation addresses, truncation, dates, text budgets, pagination.
- Platforms don't import from each other. Whatever they share goes in `shared/`.
- To add a platform: create the folder with this shape, add its site to `Campus` in `shared/campus.ts` and one line to `mcp-server.ts`.

## Campuses

`shared/campus.ts` is the registry: a campus is a faculty (or a whole university) with an optional `aula` (Moodle base URL and, if it logs in through Keycloak, `ssoHost`) and an optional `guarani` (G3W base URL, usually one per university and shared by its faculties). Only the platforms a campus has get registered.

The site is never a global or a module-level constant: it travels with the session (`session.site`), because in HTTP mode each user can be on a different campus. Locally the campus comes from `UNI_CAMPUS`, the `campus.json` written by `login`, or the custom env vars (`UNI_AULA_BASE_URL`, `UNI_GUARANI_URL`). In HTTP mode it's stored with the user, and the token verifier puts it in `authInfo.extra.campus`.

Before adding a Moodle, check `tool_mobile_get_public_config` returns `enablemobilewebservice: 1`; `identityproviders` means an SSO.

## Session and multi-user

The server serves many students at once, so authentication state is never global. Every function that touches a platform receives the user's session as its first parameter (`AulaSession`, `GuaraniSession`), and `createServer` receives them from outside. Store users are keyed by `(campus, username)`.

Requests to the aula go through `callWs`, which keeps at most 6 in flight per session and retries a 429 (and a 503 on reads) honoring `Retry-After`. A web service function that changes something is called with `WRITE`: it is never retried when it may have been done, and when the response didn't arrive (timeout, a dropped connection, a 5xx) it fails with `UncertainWriteError`, which says to check the aula before retrying. `test/writes.test.ts` lists every write. Reading leaves no trace in the aula: never call functions that log activity or change state while reading (`*_view_*`, marking messages as read, starting a quiz attempt), because the teacher sees "viewed" in the reports and activities can be marked complete. `test/read-effects.test.ts` fails if a client function has one of those names, or if one without a read name (`_get_`, `_can_`) is called without `WRITE`.

The user's token never leaves the server. The model and the user get URLs that open with the browser session (`userFacingUrl`). Before sending the token or the cookies to a URL that came from the model, validate that it belongs to the user's platform (`downloadUrl` in the aula, `pageUrl` in Guaraní).

## SIU Guaraní

- G3W has no API. Each page arrives as pagelets, `kernel.renderer.on_arrival({op, info: {id}, content})`, with the HTML inside a JSON (`parsePagelets`).
- Login is the form at `<base>/acceso?auth=form` (`usuario`, `password`). A rejected login, or an expired session, shows the `#guarani_form_login` form again; the rejection reason is in `#error_login`.
- The session is a cookie that expires in minutes, so renewing means logging in again with the password. That's why Guaraní is local-only for now: the hosted mode doesn't store passwords.
- Menus and operation names change between universities and versions, so the tools are generic navigation (`guarani_menu`, `guarani_open`) rather than one tool per hard-coded operation. Pages under `acceso` (login, logout) are never opened, except `acceso/cambiar_carrera`, which switches the active career: history, plan and enrollments belong to it.
- Some versions send the menu and the career selector in the page HTML, not as a pagelet (`G3wPage.shell`). Pages are decoded with the charset of `content-type` (UNJu sends ISO-8859-1).
- A page with a filter form (`#form_filtros`, the academic history) arrives without data: it's requested again with every checkbox on.
- The academic history is parsed into `historia` (`format/history.ts`): each `.catedra` is a record with the subject in its `h4` ("NAME (CODE)") and "<strong>tipo</strong> - nota resultado fecha" in its `span`, grouped by subject. A record that doesn't have that shape keeps its `texto`, is counted in `registrosSinParsear` and logged with its digits masked; a page without `.catedra` (or a history over the budget) falls back to text. `vencida` is computed on the server against `fechaConsulta`, the Argentine day (`argentinaDay` in `shared/dates.ts`), which tests inject.
- The commission offer is parsed into `oferta` (`format/offer.ts`): periods (`.js-recuadro_periodo`) → subjects (`.js-recuadro_actividad[actividad]`) → commissions (`table.comision`), with the `<strong>Label:</strong>` fields mapped to names and the rest in `otros`, and values G3W hasn't defined yet ("Sin definir") left out. If it doesn't fit, it comes as an `indice` of subjects. `guarani_open`'s `materia` filters both the history and the offer (`format/subjects.ts`: code, or whole words and prefixes of the name).
- Page text drops what isn't content (`NOISE` in `format/page.ts`: form controls, `.btn`, `.modal`, `.alert`, which goes in `avisos`), and `enlaces` are collected after that. A button with an `href` is an action, not a page ("Enviar por mail" sends the receipt), so it never reaches the model.
- HTML is parsed with cheerio, which uses parse5 by default: G3W leaves tags unclosed and only a spec-compliant parser recovers them (see `docs/research/limpieza-html-para-llm.md`). `htmlToText` (`shared/html.ts`) is shared with the aula; options that only Guaraní needs go through its `TextOptions`.
- It's read-only. Signing up for courses or exams needs to observe the real forms first.

## Tool design

- **Names**: `<platform>_<action>` in snake_case (`aula_open`, `guarani_menu`).
- **Descriptions**: in Spanish and written for the model. They say when to use the tool, where each parameter comes from (another response, another tool) and which response fields are useful to continue. Every zod `.describe()` includes a concrete example ("Ej: …"); `test/descriptions.test.ts` fails if a parameter, nested ones included, lacks it. It also fails if a description names, in backticks, a field that no code outside `tools.ts` produces: a renamed field leaves the description promising something that never arrives.
- **Stateless navigation**: each response carries the `direccion` of what's inside (and the `padre` in the aula). The model navigates by passing addresses back; it never has to build them.
- **Summarized indexes, detail on open**: a listing shows just enough to decide whether to go in (`htmlToSnippet`) and the full content is shown when the item is opened.
- **Per-response budget**: anything that can be long is cut with a budget and says how to continue (`siguiente`, `hayMasDiscusiones`, `recortado`). Whenever something was cut, the response says so with `recortado: true` and, where it isn't obvious, an `aviso` saying what's missing and how to reach it. An aula course over 30,000 characters (`BUDGET_CHARS`) goes through three modes: labels in full, labels summarized (with `aviso`), then an index of sections, cut by sections into `seccionesOmitidas` if even that doesn't fit. A section goes labels in full, labels summarized, then its last modules into `modulosOmitidos`, each with its `direccion`. Omitted lists name the first 20 and count the rest (`otrosOmitidos`, `otrasOmitidas`), with room reserved in the budget so the list never pushes the response over it.
- **Third-party text is data**: forum posts, labels, files and Guaraní pages are written by anyone, and one that gives orders is a prompt injection. The server sends `INSTRUCTIONS` (`mcp-server.ts`) on initialize; tools that return that text end their description with `THIRD_PARTY_TEXT`, and tools that write include `ON_REQUEST` (used only when the user asked). `test/injection.test.ts` fails if a new tool leaves them out, if a read tool isn't classified (`THIRD_PARTY_TOOLS` or `OWN_TEXT_TOOLS`, with the reason) or if a tool doesn't declare its annotations (`readOnlyHint`, plus `destructiveHint` and `idempotentHint` for writes). On top of that, `UNIMCP_WRITE_TOOLS` (`shared/write-policy.ts`) decides which write tools exist: unset, all over STDIO and none over HTTP. `createServer` registers through a filter, so a tool that doesn't declare `readOnlyHint: true` counts as a write and is left out unless allowed; a tool that only serves a write tool (`aula_assign_upload_link`) is registered only if that one was.
- **Other people's data** (#17): third-party text tools (the aula's in `THIRD_PARTY_TOOLS`) return their response through `withoutOthersData` (`format/privacy.ts` → `shared/privacy.ts`), which walks every string except addresses and URLs. A run of lines with a DNI, an email or (in table rows) a legajo, or a table under a student header, becomes "[Lista de N personas…: figurás / no figurás]", matched by the user's name and username from site_info; two table rows are enough (the UNJu drop list had two). Loose DNI, emails and phones of others become `[DNI]`, `[email]`, `[teléfono]`, except the user's own, institutional (`.edu.ar`) or contact emails, and numbers after "ID de reunión", "código" and the like. Loose names stay. `UNI_SHOW_THIRD_PARTY_DATA=1` turns it off, locally only. Images inside files can't be filtered.
- **Two-step writes**: `aula_assign_submit` and `aula_send_message` write only with the `confirmacion` of a preview (`shared/confirmation.ts`): the first call changes nothing and shows what is added, kept and removed, or who gets the message and their role in the courses you share. The code is an HMAC of a fingerprint (who, what and, for a submission, its current state), so it is void for anything else, and it works once: used codes are remembered in the process until they expire, not in the session (in HTTP every request has a new session). A message only goes to someone who shares a course with the user, up to `MAX_MESSAGE_CHARS`, and never with the privacy placeholders (`[DNI]`, `[Lista de N personas…]`), which give away pasted tool output. It does not prove a person saw the preview; the client's approval and `UNIMCP_WRITE_TOOLS` do that part.
- **Prompts** (`<platform>/prompts.ts`): recipes that chain existing tools ("plan de la semana") instead of a tool that reasons for the model. They're registered on the real server, not through the write-policy filter, and `test/prompts.test.ts` checks that every tool a prompt names exists.
- **Progress**: tools that go through every course (`aula_search`, `aula_list_grades`, `aula_list_updates`) take a `Progress` (`shared/progress.ts`) and wait with `tracked`, which reports each finished task; the handler passes `progressOf(ctx)`, which is undefined unless the client sent a `progressToken`. With several stages, later ones continue the count (`start`), because MCP requires progress to only grow.
- **Responses**: compact JSON via `json()` and errors via `failure()`. Every handler is `try { return json(...) } catch (e) { return failure(e) }`.
- **Rich text**: `htmlToText` writes headings as `#`, list items as `- ` and tables row by row with " | ", header included. Tables are laid out as a full grid first (`colspan`, `rowspan`), so each value stays in its column: a multi-row header (from `thead`, all-`th` rows, or a first row that groups columns and has cells spanning down, as teachers build with `td`) becomes one row with a name per column ("2da Clase · Lugar"); in data rows a `rowspan` value repeats on every row and a `colspan` cell appears once. A nested table stays inside its cell, rows separated by " / ", and headings inside cells lose their `#`. In the aula, full texts (summaries, labels, posts, feedback) go through `richText`, which also shows each link as "texto (url)" and each iframe as its URL: teachers write "LINK" and the class address is in the `href`. Snippets for indexes stay plain.
- **URLs shown to the model** go through `safeUrl` (`shared/html.ts`): absolute, http(s) or mailto only, with credential parameters removed (`token`, `wstoken`, `sesskey`…), and YouTube videos shortened to `https://youtu.be/ID`. Aula URLs also go through `userFacingUrl`. URLs that aren't links (file URLs, Guaraní addresses, URLs pasted as text) go through `withoutCredentials`. `test/credentials.test.ts` fails if any output carries a credential: when you add a response that shows a URL, add it there.

## Code conventions

- **Response fields** in Spanish and camelCase (`ultimoAcceso`, `nombreCorto`). An empty field is omitted with `|| undefined`, so it takes no space in the JSON. Dates are ISO 8601 in Argentine time, `-03:00` (`isoDate`), never UTC: a post from the night would show up as the next day.
- **Identifier language**: all code identifiers are in English: variables, functions, types, constants and file names. In `client/` they follow the platform's vocabulary (`courseId`, `cmid`). What the model sees stays in Spanish: response fields, tool parameters and string values (`direccion`, `ultimoAcceso`). When an object's keys reach the model, they stay in Spanish even inside internal code (`FileRead`, `Campus`).
- **Text for people and for the model** (comments, errors, descriptions, logs) in Rioplatense Spanish with voseo: "corré `unimcp login`", "No tenés acceso al módulo".
- **Actionable errors**: the message says what to do next. Our own errors are classes with a `name` (`MoodleError`, `LoginRequiredError`, `GuaraniLoginRequiredError`).
- **Comments**: one-line JSDoc, or a little more, explaining the why or a platform fact. Constants state their unit or their origin.
- **Logs**: always through `logger` from `shared/logger.ts`. It writes to stderr because stdout is the protocol's STDIO channel. Logs never carry the aula username (it can be the DNI) or an email: log the store id of a linked account, or `masked(...)` otherwise; `test/logs.test.ts` fails if a log interpolates `username` or `email`.
- **Env vars**: `UNI_*` for the user's campus and credentials, `UNIMCP_*` for the server (HTTP, store, keys).
- **Imports**: ESM with the `.js` extension (`./client/client.js`), because of `module: Node16`.
- **Moodle token**: the flow is described as the "launch.php flow" or "web service token". The `moodle_mobile_app` identifier stays as is, because it's the service's real name.
- **pdf.js**: loaded from `vendor/pdfjs/` (generated by `scripts/vendor-pdfjs.mjs`). `pdfjs-dist` is a devDependency and is imported for types only.

## Agent skills

Skills live in `.agents/skills/` (installed with `npx skills add`, pinned in `skills-lock.json`): `mcp-builder` (from `anthropics/skills`) has the MCP best practices and the evaluation harness, so read it before designing or reviewing tools; `archify` draws diagrams into `.archify/` (untracked); the rest come from `mattpocock/skills`. Claude Code only looks in `.claude/skills/`, so each skill there is a local, untracked link to its folder in `.agents/skills/`. After cloning, recreate them:

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null; Get-ChildItem .agents\skills -Directory | ForEach-Object { New-Item -ItemType Junction -Path ".claude\skills\$($_.Name)" -Target $_.FullName }   # Windows
```
```bash
mkdir -p .claude/skills && for s in .agents/skills/*/; do n=$(basename "$s"); ln -s "../../.agents/skills/$n" ".claude/skills/$n"; done   # Linux/macOS
```

`evals/` holds the evaluation: `run_eval.py` wraps the mcp-builder harness, and the questions (`*.xml`) and reports stay untracked because they contain the student's data.

### Issue tracker

Issues and specs live in GitHub Issues of HyNuwa/UniMCP, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Verify and publish

- Verify with `npx tsc --noEmit` and `npm test`, and try it against a real campus with `npm run dev` (requires `npm run login` once). Tests (`test/*.test.ts`, `node:test` through tsx) use made-up Moodle and G3W responses with a mocked `fetch`, never real student data.
- CI (`.github/workflows/ci.yml`) runs `tsc --noEmit` and `npm test` on every push to master and every PR. Every workflow declares its `permissions`, the least it needs (`test/workflows.test.ts`), and Dependabot (`.github/dependabot.yml`) opens a weekly PR per ecosystem. `vendor/` is generated before `build` and `dev`, never in `prepare` or `postinstall`, which would also run on the user's machine.
- The regression evaluation for the aula's rich text and search is `evals/unju-links-tablas.xml` (untracked): run it after touching `htmlToText`, `richText`, `safeUrl` or `aula_search`.
- When you add or change a tool, update the tools table in `README.md`; when you add a campus, its table too.
- `unimcp check` (`src/check.ts`, plus `check.ts` in each platform) tests the local campus and prints a summary for the "Probé mi universidad" issue, with no personal data (no username, name or courses; error messages go through `withoutIds`). For the aula it maps each tool to the web service functions it needs (`TOOL_FUNCTIONS`, with `partial` for the ones only some cases need): `test/check.test.ts` fails if a tool or a client function is missing from it.
- The Claude Desktop extension (`.mcpb`) is built by `npm run mcpb` (`scripts/pack-mcpb.mjs`) from `mcpb/manifest.json`; its version, campus list and tools are filled in from `package.json` and the compiled code. The extension passes the user's settings as `UNI_*` env vars and sets `UNIMCP_MCPB`, so login hints point to the extension settings (`loginHint`). `.github/workflows/release.yml` attaches it to every GitHub release.
- The version lives in `package.json` (the server and the `User-Agent` read it through `shared/version.ts`) and is repeated in `server.json`, which `test/registry.test.ts` keeps in sync.
- `server.json` describes UniMCP for the official MCP registry. `.github/workflows/registry.yml` publishes it on every release with GitHub OIDC, after waiting for that version on npm: `npm publish` goes first, and the registry checks the package through `mcpName` in `package.json`.
- The project is MIT. `LICENSE` also keeps the ISC notice of utn-mcp, the code it derives from: its license requires it in every copy, so never remove it.
