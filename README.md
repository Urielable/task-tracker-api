# Task Tracker API

A small, self-contained REST API for tracking tasks, built with **Node.js + TypeScript**, **Express**, and **better-sqlite3** (a synchronous, file-based SQLite driver). It runs locally with zero external services — no Docker, no Postgres, no Redis.

---

## Why this repository exists

This repository is a **live coding interview exercise**. Its purpose is to evaluate a candidate's **agentic engineering skills** — how effectively you work *with* AI coding agents (Claude Code, Cursor, Codex, Claude.ai, ChatGPT, etc.), not how fast you type from memory.

You are **encouraged to use AI coding agents freely.** We are specifically looking at:

- **Problem framing & decomposition** — how you break a multi-step ticket into a clear plan.
- **Steering the agent** — the quality of your prompts and how you iterate when output isn't right.
- **Verification habits** — how carefully you check generated code *and* the resulting database state, rather than trusting output blindly.
- **Ownership of the deliverable** — whether you can ship a clean, reviewable pull request.

The starting code is intentionally simple. The interesting part is the **ticket** (below) and how you drive it to completion.

---

## Prerequisites

- **Node.js 20+** (developed and tested on Node 22)
- **npm** (ships with Node)

That's it. The SQLite database is a local file that is created and initialized automatically on first run.

---

## Installation & Running

```bash
git clone <your-fork-url>
cd task-tracker-api
npm install
npm run dev
```

The API will be available at **http://localhost:3000**.

On startup the app:
- creates the `data/` directory and `data/tasks.db` if they don't exist,
- applies `schema.sql` (idempotent — safe on every start),
- seeds a few sample tasks **only if** the table is empty.

### Verify it works

```bash
# Health check
curl http://localhost:3000/health

# List all tasks (returns the seeded sample data)
curl http://localhost:3000/tasks

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Write the pull request description"}'

# Update a task (title and/or completed)
curl -X PATCH http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Delete a task
curl -X DELETE http://localhost:3000/tasks/1
```

### Available scripts

| Script          | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Start in watch mode with `tsx` (auto-reload). |
| `npm start`     | Start once with `tsx` (no watch).             |
| `npm run build` | Type-check and compile to `dist/` with `tsc`. |

### Current API (starting point)

| Method   | Path          | Description                              |
| -------- | ------------- | ---------------------------------------- |
| `GET`    | `/health`     | Liveness check.                          |
| `GET`    | `/tasks`      | List all tasks.                          |
| `POST`   | `/tasks`      | Create a task from `{ "title": "..." }`. |
| `PATCH`  | `/tasks/:id`  | Update `title` and/or `completed`.       |
| `DELETE` | `/tasks/:id`  | Delete a task.                           |

---

## The Interview Challenge (the ticket)

Complete the steps below **in order**. You are encouraged to use any AI coding agent (Claude Code, Cursor, Codex, etc.).

> ### Ticket — Evolve the Task Tracker
>
> Please make the following changes.
>
> **1. Add two new fields to tasks:**
> - `priority`: `'low' | 'medium' | 'high'` (default `'medium'`)
> - `due_date`: optional ISO date string
>
> Update the schema, types, and all existing endpoints accordingly.
>
> **2. Extend `GET /tasks` so it supports filtering:**
> - `?completed=true` or `?completed=false`
> - `?priority=low|medium|high`
>
> Filters can be combined.
>
> **3. Add a new endpoint `POST /tasks/bulk-complete`** that accepts `{ "ids": number[] }` and marks all those tasks as completed. Return how many were updated.
>
> **4. Add proper input validation** (Zod is recommended) for the create, update, and bulk-complete endpoints. Return clear `400` responses on invalid input.
>
> **5. Add at least two automated tests** covering the new filtering behavior and the bulk-complete endpoint.
>
> **6. Update this README** with the new endpoints and example curl commands.

### Final step

When you are finished, **open a pull request against the `main` branch.** The PR description must clearly explain:

- **What was changed**
- **How to verify the changes** (including any new endpoints and test commands)
- **Any trade-offs or decisions you made**

---

## Evaluation criteria

Interviewers are looking for:

- **Problem framing** — a clear plan that decomposes the ticket into ordered, verifiable steps.
- **Prompt quality** — effective, specific instructions to the AI agent, and good iteration when the first output falls short.
- **Verification habits** — checking both the code and the actual database/API behavior (not just trusting generated code).
- **Code quality** — clean types, sensible error handling, correct HTTP status codes, no dead TODOs.
- **Testing** — meaningful tests that actually exercise the new behavior.
- **Ownership of the final PR** — a clear, honest description covering what changed, how to verify, and trade-offs.
