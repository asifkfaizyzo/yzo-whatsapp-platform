import { Worker } from 'bullmq';
import { QUEUE_NAME_CALL_MEDIA } from '../queues/callMediaQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { emitToTenant } from '../lib/socket.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Helper to get access token
const getTenantToken = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.whatsappAccessToken) throw new Error('WhatsApp not configured');
  return decrypt(tenant.whatsappAccessToken);
};

export const processCallMediaJob = async (job) => {
  const { type, payload, tenantId } = job.data;
  const token = await getTenantToken(tenantId);
  const wacid = payload.id;

  const mediaObj = type === 'RECORDING' ? payload.audio : payload.document;
  const expectedHash = mediaObj.sha256;
  const url = mediaObj.url;
  
  if (!url) {
     console.warn(`[CallMediaWorker] No URL provided for wacid: ${wacid}`);
     return;
  }

  // 1. Download File
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
     throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // 2. Verify SHA256 Integrity
  const actualHash = crypto.createHash('sha256').update(buffer).digest('base64');
  
  // 3. Save locally
  const saveDir = path.join(process.cwd(), 'uploads', 'calls', tenantId);
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  const ext = type === 'RECORDING' ? '.ogg' : '.json';
  const filename = `${wacid}_${type}${ext}`;
  const localPath = path.join(saveDir, filename);

  fs.writeFileSync(localPath, buffer);
  
  const publicUrl = process.env.BASE_URL && process.env.BASE_URL.startsWith('http') && !process.env.BASE_URL.includes('localhost')
      ? `${process.env.BASE_URL.replace(/\/+$/, '')}/uploads/calls/${tenantId}/${filename}`
      : `/uploads/calls/${tenantId}/${filename}`;

  // 4. Update Database
  if (type === 'RECORDING') {
    const existingRec = await prisma.waCallRecording.findFirst({ where: { wacid } });
    let recRecord;
    if (existingRec) {
      recRecord = await prisma.waCallRecording.update({
        where: { id: existingRec.id },
        data: {
          mediaUrl: publicUrl,
          downloadStatus: 'DOWNLOADED'
        }
      });
    } else {
      recRecord = await prisma.waCallRecording.create({
        data: {
          call: { connect: { wacid } },
          wacid,
          metaMediaId: mediaObj.id,
          mediaUrl: publicUrl,
          mimeType: mediaObj.mime_type || 'audio/ogg; codecs=opus',
          sha256: expectedHash,
          downloadStatus: 'DOWNLOADED'
        }
      });
    }

    if (tenantId) {
      console.log(`📢 [Socket] Emitting call_recording_ready to tenant ${tenantId} for ${wacid}`);
      emitToTenant(tenantId, 'call_recording_ready', {
        wacid,
        mediaUrl: publicUrl,
        recording: recRecord
      });
    }
  } else if (type === 'TRANSCRIPTION') {
     let fullText = null;
     let segments = null;
     try {
       const json = JSON.parse(buffer.toString('utf-8'));
       fullText = json.dialog?.[0]?.text || json.text || null;
       segments = json.dialog || null;
     } catch (e) { console.warn('Could not parse transcript JSON'); }

     const existingTrans = await prisma.waCallTranscript.findFirst({ where: { wacid } });
     let transRecord;
     if (existingTrans) {
       transRecord = await prisma.waCallTranscript.update({
         where: { id: existingTrans.id },
         data: {
           mediaUrl: publicUrl,
           fullText,
           segments,
           downloadStatus: 'DOWNLOADED'
         }
       });
     } else {
       transRecord = await prisma.waCallTranscript.create({
         data: {
           call: { connect: { wacid } },
           wacid,
           metaDocumentId: mediaObj.id,
           mediaUrl: publicUrl,
           fullText,
           segments,
           downloadStatus: 'DOWNLOADED'
         }
       });
     }

     if (tenantId) {
       console.log(`📢 [Socket] Emitting call_transcript_ready to tenant ${tenantId} for ${wacid}`);
       emitToTenant(tenantId, 'call_transcript_ready', {
         wacid,
         fullText,
         mediaUrl: publicUrl,
         transcript: transRecord
       });
     }
  }

  console.log(`✅ [CallMediaWorker] Downloaded and persisted ${type} for call ${wacid}`);
};

export const startCallMediaWorker = () => {
  const worker = new Worker(QUEUE_NAME_CALL_MEDIA, processCallMediaJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('failed', async (job, err) => {
    console.error(`❌ [CallMediaWorker] Job ${job.id} failed:`, err.message);
    if (job.attemptsMade >= job.opts.attempts) {
       // Mark as failed in DB
       try {
         const { type, payload } = job.data;
         const wacid = payload.id;
         if (type === 'RECORDING') {
            await prisma.waCallRecording.updateMany({ where: { wacid }, data: { downloadStatus: 'FAILED' }});
         } else {
            await prisma.waCallTranscript.updateMany({ where: { wacid }, data: { downloadStatus: 'FAILED' }});
         }
       } catch (dbErr) {}
    }
  });

  console.log('👷 CallMedia Worker initialized');
  return worker;
};
