import dotenv from 'dotenv';
dotenv.config();

import { processExpiryReminders } from './src/jobs/expiryRemindersJob.js';

async function run() {
  console.log("Triggering subscription expiry reminders check on the live database...");
  await processExpiryReminders();
  console.log("Done!");
  process.exit(0);
}

run();
