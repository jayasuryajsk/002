// Script to clean up all documents in the local storage
const fs = require('fs');
const path = require('path');

const sourceDocs = path.join(process.cwd(), 'local-storage', 'source-docs');

console.log(`Cleaning up documents in ${sourceDocs}...`);

try {
  // Get all files in the directory
  const files = fs.readdirSync(sourceDocs);
  console.log(`Found ${files.length} files to delete`);
  
  // Delete each file
  let deletedCount = 0;
  for (const file of files) {
    const filePath = path.join(sourceDocs, file);
    fs.unlinkSync(filePath);
    deletedCount++;
    console.log(`Deleted: ${file}`);
  }
  
  console.log(`Successfully deleted ${deletedCount} files`);
} catch (error) {
  console.error('Error cleaning up documents:', error);
} 