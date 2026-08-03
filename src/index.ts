import express, { type Request, type Response } from 'express';
import './db.js'; // Import for its side effect: open DB, apply schema, seed.
import tasksRouter from './routes/tasks.js';

const PORT = 3000;

const app = express();

app.use(express.json());

// Simple liveness check.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Task CRUD endpoints.
app.use('/tasks', tasksRouter);

app.listen(PORT, () => {
  console.log('✅ Database initialized at data/tasks.db');
  console.log(`🚀 Task Tracker API running at http://localhost:${PORT}`);
});
