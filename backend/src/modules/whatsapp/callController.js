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
    let { wacid, phoneId } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    phoneId = phoneId || tenant.whatsappPhoneId;
    const token = decrypt(tenant.whatsappAccessToken);
    if (!token) throw new Error('WhatsApp access token not configured');

    // Fetch cached SDP Answer
    const sdpAnswer = await redisConnection.get(`sdp-answer:${wacid}`);
    if (!sdpAnswer) {
      console.warn(`[acceptCall] SDP answer not found in Redis for wacid: ${wacid}`);
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
          })
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
            call_id: wacid
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
    let { phoneId, contactId } = req.body; 
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
    
    // Clean phone number (remove +, spaces, etc.)
    const toNumber = contact.phone.replace(/\D/g, '');

    // 3. Request Mediasoup SDP Offer for Meta
    let sdpOffer = null;
    try {
      const { transport, params: metaTransportParams } = await createWebRtcTransport();
      sdpOffer = generateMetaSdp(metaTransportParams, 'offer');
      activeOutboundTransports.set(toNumber, transport);
    } catch (mediaErr) {
      console.warn('Mediasoup createWebRtcTransport warning:', mediaErr.message);
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
         status: "enabled",
         purpose: "Quality assurance",
         announcement_language: "en_US"
      },
      transcription: {
         status: "enabled",
         purpose: "Quality assurance",
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
        },
        update: {
          status: 'DIALING',
          businessPhoneId: phoneId,
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

    const response = await axios.get(
      `${GRAPH_BASE_URL}/${phoneId}/whatsapp_phone_number_call_settings`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get call settings' });
  }
};

// PUT /api/whatsapp/calls/settings/:phoneId
export const updateCallSettings = async (req, res) => {
  try {
    const { phoneId } = req.params;
    const updateData = req.body;
    const token = await getTenantToken(req.tenant?.id || req.user?.tenantId);

    const response = await axios.post(
      `${GRAPH_BASE_URL}/${phoneId}/whatsapp_phone_number_call_settings`,
      updateData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
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

    // cleanup temp file
    fs.unlinkSync(file.path);

    res.json({ success: true, data: response.data });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to upload voicemail greeting' });
  }
};
