import { NextResponse } from 'next/server';
import { SourceDocument } from '@/lib/agents/types';
import * as fs from 'fs';
import * as path from 'path';

// Global variable declaration to match existing types
declare global {
  var sourceDocuments: SourceDocument[]
  var companyDocuments: SourceDocument[]
  var documentSummaries: Record<string, string>
}

// Local storage paths
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'local-storage');
const SOURCE_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'source-docs');
const COMPANY_DOCS_DIR = path.join(LOCAL_STORAGE_DIR, 'company-docs');

// Function to delete all files in a directory
const clearDirectory = (dirPath: string): number => {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  let deletedCount = 0;
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    try {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`Deleted file: ${filePath}`);
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
    }
  });
  
  return deletedCount;
};

export async function DELETE() {
  try {
    // Clear all global document arrays
    if (global.sourceDocuments) {
      const previousCount = global.sourceDocuments.length;
      global.sourceDocuments = [];
      console.log(`Cleared ${previousCount} source documents from global storage`);
    } else {
      console.log('Source documents array was already empty or undefined');
      global.sourceDocuments = [];
    }

    if (global.companyDocuments) {
      const previousCount = global.companyDocuments.length;
      global.companyDocuments = [];
      console.log(`Cleared ${previousCount} company documents from global storage`);
    } else {
      console.log('Company documents array was already empty or undefined');
      global.companyDocuments = [];
    }

    // Also clear document summaries
    if (global.documentSummaries) {
      const previousCount = Object.keys(global.documentSummaries).length;
      global.documentSummaries = {};
      console.log(`Cleared ${previousCount} document summaries from global storage`);
    } else {
      console.log('Document summaries object was already empty or undefined');
      global.documentSummaries = {};
    }
    
    // Delete all physical files from local storage
    console.log('Clearing physical files from local storage...');
    const sourcesDeleted = clearDirectory(SOURCE_DOCS_DIR);
    const companyDocsDeleted = clearDirectory(COMPANY_DOCS_DIR);
    console.log(`Deleted ${sourcesDeleted} files from source documents directory`);
    console.log(`Deleted ${companyDocsDeleted} files from company documents directory`);

    return NextResponse.json({ 
      success: true,
      message: 'All documents cleared from memory and local storage',
      deletedFiles: {
        sources: sourcesDeleted,
        companyDocs: companyDocsDeleted
      }
    });
  } catch (error) {
    console.error('Error clearing all documents:', error);
    return NextResponse.json(
      { error: 'Failed to clear all documents' },
      { status: 500 }
    );
  }
} 