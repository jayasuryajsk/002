// Script to generate a tender using company documents from Pinecone
require('dotenv').config();
const { PineconeOrchestrator } = require('../lib/agents/pinecone-orchestrator');
const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const tenderTitle = args.find(arg => !arg.startsWith('--')) || 'Sample Tender';
const useCompanyDocs = !args.includes('--no-company-docs');
const verbose = args.includes('--verbose');

// Configure logging
const log = {
  info: (message) => console.log(`INFO: ${message}`),
  debug: (message) => verbose && console.log(`DEBUG: ${message}`),
  error: (message, error) => console.error(`ERROR: ${message}`, error || '')
};

// Helper function to save tender document to file
async function saveTenderToFile(tender) {
  try {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create a safe filename from the title
    const safeTitle = tender.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `tender-${safeTitle}-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Save the tender data
    fs.writeFileSync(filepath, JSON.stringify(tender, null, 2), 'utf8');
    
    log.info(`Tender saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    log.error('Failed to save tender:', error);
    return null;
  }
}

// Helper function to save tender sections as markdown
async function saveTenderMarkdown(tender) {
  try {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create a safe filename from the title
    const safeTitle = tender.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `tender-${safeTitle}-${timestamp}.md`;
    const filepath = path.join(outputDir, filename);
    
    // Create markdown content
    let markdownContent = `# ${tender.title}\n\n`;
    markdownContent += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    
    if (tender.useCompanyDocs) {
      markdownContent += `*Using company documents: Yes*\n\n`;
    }
    
    // Add each section
    tender.sections.forEach(section => {
      markdownContent += `${section.content}\n\n`;
      
      // Add requirements for this section
      if (section.requirements && section.requirements.length > 0) {
        markdownContent += `### Requirements\n\n`;
        section.requirements.forEach(req => {
          markdownContent += `- ${req}\n`;
        });
        markdownContent += `\n`;
      }
      
      markdownContent += `---\n\n`;
    });
    
    // Save the markdown
    fs.writeFileSync(filepath, markdownContent, 'utf8');
    
    log.info(`Tender markdown saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    log.error('Failed to save tender markdown:', error);
    return null;
  }
}

// Define sample tender sections
const sampleTenderSections = [
  {
    title: "Executive Summary",
    query: "executive summary company overview business"
  },
  {
    title: "Company Profile",
    query: "company background history experience capabilities"
  },
  {
    title: "Technical Approach",
    query: "technical solution methodology approach"
  },
  {
    title: "Project Management",
    query: "project management process timeline milestones"
  },
  {
    title: "Quality Assurance",
    query: "quality assurance testing standards certification"
  },
  {
    title: "Past Performance",
    query: "past projects case studies client references"
  }
];

// Function to generate a tender document
async function generateTender() {
  try {
    log.info(`Starting tender generation: "${tenderTitle}"`);
    log.info(`Using company documents: ${useCompanyDocs ? 'Yes' : 'No'}`);
    
    // Initialize the orchestrator
    const orchestrator = new PineconeOrchestrator();
    
    // Generate the tender
    const result = await orchestrator.generateTender({
      title: tenderTitle,
      sections: sampleTenderSections,
      useCompanyDocs: useCompanyDocs
    });
    
    if (!result.success) {
      log.error('Tender generation failed:', result.message);
      return null;
    }
    
    log.info(`Successfully generated tender with ${result.tender.sections.length} sections`);
    
    // Save the tender
    const jsonPath = await saveTenderToFile(result.tender);
    const markdownPath = await saveTenderMarkdown(result.tender);
    
    return {
      tender: result.tender,
      jsonPath,
      markdownPath
    };
  } catch (error) {
    log.error('Error generating tender:', error);
    return null;
  }
}

// Show help if requested
if (args.includes('--help')) {
  console.log(`
Tender Generation Script

Usage:
  node generate-tender-with-company-docs.js [title] [options]

Arguments:
  title               Optional title for the tender (default: "Sample Tender")

Options:
  --help              Show this help message
  --no-company-docs   Generate tender without using company documents
  --verbose           Show more detailed logs

Examples:
  node generate-tender-with-company-docs.js "IT Services Proposal"
  node generate-tender-with-company-docs.js --no-company-docs
  `);
  process.exit(0);
}

// Run the script
generateTender()
  .then(result => {
    if (result) {
      console.log('✅ Tender generation completed successfully');
      console.log(`🔗 JSON: ${result.jsonPath}`);
      console.log(`📄 Markdown: ${result.markdownPath}`);
    } else {
      console.log('❌ Tender generation failed');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error during execution:', error);
    process.exit(1);
  }); 