# backend/rename-phase2a.ps1 (do not remove this comment)
# Phase 2A: Rename all files to entity.type.js convention
# Run from: backend/ directory
# Safe to run once. Will skip files that don't exist.

$ErrorActionPreference = "Continue"

Write-Host "=== PHASE 2A: FILE RENAMES ===" -ForegroundColor Cyan

# ──────────────────────────────────────────────
# PART 1: RENAME FILES
# ──────────────────────────────────────────────

$renames = @(
    # ── middlewares ──
    @{ Old = "src/middlewares/authMiddleware.js";             New = "src/middlewares/auth.middleware.js" }
    @{ Old = "src/middlewares/authSuperAdmin.js";             New = "src/middlewares/auth.superAdmin.js" }
    @{ Old = "src/middlewares/authTenant.js";                 New = "src/middlewares/auth.tenant.js" }
    @{ Old = "src/middlewares/authUser.js";                   New = "src/middlewares/auth.user.js" }
    @{ Old = "src/middlewares/authVerfyTenOrUser.js";         New = "src/middlewares/auth.verifyTenantOrUser.js" }
    @{ Old = "src/middlewares/bullBoardAuth.js";              New = "src/middlewares/auth.bullBoard.js" }
    @{ Old = "src/middlewares/checkSubscriptionAccess.js";    New = "src/middlewares/subscription.access.js" }
    @{ Old = "src/middlewares/templateUpload.middleware.js";  New = "src/middlewares/upload.template.js" }

    # ── config ──
    @{ Old = "src/config/bullBoard.js";          New = "src/config/bull.board.js" }
    @{ Old = "src/config/flowMediaUpload.js";    New = "src/config/upload.flowMedia.js" }
    @{ Old = "src/config/googleSheets.js";       New = "src/config/google.sheets.js" }
    @{ Old = "src/config/logoUpload.js";         New = "src/config/upload.logo.js" }
    @{ Old = "src/config/multerConfig.js";       New = "src/config/multer.js" }
    @{ Old = "src/config/ticketUpload.js";       New = "src/config/upload.ticket.js" }

    # ── lib ──
    @{ Old = "src/lib/metaErrorCodes.js";              New = "src/lib/meta.errorCodes.js" }
    @{ Old = "src/lib/planLimits.js";                  New = "src/lib/plan.limits.js" }
    @{ Old = "src/lib/constants/mediaConfig.js";       New = "src/lib/constants/media.config.js" }
    @{ Old = "src/lib/mediasoup/mediasoupConfig.js";   New = "src/lib/mediasoup/mediasoup.config.js" }
    @{ Old = "src/lib/mediasoup/mediasoupService.js";  New = "src/lib/mediasoup/mediasoup.service.js" }
    @{ Old = "src/lib/utils/mediaValidator.js";        New = "src/lib/utils/media.validator.js" }
    @{ Old = "src/lib/utils/requestMeta.js";           New = "src/lib/utils/request.meta.js" }
    @{ Old = "src/lib/utils/signedUrl.js";             New = "src/lib/utils/signed.url.js" }
    @{ Old = "src/lib/utils/whatsappMediaSender.js";   New = "src/lib/utils/whatsapp.mediaSender.js" }

    # ── activity ──
    @{ Old = "src/modules/activity/activityService.js"; New = "src/modules/activity/activity.service.js" }

    # ── admin-subscriptions ──
    @{ Old = "src/modules/admin-subscriptions/adminSubscriptionsController.js"; New = "src/modules/admin-subscriptions/adminSubscription.controller.js" }
    @{ Old = "src/modules/admin-subscriptions/adminSubscriptionsRoute.js";      New = "src/modules/admin-subscriptions/adminSubscription.routes.js" }

    # ── analytics ──
    @{ Old = "src/modules/analytics/analyticsController.js"; New = "src/modules/analytics/analytics.controller.js" }
    @{ Old = "src/modules/analytics/analyticsRoutes.js";     New = "src/modules/analytics/analytics.routes.js" }
    @{ Old = "src/modules/analytics/analyticsService.js";    New = "src/modules/analytics/analytics.service.js" }

    # ── audit ──
    @{ Old = "src/modules/audit/auditLogController.js"; New = "src/modules/audit/audit.controller.js" }
    @{ Old = "src/modules/audit/auditLogRoutes.js";     New = "src/modules/audit/audit.routes.js" }
    @{ Old = "src/modules/audit/auditLogService.js";    New = "src/modules/audit/audit.service.js" }

    # ── auth ──
    @{ Old = "src/modules/auth/emailService.js";        New = "src/modules/auth/email.service.js" }
    @{ Old = "src/modules/auth/jwtservice.js";          New = "src/modules/auth/jwt.service.js" }
    @{ Old = "src/modules/auth/passwordService.js";     New = "src/modules/auth/password.service.js" }
    @{ Old = "src/modules/auth/refreshtokenService.js"; New = "src/modules/auth/refreshToken.service.js" }

    # ── auto-reopen ──
    @{ Old = "src/modules/auto-reopen/autoReopenService.js"; New = "src/modules/auto-reopen/autoReopen.service.js" }
    @{ Old = "src/modules/auto-reopen/smartFilter.js";       New = "src/modules/auto-reopen/smart.filter.js" }

    # ── automation ──
    @{ Old = "src/modules/automation/faqService.js";         New = "src/modules/automation/faq.service.js" }
    @{ Old = "src/modules/automation/flowController.js";     New = "src/modules/automation/flow.controller.js" }
    @{ Old = "src/modules/automation/flowEngineService.js";  New = "src/modules/automation/flowEngine.service.js" }
    @{ Old = "src/modules/automation/flowMediaController.js"; New = "src/modules/automation/flowMedia.controller.js" }
    @{ Old = "src/modules/automation/flowRoutes.js";         New = "src/modules/automation/flow.routes.js" }
    @{ Old = "src/modules/automation/flowService.js";        New = "src/modules/automation/flow.service.js" }

    # ── billing ──
    @{ Old = "src/modules/billing/billingController.js"; New = "src/modules/billing/billing.controller.js" }
    @{ Old = "src/modules/billing/billingRoutes.js";     New = "src/modules/billing/billing.routes.js" }

    # ── broadcasts ──
    @{ Old = "src/modules/broadcasts/broadcastController.js";          New = "src/modules/broadcasts/broadcast.controller.js" }
    @{ Old = "src/modules/broadcasts/broadcastRoutes.js";              New = "src/modules/broadcasts/broadcast.routes.js" }
    @{ Old = "src/modules/broadcasts/broadcastService.js";             New = "src/modules/broadcasts/broadcast.service.js" }
    @{ Old = "src/modules/broadcasts/shopifyBroadcastSegmentService.js"; New = "src/modules/broadcasts/broadcast.shopifySegment.service.js" }
    @{ Old = "src/modules/broadcasts/wooBroadcastSegmentService.js";   New = "src/modules/broadcasts/broadcast.wooSegment.service.js" }

    # ── contacts ──
    @{ Old = "src/modules/contacts/contactController.js";    New = "src/modules/contacts/contact.controller.js" }
    @{ Old = "src/modules/contacts/contactCrudService.js";   New = "src/modules/contacts/contact.crud.service.js" }
    @{ Old = "src/modules/contacts/contactRoutes.js";        New = "src/modules/contacts/contact.routes.js" }
    @{ Old = "src/modules/contacts/queueService.js";         New = "src/modules/contacts/contact.queue.service.js" }
    @{ Old = "src/modules/contacts/tenantContactService.js"; New = "src/modules/contacts/contact.tenant.service.js" }
    @{ Old = "src/modules/contacts/userContactService.js";   New = "src/modules/contacts/contact.user.service.js" }

    # ── conversations ──
    @{ Old = "src/modules/conversations/conversationController.js"; New = "src/modules/conversations/conversation.controller.js" }
    @{ Old = "src/modules/conversations/conversationRouter.js";     New = "src/modules/conversations/conversation.routes.js" }
    @{ Old = "src/modules/conversations/conversationService.js";    New = "src/modules/conversations/conversation.service.js" }

    # ── enquiries ──
    @{ Old = "src/modules/enquiries/enquiryController.js"; New = "src/modules/enquiries/enquiry.controller.js" }
    @{ Old = "src/modules/enquiries/enquiryRoute.js";      New = "src/modules/enquiries/enquiry.routes.js" }

    # ── enterprise-leads ──
    @{ Old = "src/modules/enterprise-leads/enterpriseLeadAdminRoute.js"; New = "src/modules/enterprise-leads/enterpriseLead.admin.routes.js" }
    @{ Old = "src/modules/enterprise-leads/enterpriseLeadController.js"; New = "src/modules/enterprise-leads/enterpriseLead.controller.js" }
    @{ Old = "src/modules/enterprise-leads/enterpriseLeadRoute.js";      New = "src/modules/enterprise-leads/enterpriseLead.routes.js" }

    # ── google-sheets ──
    @{ Old = "src/modules/google-sheets/googleSheetsController.js"; New = "src/modules/google-sheets/googleSheets.controller.js" }
    @{ Old = "src/modules/google-sheets/googleSheetsRoutes.js";     New = "src/modules/google-sheets/googleSheets.routes.js" }
    @{ Old = "src/modules/google-sheets/googleSheetsService.js";    New = "src/modules/google-sheets/googleSheets.service.js" }

    # ── messages ──
    @{ Old = "src/modules/messages/mediaController.js";   New = "src/modules/messages/media.controller.js" }
    @{ Old = "src/modules/messages/mediaRoute.js";        New = "src/modules/messages/media.routes.js" }
    @{ Old = "src/modules/messages/messageController.js"; New = "src/modules/messages/message.controller.js" }
    @{ Old = "src/modules/messages/messageRoute.js";      New = "src/modules/messages/message.routes.js" }
    @{ Old = "src/modules/messages/messageService.js";    New = "src/modules/messages/message.service.js" }

    # ── notifications ──
    @{ Old = "src/modules/notifications/notificationController.js"; New = "src/modules/notifications/notification.controller.js" }
    @{ Old = "src/modules/notifications/notificationRoutes.js";     New = "src/modules/notifications/notification.routes.js" }
    @{ Old = "src/modules/notifications/notificationService.js";    New = "src/modules/notifications/notification.service.js" }

    # ── orders ──
    @{ Old = "src/modules/orders/orderController.js";    New = "src/modules/orders/order.controller.js" }
    @{ Old = "src/modules/orders/orderPaymentService.js"; New = "src/modules/orders/order.payment.service.js" }
    @{ Old = "src/modules/orders/orderRoutes.js";        New = "src/modules/orders/order.routes.js" }

    # ── plans ──
    @{ Old = "src/modules/plans/invoiceService.js";  New = "src/modules/plans/invoice.service.js" }
    @{ Old = "src/modules/plans/planController.js";  New = "src/modules/plans/plan.controller.js" }
    @{ Old = "src/modules/plans/planRoutes.js";      New = "src/modules/plans/plan.routes.js" }
    @{ Old = "src/modules/plans/planService.js";     New = "src/modules/plans/plan.service.js" }
    @{ Old = "src/modules/plans/planValidation.js";  New = "src/modules/plans/plan.schema.js" }

    # ── public ──
    @{ Old = "src/modules/public/publicRoutes.js"; New = "src/modules/public/public.routes.js" }

    # ── quick-replies ──
    @{ Old = "src/modules/quick-replies/quickReplyController.js";        New = "src/modules/quick-replies/quickReply.controller.js" }
    @{ Old = "src/modules/quick-replies/quickReplyRoute.js";             New = "src/modules/quick-replies/quickReply.routes.js" }
    @{ Old = "src/modules/quick-replies/quickReplyService.js";           New = "src/modules/quick-replies/quickReply.service.js" }
    @{ Old = "src/modules/quick-replies/quickReplyValidation.js";        New = "src/modules/quick-replies/quickReply.schema.js" }
    @{ Old = "src/modules/quick-replies/uploadQuickReply.middleware.js"; New = "src/modules/quick-replies/quickReply.upload.js" }

    # ── revenue ──
    @{ Old = "src/modules/revenue/revenueController.js"; New = "src/modules/revenue/revenue.controller.js" }
    @{ Old = "src/modules/revenue/revenueRoutes.js";     New = "src/modules/revenue/revenue.routes.js" }
    @{ Old = "src/modules/revenue/revenueService.js";    New = "src/modules/revenue/revenue.service.js" }

    # ── shopify ──
    @{ Old = "src/modules/shopify/shopifyBackInStockService.js";    New = "src/modules/shopify/shopify.backInStock.service.js" }
    @{ Old = "src/modules/shopify/shopifyCartRecoveryService.js";   New = "src/modules/shopify/shopify.cartRecovery.service.js" }
    @{ Old = "src/modules/shopify/shopifyController.js";            New = "src/modules/shopify/shopify.controller.js" }
    @{ Old = "src/modules/shopify/shopifyCustomerSyncService.js";   New = "src/modules/shopify/shopify.customerSync.service.js" }
    @{ Old = "src/modules/shopify/shopifyOAuthController.js";       New = "src/modules/shopify/shopify.oauth.controller.js" }
    @{ Old = "src/modules/shopify/shopifyOrderLifecycle.js";        New = "src/modules/shopify/shopify.orderLifecycle.js" }
    @{ Old = "src/modules/shopify/ShopifyOrderLookupService.js";    New = "src/modules/shopify/shopify.orderLookup.service.js" }
    @{ Old = "src/modules/shopify/shopifyPostPurchaseMessages.js";  New = "src/modules/shopify/shopify.postPurchaseMessages.js" }
    @{ Old = "src/modules/shopify/shopifyPostPurchaseService.js";   New = "src/modules/shopify/shopify.postPurchase.service.js" }
    @{ Old = "src/modules/shopify/shopifyProductController.js";     New = "src/modules/shopify/shopify.product.controller.js" }
    @{ Old = "src/modules/shopify/shopifyProductSyncService.js";    New = "src/modules/shopify/shopify.productSync.service.js" }
    @{ Old = "src/modules/shopify/shopifyRoutes.js";                New = "src/modules/shopify/shopify.routes.js" }
    @{ Old = "src/modules/shopify/shopifyService.js";               New = "src/modules/shopify/shopify.service.js" }
    @{ Old = "src/modules/shopify/shopifyWebhookController.js";     New = "src/modules/shopify/shopify.webhook.controller.js" }
    @{ Old = "src/modules/shopify/shopifyWebhookService.js";        New = "src/modules/shopify/shopify.webhook.service.js" }

    # ── superadmin ──
    @{ Old = "src/modules/superadmin/reportsController.js";    New = "src/modules/superadmin/reports.controller.js" }
    @{ Old = "src/modules/superadmin/reportsService.js";       New = "src/modules/superadmin/reports.service.js" }
    @{ Old = "src/modules/superadmin/superadminController.js"; New = "src/modules/superadmin/superadmin.controller.js" }
    @{ Old = "src/modules/superadmin/superadminRoute.js";      New = "src/modules/superadmin/superadmin.routes.js" }
    @{ Old = "src/modules/superadmin/superadminService.js";    New = "src/modules/superadmin/superadmin.service.js" }

    # ── tags ──
    @{ Old = "src/modules/tags/tagController.js";  New = "src/modules/tags/tag.controller.js" }
    @{ Old = "src/modules/tags/tagCrudService.js"; New = "src/modules/tags/tag.crud.service.js" }
    @{ Old = "src/modules/tags/tagRoutes.js";      New = "src/modules/tags/tag.routes.js" }

    # ── templates ──
    @{ Old = "src/modules/templates/templateController.js"; New = "src/modules/templates/template.controller.js" }
    @{ Old = "src/modules/templates/templateRoutes.js";     New = "src/modules/templates/template.routes.js" }
    @{ Old = "src/modules/templates/templateService.js";    New = "src/modules/templates/template.service.js" }

    # ── tenant ──
    @{ Old = "src/modules/tenant/razorpayOAuthController.js"; New = "src/modules/tenant/razorpay.oauth.controller.js" }
    @{ Old = "src/modules/tenant/razorpayTokenService.js";    New = "src/modules/tenant/razorpay.token.service.js" }
    @{ Old = "src/modules/tenant/tenantController.js";        New = "src/modules/tenant/tenant.controller.js" }
    @{ Old = "src/modules/tenant/tenantRoutes.js";            New = "src/modules/tenant/tenant.routes.js" }
    @{ Old = "src/modules/tenant/tenantService.js";           New = "src/modules/tenant/tenant.service.js" }

    # ── tickets ──
    @{ Old = "src/modules/tickets/adminTicketRoutes.js"; New = "src/modules/tickets/ticket.admin.routes.js" }
    @{ Old = "src/modules/tickets/ticketController.js";  New = "src/modules/tickets/ticket.controller.js" }
    @{ Old = "src/modules/tickets/ticketRoutes.js";      New = "src/modules/tickets/ticket.routes.js" }
    @{ Old = "src/modules/tickets/ticketService.js";     New = "src/modules/tickets/ticket.service.js" }

    # ── users ──
    @{ Old = "src/modules/users/userController.js"; New = "src/modules/users/user.controller.js" }
    @{ Old = "src/modules/users/userRoutes.js";     New = "src/modules/users/user.routes.js" }
    @{ Old = "src/modules/users/userService.js";    New = "src/modules/users/user.service.js" }

    # ── webhook ──
    @{ Old = "src/modules/webhook/dlqController.js";                    New = "src/modules/webhook/dlq.controller.js" }
    @{ Old = "src/modules/webhook/dlqRoutes.js";                        New = "src/modules/webhook/dlq.routes.js" }
    @{ Old = "src/modules/webhook/orderWebhookController.js";           New = "src/modules/webhook/order.webhook.controller.js" }
    @{ Old = "src/modules/webhook/razorpayWebhookController.js";        New = "src/modules/webhook/razorpay.webhook.controller.js" }
    @{ Old = "src/modules/webhook/shopifyWebhookController.js";         New = "src/modules/webhook/shopify.webhook.controller.js" }
    @{ Old = "src/modules/webhook/webhookController.js";                New = "src/modules/webhook/webhook.controller.js" }
    @{ Old = "src/modules/webhook/webhookRoutes.js";                    New = "src/modules/webhook/webhook.routes.js" }
    @{ Old = "src/modules/webhook/woocommerceAuthWebhookController.js"; New = "src/modules/webhook/woocommerce.auth.webhook.controller.js" }
    @{ Old = "src/modules/webhook/woocommerceAuthWebhookSecurity.js";   New = "src/modules/webhook/woocommerce.auth.webhook.security.js" }
    @{ Old = "src/modules/webhook/woocommerceAuthWebhookSecurity.test.js"; New = "src/modules/webhook/woocommerce.auth.webhook.security.test.js" }
    @{ Old = "src/modules/webhook/woocommerceCartWebhookController.js"; New = "src/modules/webhook/woocommerce.cart.webhook.controller.js" }
    @{ Old = "src/modules/webhook/woocommerceWebhookController.js";     New = "src/modules/webhook/woocommerce.webhook.controller.js" }

    # ── whatsapp ──
    @{ Old = "src/modules/whatsapp/callController.js";    New = "src/modules/whatsapp/call.controller.js" }
    @{ Old = "src/modules/whatsapp/callSocketHandler.js"; New = "src/modules/whatsapp/call.socket.js" }
    @{ Old = "src/modules/whatsapp/callWebhookHandler.js"; New = "src/modules/whatsapp/call.webhook.js" }
    @{ Old = "src/modules/whatsapp/whatsappController.js"; New = "src/modules/whatsapp/whatsapp.controller.js" }
    @{ Old = "src/modules/whatsapp/whatsappRoutes.js";     New = "src/modules/whatsapp/whatsapp.routes.js" }
    @{ Old = "src/modules/whatsapp/whatsappService.js";    New = "src/modules/whatsapp/whatsapp.service.js" }

    # ── woocommerce ──
    @{ Old = "src/modules/woocommerce/woocommerceAlertService.js";        New = "src/modules/woocommerce/woocommerce.alert.service.js" }
    @{ Old = "src/modules/woocommerce/woocommerceAuthMessageService.js";  New = "src/modules/woocommerce/woocommerce.authMessage.service.js" }
    @{ Old = "src/modules/woocommerce/woocommerceAuthMessageService.test.js"; New = "src/modules/woocommerce/woocommerce.authMessage.service.test.js" }
    @{ Old = "src/modules/woocommerce/woocommerceCartRecoveryService.js"; New = "src/modules/woocommerce/woocommerce.cartRecovery.service.js" }
    @{ Old = "src/modules/woocommerce/woocommerceController.js";          New = "src/modules/woocommerce/woocommerce.controller.js" }
    @{ Old = "src/modules/woocommerce/woocommerceOAuthController.js";     New = "src/modules/woocommerce/woocommerce.oauth.controller.js" }
    @{ Old = "src/modules/woocommerce/woocommerceOrderController.js";     New = "src/modules/woocommerce/woocommerce.order.controller.js" }
    @{ Old = "src/modules/woocommerce/woocommerceOrderLifecycle.js";      New = "src/modules/woocommerce/woocommerce.orderLifecycle.js" }
    @{ Old = "src/modules/woocommerce/woocommerceOrderLifecycle.test.js"; New = "src/modules/woocommerce/woocommerce.orderLifecycle.test.js" }
    @{ Old = "src/modules/woocommerce/woocommerceRoutes.js";              New = "src/modules/woocommerce/woocommerce.routes.js" }
    @{ Old = "src/modules/woocommerce/woocommerceService.js";             New = "src/modules/woocommerce/woocommerce.service.js" }

    # ── zoho ──
    @{ Old = "src/modules/zoho/zohoCaseService.js";      New = "src/modules/zoho/zoho.case.service.js" }
    @{ Old = "src/modules/zoho/zohoClient.js";           New = "src/modules/zoho/zoho.client.js" }
    @{ Old = "src/modules/zoho/zohoConstants.js";        New = "src/modules/zoho/zoho.constants.js" }
    @{ Old = "src/modules/zoho/zohoContactService.js";   New = "src/modules/zoho/zoho.contact.service.js" }
    @{ Old = "src/modules/zoho/zohoController.js";       New = "src/modules/zoho/zoho.controller.js" }
    @{ Old = "src/modules/zoho/zohoDealService.js";      New = "src/modules/zoho/zoho.deal.service.js" }
    @{ Old = "src/modules/zoho/zohoEventService.js";     New = "src/modules/zoho/zoho.event.service.js" }
    @{ Old = "src/modules/zoho/zohoInvoiceService.js";   New = "src/modules/zoho/zoho.invoice.service.js" }
    @{ Old = "src/modules/zoho/zohoLeadService.js";      New = "src/modules/zoho/zoho.lead.service.js" }
    @{ Old = "src/modules/zoho/zohoNoteService.js";      New = "src/modules/zoho/zoho.note.service.js" }
    @{ Old = "src/modules/zoho/zohoPlanService.js";      New = "src/modules/zoho/zoho.plan.service.js" }
    @{ Old = "src/modules/zoho/zohoProductService.js";   New = "src/modules/zoho/zoho.product.service.js" }
    @{ Old = "src/modules/zoho/zohoRoutes.js";           New = "src/modules/zoho/zoho.routes.js" }
    @{ Old = "src/modules/zoho/zohoService.js";          New = "src/modules/zoho/zoho.service.js" }
    @{ Old = "src/modules/zoho/zohoTaskService.js";      New = "src/modules/zoho/zoho.task.service.js" }
    @{ Old = "src/modules/zoho/zohoTriggerController.js"; New = "src/modules/zoho/zoho.trigger.controller.js" }
    @{ Old = "src/modules/zoho/zohoWebhookController.js"; New = "src/modules/zoho/zoho.webhook.controller.js" }
    @{ Old = "src/modules/zoho/zohoWebhookService.js";   New = "src/modules/zoho/zoho.webhook.service.js" }
)

$renameCount = 0
$skipCount = 0

foreach ($r in $renames) {
    if (Test-Path $r.Old) {
        Rename-Item -Path $r.Old -NewName (Split-Path $r.New -Leaf)
        $renameCount++
    } else {
        Write-Host "  SKIP (not found): $($r.Old)" -ForegroundColor Yellow
        $skipCount++
    }
}

Write-Host "Renamed: $renameCount | Skipped: $skipCount" -ForegroundColor Green

# ──────────────────────────────────────────────
# PART 2: RENAME SuperAdminNotifications FOLDER
# ──────────────────────────────────────────────

Write-Host "`n=== RENAMING SuperAdminNotifications FOLDER ===" -ForegroundColor Cyan

if (Test-Path "src/modules/SuperAdminNotifications") {
    # Rename files inside first
    Rename-Item "src/modules/SuperAdminNotifications/superAdminNotificationController.js" "superadminNotification.controller.js" -ErrorAction SilentlyContinue
    Rename-Item "src/modules/SuperAdminNotifications/superAdminNotificationRoutes.js" "superadminNotification.routes.js" -ErrorAction SilentlyContinue
    Rename-Item "src/modules/SuperAdminNotifications/superAdminNotificationService.js" "superadminNotification.service.js" -ErrorAction SilentlyContinue
    # Rename folder
    Rename-Item "src/modules/SuperAdminNotifications" "superadmin-notifications"
    Write-Host "  Folder renamed." -ForegroundColor Green
} else {
    Write-Host "  SKIP: Folder already renamed or not found." -ForegroundColor Yellow
}

# ──────────────────────────────────────────────
# PART 3: MOVE VALIDATIONS INTO MODULES
# ──────────────────────────────────────────────

Write-Host "`n=== MOVING VALIDATIONS INTO MODULES ===" -ForegroundColor Cyan

$validationMoves = @(
    @{ Old = "src/validations/auth.validation.js";       New = "src/modules/auth/auth.schema.js" }
    @{ Old = "src/validations/contact.validation.js";    New = "src/modules/contacts/contact.schema.js" }
    @{ Old = "src/validations/superAdmin.validation.js"; New = "src/modules/superadmin/superadmin.schema.js" }
    @{ Old = "src/validations/tenant.validation.js";     New = "src/modules/tenant/tenant.schema.js" }
    @{ Old = "src/validations/user.validation.js";       New = "src/modules/users/user.schema.js" }
    @{ Old = "src/validations/whatsapp.validation.js";   New = "src/modules/whatsapp/whatsapp.schema.js" }
)

foreach ($v in $validationMoves) {
    if (Test-Path $v.Old) {
        Move-Item -Path $v.Old -Destination $v.New -Force
        Write-Host "  Moved: $($v.Old) -> $($v.New)" -ForegroundColor Green
    }
}

# Remove empty validations folder
if (Test-Path "src/validations") {
    $remaining = Get-ChildItem "src/validations" -ErrorAction SilentlyContinue
    if (-not $remaining) {
        Remove-Item "src/validations" -Force
        Write-Host "  Removed empty src/validations/ folder." -ForegroundColor Green
    }
}

# ──────────────────────────────────────────────
# PART 4: FIX ALL IMPORT PATHS
# ──────────────────────────────────────────────

Write-Host "`n=== FIXING IMPORT PATHS ===" -ForegroundColor Cyan

# Build replacement map: old filename -> new filename
# This catches ALL import formats (static, dynamic, star, etc.)
$importReplacements = [ordered]@{}

foreach ($r in $renames) {
    $oldName = Split-Path $r.Old -Leaf
    $newName = Split-Path $r.New -Leaf
    $importReplacements[$oldName] = $newName
}

# Add validation renames
$importReplacements["auth.validation.js"]       = "auth.schema.js"
$importReplacements["contact.validation.js"]    = "contact.schema.js"
$importReplacements["superAdmin.validation.js"] = "superadmin.schema.js"
$importReplacements["tenant.validation.js"]     = "tenant.schema.js"
$importReplacements["user.validation.js"]       = "user.schema.js"
$importReplacements["whatsapp.validation.js"]   = "whatsapp.schema.js"

# Add folder rename
$importReplacements["SuperAdminNotifications"]  = "superadmin-notifications"

# Get all JS files
$allFiles = Get-ChildItem -Path "src" -Filter "*.js" -Recurse
# Also include server.js and app.js at root level
$rootFiles = Get-ChildItem -Path "." -Filter "*.js" -Depth 0 | Where-Object { $_.Name -in @("server.js") }
$allFiles = @($allFiles) + @($rootFiles)

$filesChanged = 0

foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName -Raw
    if (-not $content) { continue }

    $original = $content

    foreach ($old in $importReplacements.Keys) {
        if ($content.Contains($old)) {
            $content = $content.Replace($old, $importReplacements[$old])
        }
    }

    # Fix validation import PATHS (directory changed, not just filename)
    # Pattern: ../../validations/xxx.schema.js -> correct relative path
    # This is context-dependent, so we fix the common patterns:
    $content = $content.Replace("../../validations/auth.schema.js", "../auth/auth.schema.js")
    $content = $content.Replace("../../validations/contact.schema.js", "./contact.schema.js")
    $content = $content.Replace("../../validations/superadmin.schema.js", "./superadmin.schema.js")
    $content = $content.Replace("../../validations/tenant.schema.js", "./tenant.schema.js")
    $content = $content.Replace("../../validations/user.schema.js", "../users/user.schema.js")
    $content = $content.Replace("../../validations/whatsapp.schema.js", "./whatsapp.schema.js")

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $filesChanged++
    }
}

Write-Host "Import paths updated in $filesChanged files." -ForegroundColor Green

Write-Host "`n=== PHASE 2A COMPLETE ===" -ForegroundColor Cyan
Write-Host "Next step: npm run dev" -ForegroundColor Yellow
Write-Host "If it starts clean, Phase 2A is done." -ForegroundColor Yellow