-- CreateTable
CREATE TABLE "wa_phone_call_settings" (
    "businessPhoneId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "callIconVisibility" TEXT NOT NULL DEFAULT 'DEFAULT',
    "callIconCountries" JSONB,
    "callbackPermissionStatus" TEXT NOT NULL DEFAULT 'ENABLED',
    "callHours" JSONB,
    "voicemailConfig" JSONB,
    "voicemailMediaId" TEXT,
    "recordingDefaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recordingDefaultPurpose" VARCHAR(250) NOT NULL DEFAULT 'quality assurance and training',
    "transcriptionDefaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "transcriptionDefaultPurpose" VARCHAR(250) NOT NULL DEFAULT 'quality assurance and training',
    "announcementLanguage" TEXT NOT NULL DEFAULT 'en_US',
    "audioCodecs" JSONB,
    "srtpKeyExchange" TEXT NOT NULL DEFAULT 'DTLS',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_phone_call_settings_pkey" PRIMARY KEY ("businessPhoneId")
);

-- CreateTable
CREATE TABLE "wa_call_permissions" (
    "id" TEXT NOT NULL,
    "businessPhoneId" TEXT NOT NULL,
    "userWaId" TEXT NOT NULL,
    "userBsuid" TEXT,
    "permissionStatus" TEXT NOT NULL DEFAULT 'no_permission',
    "expirationTimestamp" BIGINT,
    "responseSource" TEXT,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "unansweredConsecutive" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_call_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_calls" (
    "id" TEXT NOT NULL,
    "wacid" TEXT NOT NULL,
    "businessPhoneId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "fromBsuid" TEXT,
    "toBsuid" TEXT,
    "status" TEXT NOT NULL,
    "startTime" BIGINT,
    "endTime" BIGINT,
    "duration" INTEGER,
    "bizOpaqueData" VARCHAR(512),
    "ctaPayload" VARCHAR(512),
    "deeplinkPayload" VARCHAR(512),
    "sdpAnswer" TEXT,
    "assignedAgentId" TEXT,
    "conversationId" TEXT,
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_call_recordings" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "wacid" TEXT NOT NULL,
    "metaMediaId" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mimeType" VARCHAR(64) NOT NULL DEFAULT 'audio/ogg; codecs=opus',
    "sha256" VARCHAR(128),
    "downloadStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_call_transcripts" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "wacid" TEXT NOT NULL,
    "metaDocumentId" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "detectedLanguage" VARCHAR(16),
    "confidence" DECIMAL(4,3),
    "duration" DECIMAL(8,2),
    "fullText" TEXT,
    "segments" JSONB,
    "downloadStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_call_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wa_call_permissions_businessPhoneId_userWaId_key" ON "wa_call_permissions"("businessPhoneId", "userWaId");

-- CreateIndex
CREATE UNIQUE INDEX "wa_calls_wacid_key" ON "wa_calls"("wacid");

-- AddForeignKey
ALTER TABLE "wa_call_recordings" ADD CONSTRAINT "wa_call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "wa_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_call_transcripts" ADD CONSTRAINT "wa_call_transcripts_callId_fkey" FOREIGN KEY ("callId") REFERENCES "wa_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
