import 'dotenv/config';
import prisma from '../config/prisma.js';
import { logLeadStatusToSheet } from '../modules/google-sheets/googleSheetsService.js';

async function testConnection() {
  try {
    console.log('🔄 Searching for a tenant with an active Google Sheets connection...');
    
    // 1. Find a connected Google Sheets account in DB
    const connection = await prisma.googleSheetConnection.findFirst({
      where: { status: 'active' },
    });

    if (!connection) {
      console.error('❌ No connected Google Sheet tenant found in DB!');
      console.error('👉 Please log in to your SaaS dashboard and click "Connect Google Sheets" first.');
      process.exit(1);
    }

    console.log(`🚀 Found connected Tenant ID: ${connection.tenantId}`);

    // 2. Test logging a lead row
    const result = await logLeadStatusToSheet(connection.tenantId, {
      contactName: 'Clean Script Test User',
      phone: '+919876543210',
      status: 'Qualified',
      orderId: 'ORD-9999',
      amount: '500.00',
      paymentStatus: 'Paid',
      notes: 'Testing dynamic column reordering cleanly',
    });

    console.log('✅ Result:', result);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testConnection();