import dotenv from 'dotenv';
dotenv.config();

import prisma from './src/config/prisma.js';
import { processExpiryReminders } from './src/jobs/expiryRemindersJob.js';

async function runTest() {
  console.log("🚀 Starting Subscription Expiry Reminder System Test...");

  // 1. Find or create a test tenant
  let tenant = await prisma.tenant.findFirst({
    where: { email: 'test-expiry@example.com' }
  });

  if (!tenant) {
    console.log("📝 Creating a test tenant...");
    tenant = await prisma.tenant.create({
      data: {
        email: 'test-expiry@example.com',
        tenantName: 'Test Expiry Co',
        status: 'APPROVED',
        isActive: true,
        onboardingCompleted: true,
        subscriptionStatus: 'active',
        currentPlan: 'Pro Plan'
      }
    });
  }

  // Helper to reset reminders
  const resetReminders = async () => {
    await prisma.subscriptionReminder.deleteMany({
      where: { tenantId: tenant.id }
    });
  };

  const checkReminderCount = async (type) => {
    return await prisma.subscriptionReminder.count({
      where: {
        tenantId: tenant.id,
        reminderType: type
      }
    });
  };

  try {
    console.log(`\n--- Test 1: 15 Days Before ---`);
    await resetReminders();
    const date15 = new Date();
    date15.setDate(date15.getDate() + 15);
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
        planPeriodEnd: date15
      }
    });
    
    console.log("Running job (should send 15-day reminder)...");
    await processExpiryReminders();
    
    let count = await checkReminderCount('15_days_before');
    console.log(`Reminder logged in DB: ${count === 1 ? '✅ Yes' : '❌ No'}`);

    console.log("\nRunning job again (should NOT send duplicate 15-day reminder)...");
    await processExpiryReminders();
    count = await checkReminderCount('15_days_before');
    console.log(`Reminder record count is still 1: ${count === 1 ? '✅ Yes' : '❌ No'}`);


    console.log(`\n--- Test 2: 7 Days Before ---`);
    await resetReminders();
    const date7 = new Date();
    date7.setDate(date7.getDate() + 7);
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
        planPeriodEnd: date7
      }
    });
    
    console.log("Running job (should send 7-day reminder)...");
    await processExpiryReminders();
    
    count = await checkReminderCount('7_days_before');
    console.log(`Reminder logged in DB: ${count === 1 ? '✅ Yes' : '❌ No'}`);


    console.log(`\n--- Test 3: 3 Days Before ---`);
    await resetReminders();
    const date3 = new Date();
    date3.setDate(date3.getDate() + 3);
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
        planPeriodEnd: date3
      }
    });
    
    console.log("Running job (should send 3-day reminder)...");
    await processExpiryReminders();
    
    count = await checkReminderCount('3_days_before');
    console.log(`Reminder logged in DB: ${count === 1 ? '✅ Yes' : '❌ No'}`);


    console.log(`\n--- Test 4: 1 Day Before ---`);
    await resetReminders();
    const date1 = new Date();
    date1.setDate(date1.getDate() + 1);
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
        planPeriodEnd: date1
      }
    });
    
    console.log("Running job (should send 1-day reminder)...");
    await processExpiryReminders();
    
    count = await checkReminderCount('1_day_before');
    console.log(`Reminder logged in DB: ${count === 1 ? '✅ Yes' : '❌ No'}`);


    console.log(`\n--- Test 5: Expiration Day ---`);
    await resetReminders();
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expired yesterday
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
        planPeriodEnd: expiredDate
      }
    });
    
    console.log("Running job (should expire subscription and send email)...");
    await processExpiryReminders();
    
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id }
    });
    console.log(`Tenant status updated to expired: ${updatedTenant.subscriptionStatus === 'expired' ? '✅ Yes' : '❌ No'}`);
    console.log(`Data deletion date set (+90 days): ${updatedTenant.dataDeletionDate ? '✅ ' + updatedTenant.dataDeletionDate.toLocaleDateString() : '❌ No'}`);
    
    count = await checkReminderCount('expired');
    console.log(`Expired log entry created in DB: ${count === 1 ? '✅ Yes' : '❌ No'}`);

  } catch (err) {
    console.error("❌ Test failed with error:", err);
  } finally {
    // Cleanup test data
    console.log("\n🧹 Cleaning up test data...");
    await resetReminders();
    await prisma.tenant.delete({
      where: { id: tenant.id }
    });
    console.log("✨ Test finished successfully!");
    process.exit(0);
  }
}

runTest();
