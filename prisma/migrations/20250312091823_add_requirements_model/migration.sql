/*
  Warnings:

  - You are about to drop the `PdfDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "PdfDocument";

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "pageReference" TEXT,
    "verificationStatus" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);
