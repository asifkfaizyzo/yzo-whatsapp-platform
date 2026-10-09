import prisma from '../../config/prisma.js';
import axios from 'axios';
import { GRAPH_BASE_URL } from '../../config/meta.js';
import { redisConnection } from '../../config/redis.js';
import { createWebRtcTransport, generateMetaSdp } from '../../lib/mediasoup/mediasoupService.js';
import { activeCalls, activeOutboundTransports } from './callSocketHandler.js';
import { emitToTenant } from '../../lib/socket.js';
import { decrypt } from '../../lib/crypto.js';
import FormData from 'form-data';
import fs from 'fs';

// Helper to get access token
const getTenantToken = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.whatsappAccessToken) throw new Error('WhatsApp not configured');
  return decrypt(tenant.whatsappAccessToken);
};

// POST /api/whatsapp/calls/accept
export const acceptCall = async (req, res) => {
  try {
    let { wacid, phoneId, sdpAnswer: clientSdpAnswer } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    phoneId = phoneId || tenant.whatsappPhoneId;
    const token = decrypt(tenant.whatsappAccessToken);
    if (!token) throw new Error('WhatsApp access token not configured');

    // Fetch SDP Answer (Client direct answer first, Redis second, fallback to DB)
    let sdpAnswer = clientSdpAnswer || await redisConnection.get(`sdp-answer:${wacid}`);
    if (!sdpAnswer) {
      const dbCall = await prisma.waCall.findUnique({ where: { wacid } });
      sdpAnswer = dbCall?.sdpAnswer;
      if (!sdpAnswer) {
        console.warn(`[acceptCall] SDP answer not found in client payload, Redis, or DB for wacid: ${wacid}`);
      }
    }

    try {
      const response = await axios.post(
        `${GRAPH_BASE_URL}/${phoneId}/calls`,
        {
          messaging_product: 'whatsapp',
          call_id: wacid,
          action: 'accept',
          ...(sdpAnswer && {
            session: {
              sdp_type: 'answer',
              sdp: sdpAnswer
            }
          }),
          recording: {
            status: "ENABLED",
            purpose: "quality assurance",
            announcement_language: "en_US"
          },
          transcription: {
            status: "ENABLED",
            purpose: "quality assurance",
            announcement_language: "en_US"
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Meta acceptCall response:', JSON.stringify(response.data));
    } catch (metaErr) {
      console.warn('Meta acceptCall warning:', metaErr.response?.data || metaErr.message);
    }

    await prisma.waCall.updateMany({
      where: { wacid },
      data: { status: 'ACCEPTED' }
    });

    emitToTenant(tenant.id, 'call_status_update', { wacid, status: 'ACCEPTED' });

    res.json({ success: true });
  } catch (error) {
    console.error('acceptCall error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Failed to accept call' });
  }
};

// POST /api/whatsapp/calls/reject
export const rejectCall = async (req, res) => {
  try {
    let { phoneId, wacid } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    phoneId = phoneId || tenant.whatsappPhoneId;
    const token = decrypt(tenant.whatsappAccessToken);

    if (wacid && wacid.startsWith('wacid.') && phoneId && token) {
      try {
        await axios.post(
          `${GRAPH_BASE_URL}/${phoneId}/calls`,
          {
            messaging_product: 'whatsapp',
            action: 'reject',
            call_id: wacid,
            voicemail: {
              status: "ENABLED"
            }
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (metaErr) {
        console.warn('Meta reject call warning:', metaErr.response?.data || metaErr.message);
      }
    }

    if (wacid) {
      await prisma.waCall.updateMany({
        where: { wacid },
        data: { status: 'REJECTED' }
      });
      activeCalls.delete(wacid);
    }

    emitToTenant(tenant.id, 'call_status_update', { wacid, status: 'REJECTED' });

    res.json({ success: true, message: 'Call rejected' });
  } catch (error) {
    console.error('rejectCall error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject call' });
  }
};

// POST /api/whatsapp/calls/terminate
export const terminateCall = async (req, res) => {
  try {
    let { phoneId, wacid } = req.body; 
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    phoneId = phoneId || tenant.whatsappPhoneId;

    if (!phoneId && wacid) {
      const dbCall = await prisma.waCall.findUnique({ where: { wacid } });
      if (dbCall?.businessPhoneId) {
        phoneId = dbCall.businessPhoneId;
      }
    }

    const token = decrypt(tenant.whatsappAccessToken);

    if (wacid && wacid.startsWith('wacid.') && phoneId && token) {
      try {
        await axios.post(
          `${GRAPH_BASE_URL}/${phoneId}/calls`,
          { 
            messaging_product: 'whatsapp',
            action: 'terminate',
            call_id: wacid 
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (metaErr) {
        console.warn('Meta terminate call warning (call may already be ended):', metaErr.response?.data || metaErr.message);
      }
    }

    if (wacid) {
      await prisma.waCall.updateMany({
        where: { wacid },
        data: { status: 'COMPLETED' }
      });
      activeCalls.delete(wacid);
    }

    emitToTenant(tenant.id, 'call_status_update', { wacid, status: 'COMPLETED' });

    res.json({ success: true, message: 'Call terminated' });
  } catch (error) {
    console.error('terminateCall error:', error);
    res.status(500).json({ error: error.message || 'Failed to terminate call' });
  }
};

// POST /api/whatsapp/calls/initiate
export const initiateCall = async (req, res) => {
  try {
    let { phoneId, contactId, sdpOffer: clientSdpOffer, conversationId: reqConvId } = req.body; 
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');
    
    phoneId = phoneId || tenant.whatsappPhoneId;
    if (!phoneId) throw new Error('WhatsApp Phone ID not configured');
    
    const token = decrypt(tenant.whatsappAccessToken);
    if (!token) throw new Error('WhatsApp Access Token not configured');

    // 1. Verify rate limits (simplistic check for 100/day can be done via DB)
    
    // 2. Request Meta to connect
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new Error('Contact not found');
    if (!contact.phone) throw new Error('Contact has no phone number');

    // Resolve conversationId if not explicitly provided
    let resolvedConversationId = reqConvId || null;
    if (!resolvedConversationId && contactId) {
      const conv = await prisma.conversation.findFirst({
        where: { contactId, tenantId: tenant.id },
        select: { id: true },
        orderBy: { updatedAt: 'desc' }
      });
      if (conv) resolvedConversationId = conv.id;
    }
    
    // Clean phone number (remove +, spaces, etc.)
    const toNumber = contact.phone.replace(/\D/g, '');

    // 3. Obtain SDP Offer for Meta (Direct Browser WebRTC first, fallback to Mediasoup)
    let sdpOffer = clientSdpOffer || null;
    let outboundTransport = null;
    if (clientSdpOffer) {
      console.log(`🌐 [WebRTC] Using client direct browser SDP offer for outbound call to: ${toNumber}`);
    } else {
      console.log(`🌐 [WebRTC] No client SDP offer provided, falling back to Mediasoup for: ${toNumber}`);
      try {
        const { transport, params: metaTransportParams } = await createWebRtcTransport();
        outboundTransport = transport;
        sdpOffer = generateMetaSdp(metaTransportParams, 'offer');
        activeOutboundTransports.set(toNumber, transport);
      } catch (mediaErr) {
        console.warn('Mediasoup createWebRtcTransport warning:', mediaErr.message);
      }
    }

    const requestBody = {
      messaging_product: 'whatsapp',
      to: toNumber,
      action: 'connect',
      ...(sdpOffer && {
        session: {
          sdp_type: 'offer',
          sdp: sdpOffer
        }
      }),
      recording: {
         status: "ENABLED",
         purpose: "quality assurance",
         announcement_language: "en_US"
      },
      transcription: {
         status: "ENABLED",
         purpose: "quality assurance",
         announcement_language: "en_US"
      },
      biz_opaque_callback_data: `agent_${req.user?.id || 'tenant'}`
    };

    const response = await axios.post(
      `${GRAPH_BASE_URL}/${phoneId}/calls`,
      requestBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const callId = response.data?.calls?.[0]?.id || response.data?.id;

    // Associate outbound transport with callId
    if (callId && outboundTransport) {
      activeOutboundTransports.set(callId, outboundTransport);
      const existing = activeCalls.get(callId) || {};
      activeCalls.set(callId, {
        ...existing,
        metaTransport: outboundTransport
      });
    }

    // Immediately persist outbound call in DB
    if (callId) {
      await prisma.waCall.upsert({
        where: { wacid: callId },
        create: {
          wacid: callId,
          businessPhoneId: phoneId,
          direction: 'BUSINESS_INITIATED',
          toNumber,
          fromNumber: tenant.whatsappPhoneId,
          status: 'DIALING',
          bizOpaqueData: requestBody.biz_opaque_callback_data,
          assignedAgentId: req.user?.id || null,
          conversationId: resolvedConversationId,
        },
        update: {
          status: 'DIALING',
          businessPhoneId: phoneId,
          ...(resolvedConversationId && { conversationId: resolvedConversationId }),
        }
      });
    }

    res.json({ success: true, callId, data: response.data });
  } catch (error) {
    if (error.response?.data?.error?.code === 138006) {
      return res.status(403).json({
        error: 'NO_CALL_PERMISSION',
        message: 'User has not granted call permission. Send a permission request first.'
      });
    }
    console.error('initiateCall error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message || 'Failed to initiate call' });
  }
};

// GET /api/whatsapp/calls/permissions/:contactId
export const getCallPermissions = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { phoneId } = req.query;
    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    const response = await axios.get(
      `${GRAPH_BASE_URL}/${phoneId}/call_permissions?user_wa_id=${contactId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get permissions' });
  }
};

// POST /api/whatsapp/calls/permissions/request
export const requestCallPermission = async (req, res) => {
  try {
    let { phoneId, contactId } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;
    
    if (!phoneId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      phoneId = tenant.whatsappPhoneId;
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.phone) throw new Error('Contact not found or has no phone number');
    
    const toNumber = contact.phone.replace(/\D/g, '');

    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    const response = await axios.post(
      `${GRAPH_BASE_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toNumber,
        type: 'interactive',
        interactive: {
          type: 'call_permission_request',
          body: {
            text: "Please grant us permission to call you via WhatsApp."
          },
          action: {
            name: "call_permission_request"
          }
        }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Call Permission Request Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message || 'Failed to request permission' });
  }
};

// GET /api/whatsapp/calls/settings/:phoneId
export const getCallSettings = async (req, res) => {
  try {
    const { phoneId } = req.params;
    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    let callingSettings = { status: 'ENABLED', call_icon_visibility: 'DEFAULT' };
    try {
      const response = await axios.get(
        `${GRAPH_BASE_URL}/${phoneId}/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.calling) callingSettings = response.data.calling;
    } catch (metaErr) {
      console.warn('Meta GET settings warning:', metaErr.response?.data || metaErr.message);
    }
    
    res.json({ 
      success: true, 
      data: {
        status: callingSettings.status || 'ENABLED',
        callIconVisibility: callingSettings.call_icon_visibility || 'DEFAULT'
      }
    });
  } catch (error) {
    console.error('getCallSettings error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get call settings' });
  }
};

// PUT /api/whatsapp/calls/settings/:phoneId
export const updateCallSettings = async (req, res) => {
  try {
    const { phoneId } = req.params;
    const updateData = req.body;
    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    const payload = {
      calling: {
        status: updateData.status || "ENABLED",
        call_icon_visibility: updateData.callIconVisibility || "DEFAULT"
      }
    };
    
    const response = await axios.post(
      `${GRAPH_BASE_URL}/${phoneId}/settings`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('updateCallSettings error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to update call settings' });
  }
};

// POST /api/whatsapp/calls/settings/:phoneId/voicemail-greeting
export const uploadVoicemailGreeting = async (req, res) => {
  try {
    const { phoneId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', fs.createReadStream(file.path), { contentType: 'audio/ogg' });
    formData.append('use_case', 'call_voicemail_announcement');

    const response = await axios.post(
      `${GRAPH_BASE_URL}/${phoneId}/media`,
      formData,
      { headers: { ...formData.getHeaders(), Authorization: `Bearer ${token}` } }
    );

    const mediaId = response.data?.id;
    if (mediaId) {
      const payload = {
        voicemail: {
          status: "ENABLED",
          audio: {
            default: {
              announcement_media_id: mediaId
            }
          }
        }
      };
      await axios.post(
        `${GRAPH_BASE_URL}/${phoneId}/settings`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }

    // cleanup temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('uploadVoicemailGreeting error:', error.response?.data || error.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to upload voicemail greeting' });
  }
};

// GET /api2/whatsapp/calls/history
export const getCallHistory = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const phoneId = tenant.whatsappPhoneId;
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      direction, 
      status, 
      dateFrom, 
      dateTo 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (phoneId) {
      where.businessPhoneId = phoneId;
    }

    if (direction && ['BUSINESS_INITIATED', 'USER_INITIATED'].includes(direction)) {
      where.direction = direction;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fromNumber: { contains: q, mode: 'insensitive' } },
        { toNumber: { contains: q, mode: 'insensitive' } },
        { wacid: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [calls, total] = await Promise.all([
      prisma.waCall.findMany({
        where,
        include: {
          recordings: true,
          transcripts: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.waCall.count({ where })
    ]);

    // KPI aggregates for this tenant's phone
    const baseWhere = phoneId ? { businessPhoneId: phoneId } : {};
    const [totalCallsCount, answeredCount, missedCount, durationAgg] = await Promise.all([
      prisma.waCall.count({ where: baseWhere }),
      prisma.waCall.count({ 
        where: { 
          ...baseWhere, 
          status: { in: ['ACCEPTED', 'COMPLETED'] } 
        } 
      }),
      prisma.waCall.count({ 
        where: { 
          ...baseWhere, 
          status: { in: ['FAILED', 'REJECTED'] } 
        } 
      }),
      prisma.waCall.aggregate({
        where: baseWhere,
        _sum: { duration: true }
      })
    ]);

    const totalDurationSeconds = durationAgg._sum?.duration || 0;

    // Serialize BigInt safely
    const serializedCalls = calls.map(c => ({
      ...c,
      startTime: c.startTime ? Number(c.startTime) : null,
      endTime: c.endTime ? Number(c.endTime) : null
    }));

    res.json({
      success: true,
      data: {
        calls: serializedCalls,
        pagination: {
          total,
          page: pageNum,
          limit: take,
          totalPages: Math.ceil(total / take)
        },
        kpis: {
          totalCalls: totalCallsCount,
          answered: answeredCount,
          missed: missedCount,
          totalDurationSeconds
        }
      }
    });
  } catch (error) {
    console.error('getCallHistory error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch call history' });
  }
};

// GET /api2/whatsapp/calls/conversation/:conversationId
export const getConversationCalls = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tenantId = req.user?.tenantId || (req.user?.type === 'TENANT' ? req.user.id : null);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        contact: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const phone = conversation.contact?.phone || '';
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const phoneSuffix = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    const phoneConditions = [];
    if (phone) {
      phoneConditions.push({ fromNumber: phone }, { toNumber: phone });
    }
    if (cleanPhone) {
      phoneConditions.push({ fromNumber: cleanPhone }, { toNumber: cleanPhone });
      phoneConditions.push({ fromNumber: `+${cleanPhone}` }, { toNumber: `+${cleanPhone}` });
    }
    if (phoneSuffix) {
      phoneConditions.push({ fromNumber: { endsWith: phoneSuffix } });
      phoneConditions.push({ toNumber: { endsWith: phoneSuffix } });
    }

    const calls = await prisma.waCall.findMany({
      where: {
        OR: [
          { conversationId: conversation.id },
          ...phoneConditions
        ]
      },
      include: {
        recordings: true,
        transcripts: true
      },
      orderBy: {
        createdAt: 'asc' // chronological for timeline
      }
    });

    const serializedCalls = calls.map(c => ({
      ...c,
      startTime: c.startTime ? Number(c.startTime) : null,
      endTime: c.endTime ? Number(c.endTime) : null,
    }));

    res.json({ success: true, data: serializedCalls });
  } catch (error) {
    console.error('getConversationCalls error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch calls for conversation' });
  }
};

// GET /api2/whatsapp/calls/contact/:contactId
export const getContactCalls = async (req, res) => {
  try {
    const { contactId } = req.params;
    const tenantId = req.user?.tenantId || (req.user?.type === 'TENANT' ? req.user.id : null);

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        conversations: {
          select: { id: true }
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const convIds = (contact.conversations || []).map(c => c.id);
    const phone = contact.phone || '';
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const phoneSuffix = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    const orConditions = [];
    if (convIds.length > 0) {
      orConditions.push({ conversationId: { in: convIds } });
    }
    if (phone) {
      orConditions.push({ fromNumber: phone }, { toNumber: phone });
    }
    if (cleanPhone) {
      orConditions.push({ fromNumber: cleanPhone }, { toNumber: cleanPhone });
      orConditions.push({ fromNumber: `+${cleanPhone}` }, { toNumber: `+${cleanPhone}` });
    }
    if (phoneSuffix) {
      orConditions.push({ fromNumber: { endsWith: phoneSuffix } });
      orConditions.push({ toNumber: { endsWith: phoneSuffix } });
    }

    const calls = await prisma.waCall.findMany({
      where: {
        OR: orConditions.length > 0 ? orConditions : [{ id: 'none' }]
      },
      include: {
        recordings: true,
        transcripts: true
      },
      orderBy: {
        createdAt: 'desc' // newest first for sidebar
      }
    });

    const serializedCalls = calls.map(c => ({
      ...c,
      startTime: c.startTime ? Number(c.startTime) : null,
      endTime: c.endTime ? Number(c.endTime) : null,
    }));

    res.json({ success: true, data: serializedCalls });
  } catch (error) {
    console.error('getContactCalls error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch contact calls' });
  }
};
