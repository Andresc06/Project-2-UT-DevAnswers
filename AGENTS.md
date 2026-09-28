# devanswers-backend

Node.js/Express + MongoDB (Mongoose) REST API for a Q&A app (questions, answers, tags, votes). ESM module (`"type": "module"` in [package.json](package.json)).

**This is a graded course project.** [src/routes/questions.js](src/routes/questions.js), [src/routes/answers.js](src/routes/answers.js), [src/controllers/questionController.js](src/controllers/questionController.js), [src/controllers/answerController.js](src/controllers/answerController.js), and [src/services/questionService.js](src/services/questionService.js) are student-implemented placeholders (bodies are `//Your Code Here`). Use the fully implemented tag/auth flow as the reference pattern when filling these in.

## Architecture

Strict layering: **route → controller → service → model**. Don't skip layers (e.g. no DB calls in controllers).

- Routes ([src/routes](src/routes)): endpoint + middleware wiring only.
- Controllers ([src/controllers](src/controllers)): parse req, call one service function, shape the response — no business logic.
- Services ([src/services](src/services)): business logic, Mongoose queries, throw `createAppError` on failure.
- Models ([src/models](src/models)): Mongoose schemas.

Reference implementation to copy the pattern from: [src/routes/tags.js](src/routes/tags.js) → [src/controllers/tagController.js](src/controllers/tagController.js) → [src/services/tagService.js](src/services/tagService.js).

Naming: service functions are suffixed `...Service` (e.g. `getAllTagsService`), files/functions are camelCase, models are PascalCase singular nouns.

## Conventions

**Response shape** — every controller returns this exact envelope:
```js
res.status(200).json({ success: true, message: 'Tags fetched successfully', data: tagsWithCount });
```

**Errors** — never throw plain `Error` or send error responses manually. Use `createAppError(message, statusCode)` from [src/utils/createAppError.js](src/utils/createAppError.js); it's caught by the global [errorHandler](src/middleware/errorHandler.js) which returns `{ success: false, message, stack? }` (stack only when `NODE_ENV=development`).

**Auth** — JWT bearer tokens. Protect a route by adding the `authenticate` middleware from [src/middleware/authHandler.js](src/middleware/authHandler.js), which sets `req.user = { id, isAdmin }`. See [src/routes/auth.js](src/routes/auth.js) / [src/controllers/authController.js](src/controllers/authController.js) for register/login and token issuance (`JWT_SECRET`, `JWT_EXPIRATION` env vars).

**Voting** — upvote/downvote logic on questions and answers is generic; reuse `handleVote()` in [src/services/voteService.js](src/services/voteService.js) instead of writing new vote logic.

## Running & testing

- `npm start` / `npm run dev` (nodemon) — boot flow is [main.js](main.js) (loads env) → [db.js](db.js) `connectToDB()` → [server.js](server.js) listens, app assembled in [src/app.js](src/app.js).
- Requires a `.env` (see [.env.example](.env.example)): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRATION`, `NODE_ENV`.
- `npm test` runs Vitest ([vitest.config.js](vitest.config.js)) against `tests/**/*.test.js` using `mongodb-memory-server` (no real DB needed) — setup/teardown lives in [tests/setup.js](tests/setup.js). Run a single file with `npm test -- tests/<file>.test.js`. Note `fileParallelism: false` — tests share one in-memory DB instance, so avoid assumptions of isolation between files.
- `npm run populate` seeds a real `MONGODB_URI` with sample data via [src/scripts/populate-db.js](src/scripts/populate-db.js) + [src/scripts/seed-data.js](src/scripts/seed-data.js) (clears the DB first — don't run against a DB you care about).
