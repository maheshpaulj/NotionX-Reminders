// src/index.ts
import 'dotenv/config'; // Load environment variables
import express, { Request, Response } from 'express';
import { checkAndSendReminders } from './jobs/checkReminders';

const app = express();
const PORT = process.env.PORT || 8080;

// Simple health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// The secured endpoint for the cron job to call
app.post('/run-check', async (req: Request, res: Response) => {
  // 1. Secure the endpoint
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await checkAndSendReminders();
    return res.status(200).json(result);
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    // Return a generic error
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Reminder service listening on port ${PORT}`);
});