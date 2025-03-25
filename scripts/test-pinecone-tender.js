// Test script for generating tender documents with Pinecone
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the PineconeOrchestrator directly
const { PineconeOrchestrator } = require('../lib/agents/pinecone-orchestrator');

async function testTenderGeneration() {
  try {
    console.log('Initializing PineconeOrchestrator...');
    const orchestrator = new PineconeOrchestrator();
    
    // Define sample tender generation options
    const options = {
      title: 'School Construction Project Tender',
      sections: [
        {
          title: 'Executive Summary',
          query: 'school construction project overview'
        },
        {
          title: 'Company Profile',
          query: 'construction company capabilities experience'
        },
        {
          title: 'Project Approach',
          query: 'school construction methodology approach'
        },
        {
          title: 'Timeline and Milestones',
          query: 'construction project timeline milestones'
        },
        {
          title: 'Budget and Pricing',
          query: 'construction project budget pricing'
        }
      ]
    };
    
    console.log(`Starting tender generation for "${options.title}"`);
    console.log('Sections to generate:');
    options.sections.forEach(section => console.log(`- ${section.title}`));
    
    // Generate the tender document
    console.log('\nGenerating tender document...');
    const result = await orchestrator.generateTender(options);
    
    if (!result.success) {
      console.error('Failed to generate tender:', result.message);
      return;
    }
    
    console.log('\nTender generation completed successfully!');
    
    // Save the tender document to a markdown file
    const tender = result.tender;
    let markdownContent = `# ${tender.title}\n\n`;
    
    // Add each section
    for (const section of tender.sections) {
      markdownContent += `## ${section.title}\n\n`;
      markdownContent += `${section.content}\n\n`;
      
      // Add section requirements if available
      if (section.requirements && section.requirements.length > 0) {
        markdownContent += '### Requirements\n\n';
        section.requirements.forEach((req, i) => {
          markdownContent += `${i + 1}. ${req}\n`;
        });
        markdownContent += '\n';
      }
    }
    
    // Add footer
    markdownContent += '---\n\nGenerated using Pinecone vector search and AI agents.\n';
    
    // Save to file
    const outputDir = path.join(process.cwd(), 'generated-tenders');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileName = `${tender.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.md`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, markdownContent, 'utf8');
    console.log(`\nTender document saved to: ${filePath}`);
    
    // Print a preview
    console.log('\nPreview of the first section:');
    if (tender.sections.length > 0) {
      const firstSection = tender.sections[0];
      console.log(`## ${firstSection.title}`);
      
      // Print first 500 chars of content
      const preview = firstSection.content.substring(0, 500);
      console.log(preview + (firstSection.content.length > 500 ? '...' : ''));
    } else {
      console.log('No sections generated.');
    }
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test
testTenderGeneration().catch(console.error); 