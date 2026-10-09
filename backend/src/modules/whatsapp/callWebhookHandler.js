import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { redisConnection } from '../../config/redis.js';
import { createWebRtcTransport, generateMetaSdp, processMetaSdpAnswer } from '../../lib/mediasoup/mediasoupService.js';
import { activeCalls, activeOutboundTransports, bridgeAgentToMeta } from './callSocketHandler.js';
import { callMediaQueue } from '../../queues/callMediaQueue.js';
import axios from 'axios';
import { GRAPH_BASE_URL } from '../../config/meta.js';
import { decrypt } from '../../lib/crypto.js';

export const handleCallEvents = async (value, tenant) => {
  console.log('[Webhook] Incoming call event:', JSON.stringify(value, null, 2));

  // Extract calls array from various Meta payload shapes
  let calls = [];
  if (Array.isArray(value?.calls)) {
    calls = value.calls;
  } else if (value?.call) {
    calls = [value.call];
  } else if (value?.call_id || (value?.id && (String(value.id).startsWith('wacid.') || value.event))) {
    calls = [value];
  }

  const phoneId = value?.metadata?.phone_number_id || value?.phone_number_id || tenant?.whatsappPhoneId;

  for (const call of calls) {
    const wacid = call.id || call.call_id;
    if (!wacid) continue;

    const event = call.event || call.type || call.action;
    const isConnect = event === 'connect' || call.status === 'connect' || call.status === 'connected' || Boolean(call.session?.sdp);

    const isUserInitiated = 
      call.direction === 'USER_INITIATED' || 
      call.direction?.toLowerCase() === 'user_initiated' ||
      call.session?.sdp_type === 'offer' ||
      (!call.direction && Boolean(call.session?.sdp));

    // 1. Handle Connect Event (Inbound & Outbound)
    if (isConnect) {
      if (isUserInitiated) {
        console.log(`🔔 [Incoming Call] Inbound call received: ${wacid}`);
        
        // Cache Meta's incoming SDP offer for direct WebRTC negotiation upon agent accept
        const metaSdpOffer = call.session?.sdp;
        if (metaSdpOffer) {
          await redisConnection.set(`sdp-offer:${wacid}`, metaSdpOffer, 'EX', 180);
        }

        const fromNumber = typeof call.from === 'string' ? call.from : call.from?.phone_number || call.from?.id;
        const toNumber = typeof call.to === 'string' ? call.to : call.to?.phone_number || phoneId;

        let resolvedConvId = null;
        if (fromNumber && tenant) {
          try {
            const cleanFrom = String(fromNumber).replace(/\D/g, '');
            const contact = await prisma.contact.findFirst({
              where: {
                tenantId: tenant.id,
                OR: [
                  { phone: fromNumber },
                  { phone: cleanFrom },
                  { phone: `+${cleanFrom}` },
                  ...(cleanFrom.length >= 10 ? [{ phone: { endsWith: cleanFrom.slice(-10) } }] : [])
                ]
              },
              include: {
                conversations: true
              }
            });
            if (contact?.conversations) {
              resolvedConvId = contact.conversations.id || contact.conversations[0]?.id;
            }
          } catch (lookupErr) {
            console.warn('Error looking up contact for inbound call:', lookupErr.message);
          }
        }

        await prisma.waCall.upsert({
          where: { wacid },
          create: {
            wacid,
            businessPhoneId: phoneId || 'unknown',
            direction: 'USER_INITIATED',
            fromNumber: fromNumber || null,
            fromBsuid: typeof call.from === 'object' ? call.from?.id : null,
            toNumber: toNumber || null,
            toBsuid: typeof call.to === 'object' ? call.to?.id : null,
            status: 'RINGING',
            bizOpaqueData: call.biz_opaque_callback_data || null,
            ctaPayload: call.cta_payload || null,
            deeplinkPayload: call.deeplink_payload || null,
            conversationId: resolvedConvId,
          },
          update: {
            status: 'RINGING',
            ...(resolvedConvId && { conversationId: resolvedConvId }),
          }
        });

        if (tenant) {
          console.log(`📢 [Socket] Emitting incoming_whatsapp_call to tenant ${tenant.id}: ${wacid}`);
          emitToTenant(tenant.id, 'incoming_whatsapp_call', {
            wacid,
            fromNumber,
            ctaPayload: call.cta_payload || null,
            sdpOffer: call.session?.sdp || null
          });
        }
      } else {
        // Outbound call connected
        const sdpAnswer = call.session?.sdp;
        const rawToNumber = typeof call.to === 'string' ? call.to : call.to?.phone_number;
        const cleanTo = rawToNumber ? String(rawToNumber).replace(/\D/g, '') : null;

        const metaTransport = 
          activeOutboundTransports.get(wacid) || 
          (cleanTo && activeOutboundTransports.get(cleanTo)) || 
          (rawToNumber && activeOutboundTransports.get(rawToNumber)) ||
          activeCalls.get(wacid)?.metaTransport;
        
        if (metaTransport && sdpAnswer) {
          try {
             const metaProducer = await processMetaSdpAnswer(metaTransport, sdpAnswer);
             console.log(`✅ [Mediasoup] Outbound call ${wacid} metaProducer ready: ${metaProducer.id}`);
             
             const existing = activeCalls.get(wacid) || {};
             activeCalls.set(wacid, {
               ...existing,
               metaTransport,
               metaProducer
             });

             // Route agent's mic to Meta if agent is already producing
             await bridgeAgentToMeta(activeCalls.get(wacid));

             activeOutboundTransports.delete(wacid);
             if (cleanTo) activeOutboundTransports.delete(cleanTo);
             if (rawToNumber) activeOutboundTransports.delete(rawToNumber);
          } catch(e) {
             console.error("Failed to process Meta SDP Answer:", e);
          }
        }

        await prisma.waCall.updateMany({
          where: { wacid },
          data: { 
            status: 'CONNECTING',
            ...(sdpAnswer && { sdpAnswer })
          }
        });

        if (tenant) {
          emitToTenant(tenant.id, 'call_status_update', { 
            wacid, 
            status: 'CONNECTING',
            sdpAnswer: sdpAnswer || call.session?.sdp || null
          });
        }
      }
    } 
    // 2. Handle Status Updates, Declines & Terminations
    else if (call.status || event === 'terminate' || call.reason) {
      let rawStatus = call.status ? call.status.toUpperCase() : '';
      let status = rawStatus;

      if (event === 'terminate' || ['TERMINATE', 'TERMINATED', 'ENDED'].includes(rawStatus) || call.reason) {
        if (call.reason === 'user_rejected' || call.reason === 'user_declined' || call.reason === 'declined' || rawStatus === 'REJECTED') {
          status = 'REJECTED';
        } else if (call.reason === 'timeout' || call.reason === 'media_timeout' || rawStatus === 'FAILED') {
          status = 'FAILED';
        } else {
          status = 'COMPLETED';
        }
      }

      if (!status) status = 'COMPLETED';

      console.log(`📞 [Call Event] Status transition for ${wacid}: ${status} (reason: ${call.reason})`);

      let updateData = { status };

      const existingCall = await prisma.waCall.findFirst({ where: { wacid } });
      if (existingCall) {
        if (['MISSED', 'REJECTED', 'FAILED'].includes(existingCall.status) && status === 'COMPLETED') {
          status = existingCall.status;
          updateData.status = status;
        } else if (existingCall.status === 'RINGING' && status === 'COMPLETED') {
          status = 'MISSED';
          updateData.status = status;
        }
      }
      if (['COMPLETED', 'FAILED', 'REJECTED'].includes(status)) {
         if (call.start_timestamp) updateData.startTime = BigInt(call.start_timestamp);
         if (call.end_timestamp) updateData.endTime = BigInt(call.end_timestamp);
         if (call.duration) updateData.duration = call.duration;
         const endingCall = activeCalls.get(wacid);
         if (endingCall) {
           if (endingCall.metaTransport) try { endingCall.metaTransport.close(); } catch (_) {}
           if (endingCall.sendTransport) try { endingCall.sendTransport.close(); } catch (_) {}
           if (endingCall.recvTransport) try { endingCall.recvTransport.close(); } catch (_) {}
         }
         activeCalls.delete(wacid);
      }

      await prisma.waCall.updateMany({
        where: { wacid },
        data: updateData
      });

      if (tenant) {
        console.log(`📢 [Socket] Emitting call_status_update to tenant ${tenant.id}: ${wacid} -> ${status}`);
        emitToTenant(tenant.id, 'call_status_update', { wacid, status, duration: call.duration != null ? call.duration : undefined });
      }
    }
  }

  const statuses = value?.statuses || [];
  for (const stat of statuses) {
    const wacid = stat.id || stat.call_id;
    if (!wacid) continue;

    let raw = stat.status ? stat.status.toUpperCase() : '';
    let status = raw;
    if (['REJECTED', 'USER_REJECTED', 'DECLINED'].includes(raw)) {
      status = 'REJECTED';
    } else if (['FAILED', 'TIMEOUT'].includes(raw)) {
      status = 'FAILED';
    } else if (['TERMINATED', 'TERMINATE', 'ENDED'].includes(raw)) {
      status = 'COMPLETED';
    }

    let updateData = { status };

    const existingCall = await prisma.waCall.findFirst({ where: { wacid } });
    if (existingCall) {
      if (['MISSED', 'REJECTED', 'FAILED'].includes(existingCall.status) && status === 'COMPLETED') {
        status = existingCall.status;
        updateData.status = status;
      } else if (existingCall.status === 'RINGING' && status === 'COMPLETED') {
        status = 'MISSED';
        updateData.status = status;
      }
    }
    if (['COMPLETED', 'FAILED', 'REJECTED'].includes(status)) {
       if (stat.start_timestamp) updateData.startTime = BigInt(stat.start_timestamp);
       if (stat.end_timestamp) updateData.endTime = BigInt(stat.end_timestamp);
       if (stat.duration) updateData.duration = stat.duration;
       activeCalls.delete(wacid);
    }

    await prisma.waCall.updateMany({
      where: { wacid },
      data: updateData
    });

    if (tenant) {
      console.log(`📢 [Socket] Emitting status update from statuses array to tenant ${tenant.id}: ${wacid} -> ${status}`);
      emitToTenant(tenant.id, 'call_status_update', { wacid, status, duration: stat.duration != null ? stat.duration : undefined });
    }
  }

  // 3. Handle Call Recording & Transcription Available
  const extractedRecordings = [];
  if (Array.isArray(value?.call_recordings)) {
    extractedRecordings.push(...value.call_recordings);
  } else if (value?.call_recordings) {
    extractedRecordings.push(value.call_recordings);
  }
  if (Array.isArray(value?.call_recording)) {
    extractedRecordings.push(...value.call_recording);
  } else if (value?.call_recording) {
    extractedRecordings.push(value.call_recording);
  }
  if (Array.isArray(value?.recordings)) {
    extractedRecordings.push(...value.recordings);
  } else if (value?.recordings) {
    extractedRecordings.push(value.recordings);
  }
  if (value?.recording) {
    extractedRecordings.push(value.recording);
  }

  // Check inside calls array
  for (const c of calls) {
    const cWacid = c.id || c.call_id;
    if (c.recording) extractedRecordings.push({ ...c.recording, wacid: cWacid });
    if (Array.isArray(c.recordings)) {
      extractedRecordings.push(...c.recordings.map((r) => ({ ...r, wacid: cWacid })));
    }
    if (Array.isArray(c.call_recordings)) {
      extractedRecordings.push(...c.call_recordings.map((r) => ({ ...r, wacid: cWacid })));
    }
    if (c.call_recording) {
      extractedRecordings.push({ ...c.call_recording, wacid: cWacid });
    }
    if (c.audio) {
      extractedRecordings.push({ audio: c.audio, wacid: cWacid });
    }
  }

  // Check root audio object
  if (value?.audio) {
    const rootWacid = value.call_id || value.wacid || (typeof value.id === 'string' && value.id.startsWith('wacid.') ? value.id : calls[0]?.id);
    extractedRecordings.push({ audio: value.audio, wacid: rootWacid });
  }

  for (const rec of extractedRecordings) {
    if (tenant) {
      const recWacid = rec.wacid || rec.call_id || (typeof rec.id === 'string' && rec.id.startsWith('wacid.') ? rec.id : null) || calls[0]?.id || calls[0]?.call_id;
      console.log(`🎙️ [CallWebhook] Queuing call recording for wacid: ${recWacid}`, JSON.stringify(rec));
      await callMediaQueue.add('process-call-recording', {
        type: 'RECORDING',
        payload: rec,
        wacid: recWacid,
        tenantId: tenant.id
      });
    }
  }

  const extractedTranscriptions = [];
  if (Array.isArray(value?.call_transcriptions)) {
    extractedTranscriptions.push(...value.call_transcriptions);
  } else if (value?.call_transcriptions) {
    extractedTranscriptions.push(value.call_transcriptions);
  }
  if (Array.isArray(value?.call_transcription)) {
    extractedTranscriptions.push(...value.call_transcription);
  } else if (value?.call_transcription) {
    extractedTranscriptions.push(value.call_transcription);
  }
  if (Array.isArray(value?.transcriptions)) {
    extractedTranscriptions.push(...value.transcriptions);
  } else if (value?.transcriptions) {
    extractedTranscriptions.push(value.transcriptions);
  }
  if (value?.transcription) {
    extractedTranscriptions.push(value.transcription);
  }

  for (const c of calls) {
    const cWacid = c.id || c.call_id;
    if (c.transcription) extractedTranscriptions.push({ ...c.transcription, wacid: cWacid });
    if (Array.isArray(c.transcriptions)) {
      extractedTranscriptions.push(...c.transcriptions.map((t) => ({ ...t, wacid: cWacid })));
    }
    if (Array.isArray(c.call_transcriptions)) {
      extractedTranscriptions.push(...c.call_transcriptions.map((t) => ({ ...t, wacid: cWacid })));
    }
    if (c.call_transcript) {
      extractedTranscriptions.push({ ...c.call_transcript, wacid: cWacid });
    }
  }

  for (const trans of extractedTranscriptions) {
    if (tenant) {
      const transWacid = trans.wacid || trans.call_id || (typeof trans.id === 'string' && trans.id.startsWith('wacid.') ? trans.id : null) || calls[0]?.id || calls[0]?.call_id;
      console.log(`📝 [CallWebhook] Queuing call transcription for wacid: ${transWacid}`, JSON.stringify(trans));
      await callMediaQueue.add('process-call-transcription', {
        type: 'TRANSCRIPTION',
        payload: trans,
        wacid: transWacid,
        tenantId: tenant.id
      });
    }
  }

  // Bump conversations for all processed calls so they jump to the top of the inbox
  const allWacids = new Set();
  for (const c of calls) if (c.id || c.call_id) allWacids.add(c.id || c.call_id);
  for (const s of statuses) if (s.id || s.call_id) allWacids.add(s.id || s.call_id);
  
  if (allWacids.size > 0) {
    try {
      const callsInDb = await prisma.waCall.findMany({
        where: { wacid: { in: Array.from(allWacids) } },
        select: { conversationId: true }
      });
      const convIds = [...new Set(callsInDb.map(c => c.conversationId).filter(Boolean))];
      if (convIds.length > 0) {
        await prisma.conversation.updateMany({
          where: { id: { in: convIds } },
          data: {
            updatedAt: new Date(),
            lastMessageAt: new Date()
          }
        });
        
        // Emit conversation update socket event if tenant is known
        if (tenant) {
          emitToTenant(tenant.id, 'conversations_updated', { count: convIds.length });
        }
      }
    } catch (err) {
      console.warn('Failed to bump conversation for calls:', err.message);
    }
  }
};

export const handleCallPermissionReply = async (msg, tenant, phoneId) => {
  const reply = msg.interactive.call_permission_reply;
  const userWaId = msg.from;
  
  const statusStr = reply.response === 'accept' 
    ? (reply.is_permanent ? 'permanent' : 'temporary') 
    : 'no_permission';

  await prisma.waCallPermission.upsert({
    where: {
      businessPhoneId_userWaId: {
        businessPhoneId: phoneId,
        userWaId: userWaId
      }
    },
    update: {
      permissionStatus: statusStr,
      isPermanent: reply.is_permanent || false,
      expirationTimestamp: reply.expiration_timestamp ? BigInt(reply.expiration_timestamp) : null,
      responseSource: reply.response_source,
      unansweredConsecutive: 0  // Reset on any permission interaction
    },
    create: {
      businessPhoneId: phoneId,
      userWaId: userWaId,
      permissionStatus: statusStr,
      isPermanent: reply.is_permanent || false,
      expirationTimestamp: reply.expiration_timestamp ? BigInt(reply.expiration_timestamp) : null,
      responseSource: reply.response_source,
    }
  });
  
  if (tenant) {
    emitToTenant(tenant.id, 'call_permission_update', { userWaId, status: statusStr });
  }
};

export const handleAccountSettingsUpdate = async (value) => {
  const settings = value.phone_number_settings;
  if (!settings) return;
  
  const phoneId = settings.phone_number_id;
  
  // Keep DB in sync if settings are changed via WhatsApp Manager
  await prisma.waPhoneCallSetting.upsert({
    where: { businessPhoneId: phoneId },
    update: {
      status: settings.calling_status || 'ENABLED',
      callIconVisibility: settings.call_icon_visibility || 'DEFAULT',
      // map other fields as provided by the Meta settings payload
    },
    create: {
      businessPhoneId: phoneId,
      status: settings.calling_status || 'ENABLED',
      callIconVisibility: settings.call_icon_visibility || 'DEFAULT',
    }
  });
};
