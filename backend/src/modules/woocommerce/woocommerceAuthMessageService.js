import { decrypt } from '../../lib/crypto.js';

const getTemplatePlaceholders = (text = '') => [...new Set(text.match(/\{\{\d+\}\}/g) || [])]
  .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));

export const normalizeWooPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};

export const buildWooAuthTemplateComponents = (template, {
  eventType,
  customerName,
  occurredAt,
  resetUrl,
}) => {
  const templateComponents = Array.isArray(template?.components) ? template.components : [];
  const body = templateComponents.find(
    (component) => String(component.type).toUpperCase() === 'BODY',
  );
  const bodyPlaceholders = getTemplatePlaceholders(body?.text || '');
  if (bodyPlaceholders.some((placeholder, index) => placeholder !== `{{${index + 1}}}`)) {
    throw new Error('WhatsApp auth template body placeholders must be sequential, starting at {{1}}');
  }

  const parameters = [];
  if (eventType === 'customer.login') {
    if (bodyPlaceholders.length > 2) {
      throw new Error('Login alert template supports at most two body placeholders');
    }
    if (bodyPlaceholders.length > 0) parameters.push(customerName || 'Customer');
    if (bodyPlaceholders.length > 1) parameters.push(occurredAt);
  } else {
    if (bodyPlaceholders.length > 2) {
      throw new Error('Password reset template supports at most two body placeholders');
    }
    if (bodyPlaceholders.length > 0) parameters.push(customerName || 'Customer');
    if (bodyPlaceholders.length > 1) parameters.push(resetUrl);
  }

  const components = [];
  if (parameters.length) {
    components.push({
      type: 'body',
      parameters: parameters.map((text) => ({ type: 'text', text })),
    });
  }

  let resetUrlIncluded = eventType === 'customer.password_reset_requested'
    && bodyPlaceholders.length > 1;
  const buttons = templateComponents
    .filter((component) => String(component.type).toUpperCase() === 'BUTTONS')
    .flatMap((component) => component.buttons || []);
  buttons.forEach((button, index) => {
    if (String(button.type).toUpperCase() !== 'URL') return;
    if (/\{\{\d+\}\}/.test(button.url || '')) {
      if (eventType === 'customer.password_reset_requested') {
        const buttonUrlPrefix = String(button.url).split(/\{\{\d+\}\}/, 1)[0];
        if (!resetUrl.startsWith(buttonUrlPrefix)) {
          throw new Error('Password reset URL does not match the approved template URL button prefix');
        }
        const urlSuffix = resetUrl.slice(buttonUrlPrefix.length);
        if (!urlSuffix || urlSuffix.length > 2000) {
          throw new Error('Password reset URL suffix is empty or too long for the approved template');
        }
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(index),
          parameters: [{ type: 'text', text: urlSuffix }],
        });
        resetUrlIncluded = true;
      }
    }
  });

  if (eventType === 'customer.password_reset_requested' && !resetUrlIncluded) {
    throw new Error('Password reset template must include {{2}} in its body or a dynamic URL button');
  }

  return components;
};

export const deliverWooAuthWhatsAppMessage = async ({
  prisma,
  tenantId,
  event,
  customerName,
  phone,
}) => {
  const recipient = process.env.MOCK_WHATSAPP === 'true'
    ? normalizeWooPhone(process.env.WHATSAPP_DEV_RECIPIENT)
    : normalizeWooPhone(phone);

  if (!recipient) {
    throw new Error(process.env.MOCK_WHATSAPP === 'true'
      ? 'WHATSAPP_DEV_RECIPIENT must be set to a valid test phone number'
      : 'Customer phone number is missing or invalid');
  }

  if (process.env.MOCK_WHATSAPP === 'true') {
    console.info('[WooCommerce Auth] Mock WhatsApp send', {
      event: event.topic,
      recipientSuffix: recipient.slice(-4),
      resetLinkIncluded: Boolean(event.resetUrl),
    });
    return { simulated: true };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappPhoneId: true, whatsappAccessToken: true },
  });
  if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
    throw new Error('WhatsApp is not connected for this store');
  }

  const templateName = event.topic === 'customer.login'
    ? process.env.WC_LOGIN_ALERT_TEMPLATE?.trim()
    : process.env.WC_PASSWORD_RESET_TEMPLATE?.trim();
  if (!templateName) {
    throw new Error(event.topic === 'customer.login'
      ? 'WC_LOGIN_ALERT_TEMPLATE must name an approved WhatsApp template'
      : 'WC_PASSWORD_RESET_TEMPLATE must name an approved WhatsApp template');
  }

  const template = await prisma.template.findFirst({
    where: { tenantId, name: templateName, status: 'APPROVED' },
    select: { name: true, language: true, components: true },
  });
  if (!template) {
    throw new Error(`Approved WhatsApp template "${templateName}" was not found for this store`);
  }

  const components = buildWooAuthTemplateComponents(template, {
    eventType: event.topic,
    customerName,
    occurredAt: event.occurredAt,
    resetUrl: event.resetUrl,
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || 'en_US' },
          components,
        },
      }),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp template send failed (${response.status}): ${result.error?.message || 'Meta API request failed'}`);
  }
  return { simulated: false, messageId: result.messages?.[0]?.id || null };
};
