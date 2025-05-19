// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import AppError from './utils/AppError';
import { globalErrorHandler } from './middlewares/globalErrorHandler';
import router from './routes/chat.routes';


const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());


app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from TypeScript + Express! 🚀' });
}
);

app.use('/api/chat', router);

// /* ──── 404 handler ────────────────────────────────────────────── */
// app.get('*', (_req: Request, _res: Response, next: NextFunction) => {
//   next(new AppError('Route not found', 404));
// });

/* ──── Global error handler ────────────────────────────────────── */
app.use(globalErrorHandler);

/* ──── Start the server ───────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`⚡️ Server ready at http://localhost:${PORT}`);
});
