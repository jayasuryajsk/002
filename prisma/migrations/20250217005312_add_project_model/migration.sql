/*
  Warnings:

  - You are about to drop the column `chatId` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `Note` table. All the data in the column will be lost.
  - Added the required column `conversationId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_chatId_fkey";

-- DropIndex
DROP INDEX "Note_chatId_idx";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "chatId",
DROP COLUMN "metadata",
DROP COLUMN "timestamp",
ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "category" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Note_messageId_idx" ON "Note"("messageId");

-- CreateIndex
CREATE INDEX "Note_conversationId_idx" ON "Note"("conversationId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
