import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import {
  PRIORITIES,
  toTask,
  type IsoDateString,
  type Priority,
  type TaskRow,
} from '../types.js';

export const tasksRouter = Router();

// Prepared statements (compiled once, reused per request).
const getStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
const insertStmt = db.prepare(
  'INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)',
);
const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');

/** Parse and validate a route `:id` param, returning null when invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

/**
 * Accepts `YYYY-MM-DD` or a full ISO 8601 datetime with an explicit offset
 * (`Z` or `±HH:MM`); a datetime without an offset would be parsed in the
 * server's local timezone, so it is rejected.
 */
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Parse an ISO date string into its canonical UTC form, or null when invalid.
 * Impossible calendar dates (e.g. 2026-02-30) are rejected rather than rolled over.
 */
function toIsoDateString(value: unknown): IsoDateString | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const calendarDay = new Date(Date.UTC(+year, +month - 1, +day));
  if (calendarDay.getUTCMonth() !== +month - 1 || calendarDay.getUTCDate() !== +day) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const PRIORITY_ERROR = `Field "priority" must be one of: ${PRIORITIES.join(', ')}.`;
const DUE_DATE_ERROR =
  'Field "due_date" must be an ISO 8601 date string (e.g. "2026-12-31" or "2026-12-31T17:00:00Z") or null.';

/**
 * GET /tasks
 * List tasks, oldest first. Optional filters, combinable with AND:
 *   ?completed=true|false
 *   ?priority=low|medium|high
 */
tasksRouter.get('/', (req: Request, res: Response) => {
  const { completed, priority } = req.query;
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (completed !== undefined) {
    if (completed !== 'true' && completed !== 'false') {
      return res
        .status(400)
        .json({ error: 'Query param "completed" must be "true" or "false".' });
    }
    conditions.push('completed = ?');
    values.push(completed === 'true' ? 1 : 0);
  }

  if (priority !== undefined) {
    if (!isPriority(priority)) {
      return res
        .status(400)
        .json({ error: `Query param "priority" must be one of: ${PRIORITIES.join(', ')}.` });
    }
    conditions.push('priority = ?');
    values.push(priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY id ASC`)
    .all(...values) as TaskRow[];
  res.json(rows.map(toTask));
});

/**
 * POST /tasks
 * Create a task from { "title": "...", "priority"?: "...", "due_date"?: "<ISO 8601>" }.
 * `due_date` is stored normalized to UTC (`toISOString()` form).
 */
tasksRouter.post('/', (req: Request, res: Response) => {
  const { title, priority = 'medium', due_date = null } = req.body ?? {};

  if (typeof title !== 'string' || title.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'Field "title" is required and must be a non-empty string.' });
  }

  if (!isPriority(priority)) {
    return res.status(400).json({ error: PRIORITY_ERROR });
  }

  const dueDate = due_date === null ? null : toIsoDateString(due_date);
  if (due_date !== null && dueDate === null) {
    return res.status(400).json({ error: DUE_DATE_ERROR });
  }

  const info = insertStmt.run(title.trim(), priority, dueDate);
  const row = getStmt.get(info.lastInsertRowid) as TaskRow;
  res.status(201).json(toTask(row));
});

/**
 * PATCH /tasks/:id
 * Partially update a task's title, completed, priority and/or due_date.
 * Sending `"due_date": null` clears the due date.
 */
tasksRouter.patch('/:id', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Invalid task id.' });
  }

  const existing = getStmt.get(id) as TaskRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: `Task ${id} not found.` });
  }

  const { title, completed, priority, due_date } = req.body ?? {};
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res
        .status(400)
        .json({ error: 'Field "title" must be a non-empty string.' });
    }
    updates.push('title = ?');
    values.push(title.trim());
  }

  if (completed !== undefined) {
    if (typeof completed !== 'boolean') {
      return res
        .status(400)
        .json({ error: 'Field "completed" must be a boolean.' });
    }
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }

  if (priority !== undefined) {
    if (!isPriority(priority)) {
      return res.status(400).json({ error: PRIORITY_ERROR });
    }
    updates.push('priority = ?');
    values.push(priority);
  }

  if (due_date !== undefined) {
    const dueDate = due_date === null ? null : toIsoDateString(due_date);
    if (due_date !== null && dueDate === null) {
      return res.status(400).json({ error: DUE_DATE_ERROR });
    }
    updates.push('due_date = ?');
    values.push(dueDate);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: 'Provide at least one of "title", "completed", "priority" or "due_date" to update.',
    });
  }

  values.push(id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const row = getStmt.get(id) as TaskRow;
  res.json(toTask(row));
});

/**
 * DELETE /tasks/:id
 * Remove a task.
 */
tasksRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Invalid task id.' });
  }

  const info = deleteStmt.run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: `Task ${id} not found.` });
  }

  res.status(204).send();
});

export default tasksRouter;
