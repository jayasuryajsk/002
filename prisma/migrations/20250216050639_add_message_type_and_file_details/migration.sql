-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileDetails" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text';
