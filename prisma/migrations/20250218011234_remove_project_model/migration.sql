/*
  Warnings:

  - You are about to drop the column `projectId` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the `File` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_projectId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_projectId_fkey";

-- DropIndex
DROP INDEX "Chat_projectId_idx";

-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "projectId";

-- DropTable
DROP TABLE "File";

-- DropTable
DROP TABLE "Project";
