-- AlterTable
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_pkey" TO "audit_logs_pkey";

-- AlterTable
ALTER TABLE "auto_reopen_configs" RENAME CONSTRAINT "AutoReopenConfig_pkey" TO "auto_reopen_configs_pkey";

-- AlterTable
ALTER TABLE "broadcast_recipients" RENAME CONSTRAINT "BroadcastRecipient_pkey" TO "broadcast_recipients_pkey";

-- AlterTable
ALTER TABLE "broadcast_tags" RENAME CONSTRAINT "BroadcastTag_pkey" TO "broadcast_tags_pkey";

-- AlterTable
ALTER TABLE "broadcasts" RENAME CONSTRAINT "Broadcast_pkey" TO "broadcasts_pkey";

-- AlterTable
ALTER TABLE "cancellation_surveys" RENAME CONSTRAINT "CancellationSurvey_pkey" TO "cancellation_surveys_pkey";

-- AlterTable
ALTER TABLE "contact_provider_mappings" RENAME CONSTRAINT "ContactProviderMapping_pkey" TO "contact_provider_mappings_pkey";

-- AlterTable
ALTER TABLE "contact_tag_mappings" RENAME CONSTRAINT "ContactTagMapping_pkey" TO "contact_tag_mappings_pkey";

-- AlterTable
ALTER TABLE "contacts" RENAME CONSTRAINT "Contact_pkey" TO "contacts_pkey";

-- AlterTable
ALTER TABLE "conversation_activities" RENAME CONSTRAINT "ConversationActivity_pkey" TO "conversation_activities_pkey";

-- AlterTable
ALTER TABLE "conversations" RENAME CONSTRAINT "Conversation_pkey" TO "conversations_pkey";

-- AlterTable
ALTER TABLE "features" RENAME CONSTRAINT "Feature_pkey" TO "features_pkey";

-- AlterTable
ALTER TABLE "flow_nodes" RENAME CONSTRAINT "FlowNode_pkey" TO "flow_nodes_pkey";

-- AlterTable
ALTER TABLE "flows" RENAME CONSTRAINT "Flow_pkey" TO "flows_pkey";

-- AlterTable
ALTER TABLE "invoices" RENAME CONSTRAINT "Invoice_pkey" TO "invoices_pkey";

-- AlterTable
ALTER TABLE "keyword_triggers" RENAME CONSTRAINT "KeywordTrigger_pkey" TO "keyword_triggers_pkey";

-- AlterTable
ALTER TABLE "messages" RENAME CONSTRAINT "Message_pkey" TO "messages_pkey";

-- AlterTable
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_pkey" TO "notifications_pkey";

-- AlterTable
ALTER TABLE "order_items" RENAME CONSTRAINT "OrderItem_pkey" TO "order_items_pkey";

-- AlterTable
ALTER TABLE "orders" RENAME CONSTRAINT "Order_pkey" TO "orders_pkey";

-- AlterTable
ALTER TABLE "password_resets" RENAME CONSTRAINT "PasswordReset_pkey" TO "password_resets_pkey";

-- AlterTable
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_pkey" TO "payments_pkey";

-- AlterTable
ALTER TABLE "plan_features" RENAME CONSTRAINT "PlanFeature_pkey" TO "plan_features_pkey";

-- AlterTable
ALTER TABLE "plan_integrations" RENAME CONSTRAINT "PlanIntegration_pkey" TO "plan_integrations_pkey";

-- AlterTable
ALTER TABLE "quick_replies" RENAME CONSTRAINT "QuickReply_pkey" TO "quick_replies_pkey";

-- AlterTable
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "RefreshToken_pkey" TO "refresh_tokens_pkey";

-- AlterTable
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "SubscriptionPlan_pkey" TO "subscription_plans_pkey";

-- AlterTable
ALTER TABLE "subscription_reminders" RENAME CONSTRAINT "SubscriptionReminder_pkey" TO "subscription_reminders_pkey";

-- AlterTable
ALTER TABLE "super_admin_notifications" RENAME CONSTRAINT "SuperAdminNotification_pkey" TO "super_admin_notifications_pkey";

-- AlterTable
ALTER TABLE "super_admins" RENAME CONSTRAINT "SuperAdmin_pkey" TO "super_admins_pkey";

-- AlterTable
ALTER TABLE "tags" RENAME CONSTRAINT "Tag_pkey" TO "tags_pkey";

-- AlterTable
ALTER TABLE "templates" RENAME CONSTRAINT "Template_pkey" TO "templates_pkey";

-- AlterTable
ALTER TABLE "tenant_data_deletions" RENAME CONSTRAINT "TenantDataDeletion_pkey" TO "tenant_data_deletions_pkey";

-- AlterTable
ALTER TABLE "tenants" RENAME CONSTRAINT "Tenant_pkey" TO "tenants_pkey";

-- AlterTable
ALTER TABLE "ticket_messages" RENAME CONSTRAINT "TicketMessage_pkey" TO "ticket_messages_pkey";

-- AlterTable
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_pkey" TO "tickets_pkey";

-- AlterTable
ALTER TABLE "user_tag_mappings" RENAME CONSTRAINT "UserTagMapping_pkey" TO "user_tag_mappings_pkey";

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";

-- AlterTable
ALTER TABLE "webhook_events" RENAME CONSTRAINT "WebhookEvent_pkey" TO "webhook_events_pkey";

-- RenameForeignKey
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_tenantId_fkey" TO "audit_logs_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcast_recipients" RENAME CONSTRAINT "BroadcastRecipient_broadcastId_fkey" TO "broadcast_recipients_broadcastId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcast_recipients" RENAME CONSTRAINT "BroadcastRecipient_contactId_fkey" TO "broadcast_recipients_contactId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcast_tags" RENAME CONSTRAINT "BroadcastTag_broadcastId_fkey" TO "broadcast_tags_broadcastId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcast_tags" RENAME CONSTRAINT "BroadcastTag_tagId_fkey" TO "broadcast_tags_tagId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcasts" RENAME CONSTRAINT "Broadcast_createdById_fkey" TO "broadcasts_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "broadcasts" RENAME CONSTRAINT "Broadcast_templateId_fkey" TO "broadcasts_templateId_fkey";

-- RenameForeignKey
ALTER TABLE "broadcasts" RENAME CONSTRAINT "Broadcast_tenantId_fkey" TO "broadcasts_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "cancellation_surveys" RENAME CONSTRAINT "CancellationSurvey_tenantId_fkey" TO "cancellation_surveys_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "contact_provider_mappings" RENAME CONSTRAINT "ContactProviderMapping_contactId_fkey" TO "contact_provider_mappings_contactId_fkey";

-- RenameForeignKey
ALTER TABLE "contact_tag_mappings" RENAME CONSTRAINT "ContactTagMapping_contactId_fkey" TO "contact_tag_mappings_contactId_fkey";

-- RenameForeignKey
ALTER TABLE "contact_tag_mappings" RENAME CONSTRAINT "ContactTagMapping_tagId_fkey" TO "contact_tag_mappings_tagId_fkey";

-- RenameForeignKey
ALTER TABLE "contacts" RENAME CONSTRAINT "Contact_assignedTo_fkey" TO "contacts_assignedTo_fkey";

-- RenameForeignKey
ALTER TABLE "contacts" RENAME CONSTRAINT "Contact_tenantId_fkey" TO "contacts_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_activities" RENAME CONSTRAINT "ConversationActivity_conversationId_fkey" TO "conversation_activities_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "conversations" RENAME CONSTRAINT "Conversation_contactId_fkey" TO "conversations_contactId_fkey";

-- RenameForeignKey
ALTER TABLE "conversations" RENAME CONSTRAINT "Conversation_currentFlowId_fkey" TO "conversations_currentFlowId_fkey";

-- RenameForeignKey
ALTER TABLE "flow_nodes" RENAME CONSTRAINT "FlowNode_flowId_fkey" TO "flow_nodes_flowId_fkey";

-- RenameForeignKey
ALTER TABLE "flows" RENAME CONSTRAINT "Flow_tenantId_fkey" TO "flows_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "invoices" RENAME CONSTRAINT "Invoice_tenantId_fkey" TO "invoices_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "keyword_triggers" RENAME CONSTRAINT "KeywordTrigger_flowId_fkey" TO "keyword_triggers_flowId_fkey";

-- RenameForeignKey
ALTER TABLE "keyword_triggers" RENAME CONSTRAINT "KeywordTrigger_tenantId_fkey" TO "keyword_triggers_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "messages" RENAME CONSTRAINT "Message_conversationId_fkey" TO "messages_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "order_items" RENAME CONSTRAINT "OrderItem_orderId_fkey" TO "order_items_orderId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_contactId_fkey" TO "orders_contactId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_conversationId_fkey" TO "orders_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_tenantId_fkey" TO "orders_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_tenantId_fkey" TO "payments_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "plan_features" RENAME CONSTRAINT "PlanFeature_featureId_fkey" TO "plan_features_featureId_fkey";

-- RenameForeignKey
ALTER TABLE "plan_features" RENAME CONSTRAINT "PlanFeature_planId_fkey" TO "plan_features_planId_fkey";

-- RenameForeignKey
ALTER TABLE "plan_integrations" RENAME CONSTRAINT "PlanIntegration_planId_fkey" TO "plan_integrations_planId_fkey";

-- RenameForeignKey
ALTER TABLE "quick_replies" RENAME CONSTRAINT "QuickReply_tenantId_fkey" TO "quick_replies_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "quick_replies" RENAME CONSTRAINT "QuickReply_userId_fkey" TO "quick_replies_userId_fkey";

-- RenameForeignKey
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "RefreshToken_superAdminId_fkey" TO "refresh_tokens_superAdminId_fkey";

-- RenameForeignKey
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "RefreshToken_tenantId_fkey" TO "refresh_tokens_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "RefreshToken_userId_fkey" TO "refresh_tokens_userId_fkey";

-- RenameForeignKey
ALTER TABLE "subscription_reminders" RENAME CONSTRAINT "SubscriptionReminder_tenantId_fkey" TO "subscription_reminders_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "tags" RENAME CONSTRAINT "Tag_tenantId_fkey" TO "tags_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "templates" RENAME CONSTRAINT "Template_createdById_fkey" TO "templates_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "templates" RENAME CONSTRAINT "Template_tenantId_fkey" TO "templates_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_data_deletions" RENAME CONSTRAINT "TenantDataDeletion_tenantId_fkey" TO "tenant_data_deletions_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "tenants" RENAME CONSTRAINT "Tenant_planId_fkey" TO "tenants_planId_fkey";

-- RenameForeignKey
ALTER TABLE "ticket_messages" RENAME CONSTRAINT "TicketMessage_ticketId_fkey" TO "ticket_messages_ticketId_fkey";

-- RenameForeignKey
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_tenantId_fkey" TO "tickets_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_userId_fkey" TO "tickets_userId_fkey";

-- RenameForeignKey
ALTER TABLE "user_tag_mappings" RENAME CONSTRAINT "UserTagMapping_tagId_fkey" TO "user_tag_mappings_tagId_fkey";

-- RenameForeignKey
ALTER TABLE "user_tag_mappings" RENAME CONSTRAINT "UserTagMapping_tenantId_fkey" TO "user_tag_mappings_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "user_tag_mappings" RENAME CONSTRAINT "UserTagMapping_userId_fkey" TO "user_tag_mappings_userId_fkey";

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "User_tenantId_fkey" TO "users_tenantId_fkey";

-- RenameIndex
ALTER INDEX "AuditLog_action_idx" RENAME TO "audit_logs_action_idx";

-- RenameIndex
ALTER INDEX "AuditLog_actorId_idx" RENAME TO "audit_logs_actorId_idx";

-- RenameIndex
ALTER INDEX "AuditLog_actorType_createdAt_idx" RENAME TO "audit_logs_actorType_createdAt_idx";

-- RenameIndex
ALTER INDEX "AuditLog_actorType_idx" RENAME TO "audit_logs_actorType_idx";

-- RenameIndex
ALTER INDEX "AuditLog_createdAt_idx" RENAME TO "audit_logs_createdAt_idx";

-- RenameIndex
ALTER INDEX "AuditLog_module_action_idx" RENAME TO "audit_logs_module_action_idx";

-- RenameIndex
ALTER INDEX "AuditLog_module_idx" RENAME TO "audit_logs_module_idx";

-- RenameIndex
ALTER INDEX "AuditLog_tenantId_createdAt_idx" RENAME TO "audit_logs_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "AuditLog_tenantId_idx" RENAME TO "audit_logs_tenantId_idx";

-- RenameIndex
ALTER INDEX "AutoReopenConfig_tenantId_key" RENAME TO "auto_reopen_configs_tenantId_key";

-- RenameIndex
ALTER INDEX "BroadcastRecipient_broadcastId_contactId_key" RENAME TO "broadcast_recipients_broadcastId_contactId_key";

-- RenameIndex
ALTER INDEX "BroadcastRecipient_broadcastId_status_idx" RENAME TO "broadcast_recipients_broadcastId_status_idx";

-- RenameIndex
ALTER INDEX "BroadcastRecipient_status_idx" RENAME TO "broadcast_recipients_status_idx";

-- RenameIndex
ALTER INDEX "BroadcastRecipient_wamid_idx" RENAME TO "broadcast_recipients_wamid_idx";

-- RenameIndex
ALTER INDEX "BroadcastRecipient_wamid_key" RENAME TO "broadcast_recipients_wamid_key";

-- RenameIndex
ALTER INDEX "Broadcast_createdById_idx" RENAME TO "broadcasts_createdById_idx";

-- RenameIndex
ALTER INDEX "Broadcast_scheduledAt_idx" RENAME TO "broadcasts_scheduledAt_idx";

-- RenameIndex
ALTER INDEX "Broadcast_status_idx" RENAME TO "broadcasts_status_idx";

-- RenameIndex
ALTER INDEX "Broadcast_tenantId_idx" RENAME TO "broadcasts_tenantId_idx";

-- RenameIndex
ALTER INDEX "CancellationSurvey_tenantId_key" RENAME TO "cancellation_surveys_tenantId_key";

-- RenameIndex
ALTER INDEX "ContactProviderMapping_contactId_provider_key" RENAME TO "contact_provider_mappings_contactId_provider_key";

-- RenameIndex
ALTER INDEX "ContactProviderMapping_tenantId_provider_providerContactId_key" RENAME TO "contact_provider_mappings_tenantId_provider_providerContact_key";

-- RenameIndex
ALTER INDEX "ContactTagMapping_contactId_tagId_key" RENAME TO "contact_tag_mappings_contactId_tagId_key";

-- RenameIndex
ALTER INDEX "Contact_assignedTo_idx" RENAME TO "contacts_assignedTo_idx";

-- RenameIndex
ALTER INDEX "Contact_phone_tenantId_key" RENAME TO "contacts_phone_tenantId_key";

-- RenameIndex
ALTER INDEX "Contact_tenantId_channel_channelId_key" RENAME TO "contacts_tenantId_channel_channelId_key";

-- RenameIndex
ALTER INDEX "Contact_tenantId_channel_idx" RENAME TO "contacts_tenantId_channel_idx";

-- RenameIndex
ALTER INDEX "Contact_tenantId_createdAt_idx" RENAME TO "contacts_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "ConversationActivity_conversationId_idx" RENAME TO "conversation_activities_conversationId_idx";

-- RenameIndex
ALTER INDEX "Conversation_contactId_idx" RENAME TO "conversations_contactId_idx";

-- RenameIndex
ALTER INDEX "Conversation_contactId_key" RENAME TO "conversations_contactId_key";

-- RenameIndex
ALTER INDEX "Conversation_currentFlowId_idx" RENAME TO "conversations_currentFlowId_idx";

-- RenameIndex
ALTER INDEX "Conversation_tenantId_channel_idx" RENAME TO "conversations_tenantId_channel_idx";

-- RenameIndex
ALTER INDEX "Conversation_tenantId_isArchived_idx" RENAME TO "conversations_tenantId_isArchived_idx";

-- RenameIndex
ALTER INDEX "Conversation_tenantId_mode_idx" RENAME TO "conversations_tenantId_mode_idx";

-- RenameIndex
ALTER INDEX "Conversation_tenantId_status_idx" RENAME TO "conversations_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "Feature_name_key" RENAME TO "features_name_key";

-- RenameIndex
ALTER INDEX "FlowNode_flowId_idx" RENAME TO "flow_nodes_flowId_idx";

-- RenameIndex
ALTER INDEX "FlowNode_flowId_order_idx" RENAME TO "flow_nodes_flowId_order_idx";

-- RenameIndex
ALTER INDEX "Flow_tenantId_idx" RENAME TO "flows_tenantId_idx";

-- RenameIndex
ALTER INDEX "Flow_tenantId_isActive_idx" RENAME TO "flows_tenantId_isActive_idx";

-- RenameIndex
ALTER INDEX "Flow_tenantId_triggerType_idx" RENAME TO "flows_tenantId_triggerType_idx";

-- RenameIndex
ALTER INDEX "Invoice_invoiceNumber_key" RENAME TO "invoices_invoiceNumber_key";

-- RenameIndex
ALTER INDEX "KeywordTrigger_flowId_idx" RENAME TO "keyword_triggers_flowId_idx";

-- RenameIndex
ALTER INDEX "KeywordTrigger_tenantId_idx" RENAME TO "keyword_triggers_tenantId_idx";

-- RenameIndex
ALTER INDEX "KeywordTrigger_tenantId_keyword_idx" RENAME TO "keyword_triggers_tenantId_keyword_idx";

-- RenameIndex
ALTER INDEX "KeywordTrigger_tenantId_keyword_key" RENAME TO "keyword_triggers_tenantId_keyword_key";

-- RenameIndex
ALTER INDEX "Message_conversationId_createdAt_idx" RENAME TO "messages_conversationId_createdAt_idx";

-- RenameIndex
ALTER INDEX "Message_direction_idx" RENAME TO "messages_direction_idx";

-- RenameIndex
ALTER INDEX "Message_senderType_idx" RENAME TO "messages_senderType_idx";

-- RenameIndex
ALTER INDEX "Message_wamid_key" RENAME TO "messages_wamid_key";

-- RenameIndex
ALTER INDEX "Notification_isRead_idx" RENAME TO "notifications_isRead_idx";

-- RenameIndex
ALTER INDEX "Notification_tenantId_idx" RENAME TO "notifications_tenantId_idx";

-- RenameIndex
ALTER INDEX "Notification_userId_idx" RENAME TO "notifications_userId_idx";

-- RenameIndex
ALTER INDEX "OrderItem_orderId_idx" RENAME TO "order_items_orderId_idx";

-- RenameIndex
ALTER INDEX "OrderItem_tenantId_idx" RENAME TO "order_items_tenantId_idx";

-- RenameIndex
ALTER INDEX "Order_contactId_idx" RENAME TO "orders_contactId_idx";

-- RenameIndex
ALTER INDEX "Order_conversationId_idx" RENAME TO "orders_conversationId_idx";

-- RenameIndex
ALTER INDEX "Order_orderNumber_key" RENAME TO "orders_orderNumber_key";

-- RenameIndex
ALTER INDEX "Order_paymentStatus_idx" RENAME TO "orders_paymentStatus_idx";

-- RenameIndex
ALTER INDEX "Order_razorpayPaymentId_idx" RENAME TO "orders_razorpayPaymentId_idx";

-- RenameIndex
ALTER INDEX "Order_razorpayPaymentLinkId_idx" RENAME TO "orders_razorpayPaymentLinkId_idx";

-- RenameIndex
ALTER INDEX "Order_tenantId_status_idx" RENAME TO "orders_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "Order_wamid_key" RENAME TO "orders_wamid_key";

-- RenameIndex
ALTER INDEX "PasswordReset_token_key" RENAME TO "password_resets_token_key";

-- RenameIndex
ALTER INDEX "Payment_offlineReference_idx" RENAME TO "payments_offlineReference_idx";

-- RenameIndex
ALTER INDEX "Payment_razorpayPaymentId_key" RENAME TO "payments_razorpayPaymentId_key";

-- RenameIndex
ALTER INDEX "Payment_status_idx" RENAME TO "payments_status_idx";

-- RenameIndex
ALTER INDEX "Payment_tenantId_idx" RENAME TO "payments_tenantId_idx";

-- RenameIndex
ALTER INDEX "PlanFeature_featureId_idx" RENAME TO "plan_features_featureId_idx";

-- RenameIndex
ALTER INDEX "PlanFeature_planId_featureId_key" RENAME TO "plan_features_planId_featureId_key";

-- RenameIndex
ALTER INDEX "PlanFeature_planId_idx" RENAME TO "plan_features_planId_idx";

-- RenameIndex
ALTER INDEX "PlanIntegration_planId_idx" RENAME TO "plan_integrations_planId_idx";

-- RenameIndex
ALTER INDEX "PlanIntegration_planId_name_key" RENAME TO "plan_integrations_planId_name_key";

-- RenameIndex
ALTER INDEX "QuickReply_tenantId_category_idx" RENAME TO "quick_replies_tenantId_category_idx";

-- RenameIndex
ALTER INDEX "QuickReply_tenantId_scope_isActive_idx" RENAME TO "quick_replies_tenantId_scope_isActive_idx";

-- RenameIndex
ALTER INDEX "QuickReply_tenantId_shortcut_idx" RENAME TO "quick_replies_tenantId_shortcut_idx";

-- RenameIndex
ALTER INDEX "QuickReply_userId_idx" RENAME TO "quick_replies_userId_idx";

-- RenameIndex
ALTER INDEX "SubscriptionPlan_name_key" RENAME TO "subscription_plans_name_key";

-- RenameIndex
ALTER INDEX "SubscriptionPlan_status_idx" RENAME TO "subscription_plans_status_idx";

-- RenameIndex
ALTER INDEX "SuperAdminNotification_createdAt_idx" RENAME TO "super_admin_notifications_createdAt_idx";

-- RenameIndex
ALTER INDEX "SuperAdminNotification_isRead_idx" RENAME TO "super_admin_notifications_isRead_idx";

-- RenameIndex
ALTER INDEX "SuperAdmin_email_key" RENAME TO "super_admins_email_key";

-- RenameIndex
ALTER INDEX "Tag_name_tenantId_key" RENAME TO "tags_name_tenantId_key";

-- RenameIndex
ALTER INDEX "Tag_priority_idx" RENAME TO "tags_priority_idx";

-- RenameIndex
ALTER INDEX "Tag_tenantId_idx" RENAME TO "tags_tenantId_idx";

-- RenameIndex
ALTER INDEX "Template_category_idx" RENAME TO "templates_category_idx";

-- RenameIndex
ALTER INDEX "Template_metaTemplateId_key" RENAME TO "templates_metaTemplateId_key";

-- RenameIndex
ALTER INDEX "Template_name_language_tenantId_key" RENAME TO "templates_name_language_tenantId_key";

-- RenameIndex
ALTER INDEX "Template_status_idx" RENAME TO "templates_status_idx";

-- RenameIndex
ALTER INDEX "Template_tenantId_idx" RENAME TO "templates_tenantId_idx";

-- RenameIndex
ALTER INDEX "Tenant_email_key" RENAME TO "tenants_email_key";

-- RenameIndex
ALTER INDEX "Tenant_facebookId_key" RENAME TO "tenants_facebookId_key";

-- RenameIndex
ALTER INDEX "Tenant_googleId_key" RENAME TO "tenants_googleId_key";

-- RenameIndex
ALTER INDEX "Tenant_razorpayAccountId_idx" RENAME TO "tenants_razorpayAccountId_idx";

-- RenameIndex
ALTER INDEX "Tenant_razorpaySubscriptionId_key" RENAME TO "tenants_razorpaySubscriptionId_key";

-- RenameIndex
ALTER INDEX "Tenant_status_idx" RENAME TO "tenants_status_idx";

-- RenameIndex
ALTER INDEX "Tenant_whatsappPhoneId_idx" RENAME TO "tenants_whatsappPhoneId_idx";

-- RenameIndex
ALTER INDEX "TicketMessage_ticketId_idx" RENAME TO "ticket_messages_ticketId_idx";

-- RenameIndex
ALTER INDEX "Ticket_isEscalated_idx" RENAME TO "tickets_isEscalated_idx";

-- RenameIndex
ALTER INDEX "Ticket_status_idx" RENAME TO "tickets_status_idx";

-- RenameIndex
ALTER INDEX "Ticket_tenantId_idx" RENAME TO "tickets_tenantId_idx";

-- RenameIndex
ALTER INDEX "Ticket_ticketNumber_key" RENAME TO "tickets_ticketNumber_key";

-- RenameIndex
ALTER INDEX "UserTagMapping_tagId_idx" RENAME TO "user_tag_mappings_tagId_idx";

-- RenameIndex
ALTER INDEX "UserTagMapping_userId_idx" RENAME TO "user_tag_mappings_userId_idx";

-- RenameIndex
ALTER INDEX "UserTagMapping_userId_tagId_key" RENAME TO "user_tag_mappings_userId_tagId_key";

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "users_email_key";

-- RenameIndex
ALTER INDEX "WebhookEvent_createdAt_idx" RENAME TO "webhook_events_createdAt_idx";

-- RenameIndex
ALTER INDEX "WebhookEvent_processedAt_idx" RENAME TO "webhook_events_processedAt_idx";

-- RenameIndex
ALTER INDEX "WebhookEvent_provider_eventId_key" RENAME TO "webhook_events_provider_eventId_key";

-- RenameIndex
ALTER INDEX "WebhookEvent_tenantId_processedAt_idx" RENAME TO "webhook_events_tenantId_processedAt_idx";
