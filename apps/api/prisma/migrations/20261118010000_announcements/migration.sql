CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_active_createdAt_idx" ON "Announcement"("active", "createdAt");

CREATE TABLE "AccountDeletionToken" (
  "userId" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDeletionToken_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "AccountDeletionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccountDeletionToken_expiresAt_idx" ON "AccountDeletionToken"("expiresAt");
