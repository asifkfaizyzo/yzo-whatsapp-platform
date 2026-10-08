import { Worker } from 'bullmq';
import { QUEUE_NAME_CALL_MEDIA } from '../queues/callMediaQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { emitToTenant } from '../lib/socket.js';
import { GRAPH_BASE_URL } from '../config/meta.js';
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
  const { type, payload, tenantId, wacid: jobWacid } = job.data;
  const token = await getTenantToken(tenantId);
  
  // Resolve wacid accurately
  const wacid = jobWacid || payload.wacid || payload.call_id || (typeof payload.id === 'string' && payload.id.startsWith('wacid.') ? payload.id : null);

  const mediaObj = type === 'RECORDING' 
    ? (payload.audio || payload.recording || payload) 
    : (payload.document || payload.transcription || payload);

  const mediaId = mediaObj?.id || mediaObj?.media_id || payload?.media_id || (typeof payload?.id === 'string' && !payload.id.startsWith('wacid.') ? payload.id : null);
  const expectedHash = mediaObj?.sha256 || payload?.sha256;
  let url = mediaObj?.url || payload?.url;

  // If no direct URL, fetch download URL from Meta Graph API using mediaId
  if (!url && mediaId) {
    console.log(`[CallMediaWorker] Resolving media download URL from Meta Graph API for mediaId: ${mediaId}...`);
    try {
      const metaRes = await fetch(`${GRAPH_BASE_URL}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        url = metaData.url;
        console.log(`[CallMediaWorker] Successfully resolved download URL for mediaId: ${mediaId}`);
      } else {
        const errText = await metaRes.text();
        console.warn(`[CallMediaWorker] Meta API media URL lookup failed for ${mediaId}: ${errText}`);
      }
    } catch (metaErr) {
      console.error(`[CallMediaWorker] Error fetching media metadata for ${mediaId}:`, metaErr.message);
    }
  }
  
  if (!url) {
     console.warn(`[CallMediaWorker] No URL or mediaId provided for wacid: ${wacid}`);
     return;
  }

  // 1. Download File
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
     throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // 2. Compute SHA256 Hash
  const actualHash = crypto.createHash('sha256').update(buffer).digest('base64');
  if (expectedHash && expectedHash !== actualHash) {
    console.warn(`[CallMediaWorker] Checksum difference for call ${wacid}: expected ${expectedHash}, computed ${actualHash}. Proceeding with file.`);
  }
  
  // 3. Save locally
  const saveDir = path.join(process.cwd(), 'uploads', 'calls', tenantId);
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  const ext = type === 'RECORDING' ? '.ogg' : '.json';
  const filename = `${wacid || mediaId || Date.now()}_${type}${ext}`;
  const localPath = path.join(saveDir, filename);

  fs.writeFileSync(localPath, buffer);
  
  const publicUrl = process.env.BASE_URL && process.env.BASE_URL.startsWith('http') && !process.env.BASE_URL.includes('localhost')
      ? `${process.env.BASE_URL.replace(/\/+$/, '')}/uploads/calls/${tenantId}/${filename}`
      : `/uploads/calls/${tenantId}/${filename}`;

  // Ensure parent WaCall row exists before connecting recording
  if (wacid) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await prisma.waCall.upsert({
      where: { wacid },
      create: {
        wacid,
        businessPhoneId: tenant?.whatsappPhoneId || 'unknown',
        direction: 'UNKNOWN',
        status: 'COMPLETED'
      },
      update: {}
    });
  }

  // 4. Update Database
  if (type === 'RECORDING') {
    const existingRec = await prisma.waCallRecording.findFirst({
      where: {
        OR: [
          ...(wacid ? [{ wacid }] : []),
          ...(mediaId ? [{ metaMediaId: mediaId }] : [])
        ]
      }
    });

    let recRecord;
    if (existingRec) {
      recRecord = await prisma.waCallRecording.update({
        where: { id: existingRec.id },
        data: {
          mediaUrl: publicUrl,
          downloadStatus: 'DOWNLOADED',
          ...(mediaId && { metaMediaId: mediaId }),
          sha256: actualHash
        }
      });
    } else {
      recRecord = await prisma.waCallRecording.create({
        data: {
          ...(wacid ? { call: { connect: { wacid } } } : {}),
          wacid: wacid || 'unknown',
          metaMediaId: mediaId || 'unknown',
          mediaUrl: publicUrl,
          mimeType: mediaObj?.mime_type || 'audio/ogg; codecs=opus',
          sha256: actualHash,
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

     const existingTrans = await prisma.waCallTranscript.findFirst({
       where: {
         OR: [
           ...(wacid ? [{ wacid }] : []),
           ...(mediaId ? [{ metaDocumentId: mediaId }] : [])
         ]
       }
     });

     let transRecord;
     if (existingTrans) {
       transRecord = await prisma.waCallTranscript.update({
         where: { id: existingTrans.id },
         data: {
           mediaUrl: publicUrl,
           fullText,
           segments,
           downloadStatus: 'DOWNLOADED',
           ...(mediaId && { metaDocumentId: mediaId })
         }
       });
     } else {
       transRecord = await prisma.waCallTranscript.create({
         data: {
           ...(wacid ? { call: { connect: { wacid } } } : {}),
           wacid: wacid || 'unknown',
           metaDocumentId: mediaId || 'unknown',
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
