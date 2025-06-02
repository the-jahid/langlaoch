// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import AppError from './utils/AppError';
import { globalErrorHandler } from './middlewares/globalErrorHandler';
import router from './routes/chat.routes';
import agentRouter from './routes/agentRoutes';
import chatSessionRouter from './routes/sessionRoutes';
import chatRouter from './routes/chatRoutes';


const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());


app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from TypeScript + Express! 🚀' });
}
);

app.use('/api/chat', router);
app.use('/api/chat', agentRouter);
app.use('/api/chat', chatSessionRouter);
app.use('/api/chat',  chatRouter);

app.use(globalErrorHandler);


app.listen(PORT, () => {
  console.log(`⚡️ Server ready at http://localhost:${PORT}`);
});
