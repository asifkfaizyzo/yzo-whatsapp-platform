import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { redisConnection } from '../../config/redis.js';
import { createWebRtcTransport, generateMetaSdp, processMetaSdpAnswer } from '../../lib/mediasoup/mediasoupService.js';
import { activeCalls, activeOutboundTransports } from './callSocketHandler.js';
import { callMediaQueue } from '../../queues/callMediaQueue.js';

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
        
        let sdpAnswer = null;
        try {
          const { params: metaTransportParams } = await createWebRtcTransport();
          sdpAnswer = generateMetaSdp(metaTransportParams, 'answer'); 
          if (sdpAnswer) {
            await redisConnection.set(`sdp-answer:${wacid}`, sdpAnswer, 'EX', 120);
          }
        } catch (mediaErr) {
          console.warn("⚠️ [Mediasoup] Could not create transport for incoming call:", mediaErr.message);
        }

        const fromNumber = typeof call.from === 'string' ? call.from : call.from?.phone_number || call.from?.id;
        const toNumber = typeof call.to === 'string' ? call.to : call.to?.phone_number || phoneId;

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
            sdpAnswer: sdpAnswer || null,
          },
          update: {
            status: 'RINGING',
            ...(sdpAnswer && { sdpAnswer }),
          }
        });

        if (tenant) {
          console.log(`📢 [Socket] Emitting incoming_whatsapp_call to tenant ${tenant.id}: ${wacid}`);
          emitToTenant(tenant.id, 'incoming_whatsapp_call', {
            wacid,
            fromNumber,
            ctaPayload: call.cta_payload || null,
          });
        }
      } else {
        // Outbound call connected
        const sdpAnswer = call.session?.sdp;
        const toNumber = typeof call.to === 'string' ? call.to : call.to?.phone_number;
        const metaTransport = activeOutboundTransports.get(toNumber);
        
        if (metaTransport && sdpAnswer) {
          try {
             const metaProducer = await processMetaSdpAnswer(metaTransport, sdpAnswer);
             activeCalls.set(wacid, {
               metaTransport,
               metaProducer,
               sendTransport: null,
               recvTransport: null,
               producer: null,
               consumer: null
             });
             activeOutboundTransports.delete(toNumber);
          } catch(e) {
             console.error("Failed to process Meta SDP Answer:", e);
          }
        }

        await prisma.waCall.updateMany({
          where: { wacid },
          data: { status: 'ACCEPTED' }
        });

        if (tenant) {
          emitToTenant(tenant.id, 'call_status_update', { wacid, status: 'ACCEPTED' });
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
      if (['COMPLETED', 'FAILED', 'REJECTED'].includes(status)) {
         if (call.start_timestamp) updateData.startTime = BigInt(call.start_timestamp);
         if (call.end_timestamp) updateData.endTime = BigInt(call.end_timestamp);
         if (call.duration) updateData.duration = call.duration;
         activeCalls.delete(wacid);
      }

      await prisma.waCall.updateMany({
        where: { wacid },
        data: updateData
      });

      if (tenant) {
        console.log(`📢 [Socket] Emitting call_status_update to tenant ${tenant.id}: ${wacid} -> ${status}`);
        emitToTenant(tenant.id, 'call_status_update', { wacid, status });
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
      emitToTenant(tenant.id, 'call_status_update', { wacid, status });
    }
  }

  // 3. Handle Call Recording & Transcription Available
  const recordings = value.call_recordings || [];
  for (const rec of recordings) {
     if (tenant) {
       await callMediaQueue.add('process-call-recording', {
         type: 'RECORDING',
         payload: rec,
         tenantId: tenant.id
       });
     }
  }

  const transcriptions = value.call_transcriptions || [];
  for (const trans of transcriptions) {
     if (tenant) {
       await callMediaQueue.add('process-call-transcription', {
         type: 'TRANSCRIPTION',
         payload: trans,
         tenantId: tenant.id
       });
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
