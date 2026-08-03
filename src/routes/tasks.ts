import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { toTask, type TaskRow } from '../types.js';

export const tasksRouter = Router();

// Prepared statements (compiled once, reused per request).
const listStmt = db.prepare('SELECT * FROM tasks ORDER BY id ASC');
const getStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO tasks (title) VALUES (?)');
const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');

/** Parse and validate a route `:id` param, returning null when invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /tasks
 * List all tasks, oldest first.
 */
tasksRouter.get('/', (_req: Request, res: Response) => {
  const rows = listStmt.all() as TaskRow[];
  res.json(rows.map(toTask));
});

/**
 * POST /tasks
 * Create a task from { "title": "..." }.
 */
tasksRouter.post('/', (req: Request, res: Response) => {
  const { title } = req.body ?? {};

  if (typeof title !== 'string' || title.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'Field "title" is required and must be a non-empty string.' });
  }

  const info = insertStmt.run(title.trim());
  const row = getStmt.get(info.lastInsertRowid) as TaskRow;
  res.status(201).json(toTask(row));
});

/**
 * PATCH /tasks/:id
 * Update the title and/or completed state of a task.
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

  const { title, completed } = req.body ?? {};
  const updates: string[] = [];
  const values: (string | number)[] = [];

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

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ error: 'Provide at least one of "title" or "completed" to update.' });
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
