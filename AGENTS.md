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

The user's token never leaves the server. The model and the user get URLs that open with the browser session (`userFacingUrl`). Before sending the token or the cookies to a URL that came from the model, validate that it belongs to the user's platform (`downloadUrl` in the aula, `pageUrl` in Guaraní).

## SIU Guaraní

- G3W has no API. Each page arrives as pagelets, `kernel.renderer.on_arrival({op, info: {id}, content})`, with the HTML inside a JSON (`parsePagelets`).
- Login is the form at `<base>/acceso?auth=form` (`usuario`, `password`). A rejected login, or an expired session, shows the `#guarani_form_login` form again; the rejection reason is in `#error_login`.
- The session is a cookie that expires in minutes, so renewing means logging in again with the password. That's why Guaraní is local-only for now: the hosted mode doesn't store passwords.
- Menus and operation names change between universities and versions, so the tools are generic navigation (`guarani_menu`, `guarani_open`) rather than one tool per hard-coded operation. Pages under `acceso` (login, logout) are never opened, except `acceso/cambiar_carrera`, which switches the active career: history, plan and enrollments belong to it.
- Some versions send the menu and the career selector in the page HTML, not as a pagelet (`G3wPage.shell`). Pages are decoded with the charset of `content-type` (UNJu sends ISO-8859-1).
- A page with a filter form (`#form_filtros`, the academic history) arrives without data: it's requested again with every checkbox on.
- It's read-only. Signing up for courses or exams needs to observe the real forms first.

## Tool design

- **Names**: `<platform>_<action>` in snake_case (`aula_open`, `guarani_menu`).
- **Descriptions**: in Spanish and written for the model. They say when to use the tool, where each parameter comes from (another response, another tool) and which response fields are useful to continue. Every zod `.describe()` includes a concrete example.
- **Stateless navigation**: each response carries the `direccion` of what's inside (and the `padre` in the aula). The model navigates by passing addresses back; it never has to build them.
- **Summarized indexes, detail on open**: a listing shows just enough to decide whether to go in (`htmlToSnippet`) and the full content is shown when the item is opened.
- **Per-response budget**: anything that can be long is cut with a budget and says how to continue (`siguiente`, `hayMasDiscusiones`, `recortado`).
- **Responses**: compact JSON via `json()` and errors via `failure()`. Every handler is `try { return json(...) } catch (e) { return failure(e) }`.

## Code conventions

- **Response fields** in Spanish and camelCase (`ultimoAcceso`, `nombreCorto`). An empty field is omitted with `|| undefined`, so it takes no space in the JSON. Dates are ISO 8601 in Argentine time, `-03:00` (`isoDate`), never UTC: a post from the night would show up as the next day.
- **Identifier language**: all code identifiers are in English: variables, functions, types, constants and file names. In `client/` they follow the platform's vocabulary (`courseId`, `cmid`). What the model sees stays in Spanish: response fields, tool parameters and string values (`direccion`, `ultimoAcceso`). When an object's keys reach the model, they stay in Spanish even inside internal code (`FileRead`, `Campus`).
- **Text for people and for the model** (comments, errors, descriptions, logs) in Rioplatense Spanish with voseo: "corré `unimcp login`", "No tenés acceso al módulo".
- **Actionable errors**: the message says what to do next. Our own errors are classes with a `name` (`MoodleError`, `LoginRequiredError`, `GuaraniLoginRequiredError`).
- **Comments**: one-line JSDoc, or a little more, explaining the why or a platform fact. Constants state their unit or their origin.
- **Logs**: always through `logger` from `shared/logger.ts`. It writes to stderr because stdout is the protocol's STDIO channel.
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

- There are no tests. Verify with `npx tsc --noEmit` and try it against a real campus with `npm run dev` (requires `npm run login` once).
- When you add or change a tool, update the tools table in `README.md`; when you add a campus, its table too.
- The version lives in two places: `package.json` and the `version` in `src/mcp-server.ts`. They are bumped together.
- The project is MIT. `LICENSE` also keeps the ISC notice of utn-mcp, the code it derives from: its license requires it in every copy, so never remove it.
