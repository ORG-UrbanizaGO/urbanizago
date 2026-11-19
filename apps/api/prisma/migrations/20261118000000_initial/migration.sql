CREATE TYPE "Role" AS ENUM ('CITIZEN', 'ADMIN');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');

CREATE TYPE "OccurrenceStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDO');

CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

CREATE TYPE "ValidationStatus" AS ENUM ('PENDENTE', 'VALIDADA', 'REJEITADA');

CREATE TYPE "SanctionType" AS ENUM ('ADVERTENCIA', 'SUSPENSAO', 'BANIMENTO');

CREATE TYPE "SanctionStatus" AS ENUM ('ATIVA', 'EXPIRADA', 'REVERTIDA');

CREATE TYPE "AppealStatus" AS ENUM ('PENDENTE', 'ACEITO', 'NEGADO');

CREATE TYPE "DeletionStatus" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA');

CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TYPE "MedalLevel" AS ENUM ('BRONZE', 'PRATA', 'OURO');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CITIZEN',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "phone" TEXT,
  "avatar" TEXT,
  "neighborhood" TEXT,
  "hideFromRanking" BOOLEAN NOT NULL DEFAULT false,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "anonymizedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "device" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Secretariat" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Secretariat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretariatCategory" (
  "secretariatId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "SecretariatCategory_pkey" PRIMARY KEY ("secretariatId", "categoryId")
);

CREATE TABLE "Occurrence" (
  "id" TEXT NOT NULL,
  "sequence" SERIAL NOT NULL,
  "protocol" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "address" TEXT NOT NULL,
  "neighborhood" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "status" "OccurrenceStatus" NOT NULL DEFAULT 'ABERTO',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
  "secretariatId" TEXT,
  "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDENTE',
  "rejectionReason" TEXT,
  "duplicateOfId" TEXT,
  "validatedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Occurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccurrencePhoto" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OccurrencePhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccurrenceStatusHistory" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "previousStatus" "OccurrenceStatus",
  "newStatus" "OccurrenceStatus" NOT NULL,
  "observation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccurrenceStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccurrenceComment" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccurrenceComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccurrenceRating" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccurrenceRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRecipient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMP(3),
  "confirmationHash" TEXT,
  "confirmationExpiresAt" TIMESTAMP(3),
  "secretariatId" TEXT,
  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipientCategory" (
  "recipientId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "RecipientCategory_pkey" PRIMARY KEY ("recipientId", "categoryId")
);

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "occurrenceId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "occurrenceId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "pushStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "pushAttempts" INTEGER NOT NULL DEFAULT 0,
  "pushNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "authorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointsLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "occurrenceId" TEXT,
  "event" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedalDefinition" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "bronze" INTEGER NOT NULL,
  "silver" INTEGER NOT NULL,
  "gold" INTEGER NOT NULL,
  CONSTRAINT "MedalDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMedal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "medalId" TEXT NOT NULL,
  "level" "MedalLevel" NOT NULL,
  "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMedal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sanction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "type" "SanctionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "status" "SanctionStatus" NOT NULL DEFAULT 'ATIVA',
  "reversalReason" TEXT,
  CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SanctionAppeal" (
  "id" TEXT NOT NULL,
  "sanctionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDENTE',
  "response" TEXT,
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SanctionAppeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "status" "DeletionStatus" NOT NULL DEFAULT 'PENDENTE',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BannedEmailHash" (
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BannedEmailHash_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE "Setting" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

CREATE INDEX "User_neighborhood_idx" ON "User"("neighborhood");

CREATE UNIQUE INDEX "RefreshToken_hash_key" ON "RefreshToken"("hash");

CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

CREATE UNIQUE INDEX "PasswordResetToken_hash_key" ON "PasswordResetToken"("hash");

CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

CREATE UNIQUE INDEX "Secretariat_name_key" ON "Secretariat"("name");

CREATE INDEX "SecretariatCategory_categoryId_idx" ON "SecretariatCategory"("categoryId");

CREATE UNIQUE INDEX "Occurrence_sequence_key" ON "Occurrence"("sequence");

CREATE UNIQUE INDEX "Occurrence_protocol_key" ON "Occurrence"("protocol");

CREATE INDEX "Occurrence_status_createdAt_idx" ON "Occurrence"("status", "createdAt");

CREATE INDEX "Occurrence_categoryId_createdAt_idx" ON "Occurrence"("categoryId", "createdAt");

CREATE INDEX "Occurrence_neighborhood_createdAt_idx" ON "Occurrence"("neighborhood", "createdAt");

CREATE INDEX "Occurrence_latitude_longitude_idx" ON "Occurrence"("latitude", "longitude");

CREATE INDEX "Occurrence_userId_createdAt_idx" ON "Occurrence"("userId", "createdAt");

CREATE INDEX "Occurrence_secretariatId_idx" ON "Occurrence"("secretariatId");

CREATE INDEX "Occurrence_duplicateOfId_idx" ON "Occurrence"("duplicateOfId");

CREATE UNIQUE INDEX "OccurrencePhoto_storageKey_key" ON "OccurrencePhoto"("storageKey");

CREATE INDEX "OccurrencePhoto_occurrenceId_idx" ON "OccurrencePhoto"("occurrenceId");

CREATE INDEX "OccurrenceStatusHistory_occurrenceId_createdAt_idx" ON "OccurrenceStatusHistory"("occurrenceId", "createdAt");

CREATE INDEX "OccurrenceComment_occurrenceId_idx" ON "OccurrenceComment"("occurrenceId");

CREATE UNIQUE INDEX "OccurrenceRating_occurrenceId_key" ON "OccurrenceRating"("occurrenceId");

CREATE UNIQUE INDEX "NotificationRecipient_email_key" ON "NotificationRecipient"("email");

CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "Notification_pushStatus_pushNextAttemptAt_idx" ON "Notification"("pushStatus", "pushNextAttemptAt");

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

CREATE UNIQUE INDEX "PointsLedger_eventKey_key" ON "PointsLedger"("eventKey");

CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt");

CREATE INDEX "PointsLedger_occurrenceId_idx" ON "PointsLedger"("occurrenceId");

CREATE UNIQUE INDEX "MedalDefinition_code_key" ON "MedalDefinition"("code");

CREATE UNIQUE INDEX "UserMedal_userId_medalId_key" ON "UserMedal"("userId", "medalId");

CREATE INDEX "Sanction_userId_status_idx" ON "Sanction"("userId", "status");

CREATE INDEX "Sanction_status_endsAt_idx" ON "Sanction"("status", "endsAt");

CREATE UNIQUE INDEX "SanctionAppeal_sanctionId_key" ON "SanctionAppeal"("sanctionId");

CREATE INDEX "SanctionAppeal_status_createdAt_idx" ON "SanctionAppeal"("status", "createdAt");

CREATE INDEX "AccountDeletionRequest_status_effectiveAt_idx" ON "AccountDeletionRequest"("status", "effectiveAt");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretariatCategory" ADD CONSTRAINT "SecretariatCategory_secretariatId_fkey" FOREIGN KEY ("secretariatId") REFERENCES "Secretariat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretariatCategory" ADD CONSTRAINT "SecretariatCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_secretariatId_fkey" FOREIGN KEY ("secretariatId") REFERENCES "Secretariat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OccurrencePhoto" ADD CONSTRAINT "OccurrencePhoto_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccurrenceStatusHistory" ADD CONSTRAINT "OccurrenceStatusHistory_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccurrenceStatusHistory" ADD CONSTRAINT "OccurrenceStatusHistory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OccurrenceComment" ADD CONSTRAINT "OccurrenceComment_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccurrenceComment" ADD CONSTRAINT "OccurrenceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OccurrenceRating" ADD CONSTRAINT "OccurrenceRating_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccurrenceRating" ADD CONSTRAINT "OccurrenceRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_secretariatId_fkey" FOREIGN KEY ("secretariatId") REFERENCES "Secretariat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecipientCategory" ADD CONSTRAINT "RecipientCategory_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipientCategory" ADD CONSTRAINT "RecipientCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserMedal" ADD CONSTRAINT "UserMedal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMedal" ADD CONSTRAINT "UserMedal_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "MedalDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SanctionAppeal" ADD CONSTRAINT "SanctionAppeal_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SanctionAppeal" ADD CONSTRAINT "SanctionAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SanctionAppeal" ADD CONSTRAINT "SanctionAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Occurrence" ADD CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);

ALTER TABLE "OccurrenceRating" ADD CHECK ("score" BETWEEN 1 AND 5);

ALTER TABLE "MedalDefinition" ADD CHECK ("bronze" > 0 AND "bronze" < "silver" AND "silver" < "gold");
