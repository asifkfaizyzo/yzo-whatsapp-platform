
// 1. Fetch templates catalog from Meta Business Account (WABA)
export const fetchMetaTemplates = async (tenant) => {
  const url = `https://graph.facebook.com/v20.0/${tenant.whatsappWabaId}/message_templates?limit=100`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${tenant.whatsappAccessToken}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch templates from Meta');
  }

  const payload = await response.json();
  return payload.data || [];
};

// 2. Submit a new message template to Meta review pipeline
export const submitMetaTemplate = async (tenant, { name, category, language, components }) => {
  const url = `https://graph.facebook.com/v20.0/${tenant.whatsappWabaId}/message_templates`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      category,
      language,
      components
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Meta template submission failed');
  }

  return response.json();
};

// 3. Delete a template from WABA
export const deleteMetaTemplate = async (tenant, templateName) => {
  const url = `https://graph.facebook.com/v20.0/${tenant.whatsappWabaId}/message_templates?name=${templateName}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tenant.whatsappAccessToken}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Meta template deletion failed');
  }

  return response.json();
};