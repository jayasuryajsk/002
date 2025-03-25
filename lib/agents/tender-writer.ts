import { AgentRole, AgentMessage, TenderDocument, TenderSection, SourceDocument } from './types'
import { RequirementsAnalyzer } from './requirements-analyzer'
// Commented out to disable auto-complete functionality
// import { PluginKey } from '@tiptap/pm/state'
import { marked } from 'marked' // Import marked for markdown conversion

// Commented out to disable auto-complete functionality
// const suggestionPluginKey = new PluginKey('suggestions')

// Helper to check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

export class TenderWriterAgent {
  private isWriting: boolean = false
  private currentDocument: TenderDocument | null = null
  private editor: any // TipTap editor instance
  private requirementsAnalyzer: RequirementsAnalyzer

  constructor(editor: any) {
    this.editor = editor
    this.requirementsAnalyzer = new RequirementsAnalyzer()
    
    // Only initialize documents in browser environment
    if (isBrowser) {
      // Load documents asynchronously but don't block constructor
      this.initializeDocuments()
    }
  }

  private async initializeDocuments() {
    try {
      console.log('Initializing TenderWriterAgent and loading documents...')
      
      // Load both document types in parallel for efficiency
      const [companyDocsResult, sourceDocsResult] = await Promise.allSettled([
        this.loadCompanyDocuments(),
        this.loadSourceDocuments()
      ])
      
      // Log any errors that occurred during loading
      if (companyDocsResult.status === 'rejected') {
        console.error('Failed to load company documents:', companyDocsResult.reason)
      }
      
      if (sourceDocsResult.status === 'rejected') {
        console.error('Failed to load source documents:', sourceDocsResult.reason)
      }
      
      console.log('Document initialization complete')
    } catch (error) {
      console.error('Error initializing documents:', error)
    }
  }

  private async loadCompanyDocuments() {
    if (!isBrowser) return
    
    try {
      // Use absolute URL with window.location.origin
      const url = `${window.location.origin}/api/tender/company-docs`
      const response = await fetch(url)
      if (!response.ok) {
        console.error('Failed to load company documents')
        return
      }
      
      const companyDocs = await response.json()
      for (const doc of companyDocs) {
        await this.requirementsAnalyzer.addCompanyDocument(doc)
      }
      
      console.log(`Loaded ${companyDocs.length} company documents`)
    } catch (error) {
      console.error('Error loading company documents:', error)
    }
  }

  private async loadSourceDocuments() {
    if (!isBrowser) return
    
    try {
      // Use absolute URL with window.location.origin
      const url = `${window.location.origin}/api/tender/sources`
      const response = await fetch(url)
      if (!response.ok) {
        console.error('Failed to load source documents')
        return
      }
      
      const sourceDocs = await response.json()
      for (const doc of sourceDocs) {
        await this.requirementsAnalyzer.addSource(doc)
      }
      
      console.log(`Loaded ${sourceDocs.length} source documents`)
    } catch (error) {
      console.error('Error loading source documents:', error)
    }
  }

  async startWriting(prompt: string) {
    if (!isBrowser) return
    
    this.isWriting = true
    
    // Commented out to disable auto-complete functionality
    // Disable suggestions while agent is writing
    // this.editor.view.dispatch(
    //   this.editor.view.state.tr.setMeta(suggestionPluginKey, { clear: true })
    // )

    try {
      // Initialize new tender document
      this.currentDocument = {
        id: crypto.randomUUID(),
        title: '',
        sections: [],
        compliance: {
          requirements: [],
          checklist: {}
        }
      }

      console.log('Starting tender generation process...')
      
      // First, analyze all source documents
      console.log(`Analyzing ${this.requirementsAnalyzer.getSources().length} source documents...`)
      const requirementsAnalysis = await this.requirementsAnalyzer.analyzeRequirements()
      console.log('Requirements analysis completed')
      
      // Then, analyze company documents
      console.log(`Analyzing ${this.requirementsAnalyzer.getCompanyDocs().length} company documents...`)
      const companyCapabilities = await this.requirementsAnalyzer.analyzeCompanyDocuments()
      console.log('Company capabilities analysis completed')

      if (this.requirementsAnalyzer.getSources().length === 0) {
        console.warn('No source documents found. Tender may lack specific requirements.')
      }

      if (this.requirementsAnalyzer.getCompanyDocs().length === 0) {
        console.warn('No company documents found. Tender may lack company-specific capabilities.')
      }

      // Start streaming the tender content with requirements analysis and company capabilities
      console.log('Sending request to generate tender...')
      const response = await fetch(`${window.location.origin}/api/tender/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to generate tender: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`Failed to generate tender: ${response.statusText}`)
      }

      console.log('Tender generation started, streaming response...')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        buffer += chunk

        // Process the markdown to HTML with proper formatting before setting content
        try {
          // Import the markdownToHtml function implementation from TipTapEditor
          // Pre-process the markdown to ensure proper spacing and formatting
          let processedMarkdown = buffer
            // Ensure proper spacing after heading markers
            .replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
            // Add extra newline before headings for better separation
            .replace(/^(#{1,6})/gm, '\n$1')
            // Ensure proper spacing after list markers
            .replace(/^(\s*[-*+])([^\s])/gm, '$1 $2')
            // Ensure space after ordered list markers
            .replace(/^(\s*\d+\.)([^\s])/gm, '$1 $2')
            // Add space between paragraphs if missing
            .replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
            // Ensure proper spacing around horizontal rules
            .replace(/^---/gm, '\n\n---\n\n');
          
          // Use marked library to convert markdown to HTML
          const html = marked.parse(processedMarkdown, {
            gfm: true,
            breaks: true
          });
          
          // Enhanced post-processing for better visual structure
          const formattedHtml = (html as string)
            // Add strong visual hierarchy with spacing and typography
            .replace(/<h1/g, '<h1 class="text-3xl font-bold mt-8 mb-4 pb-2 border-b"')
            .replace(/<h2/g, '<h2 class="text-2xl font-bold mt-6 mb-3 pt-2"')
            .replace(/<h3/g, '<h3 class="text-xl font-semibold mt-5 mb-2"')
            // Improve list formatting
            .replace(/<ul>/g, '<ul class="list-disc pl-6 my-4 space-y-2">')
            .replace(/<ol>/g, '<ol class="list-decimal pl-6 my-4 space-y-2">')
            .replace(/<li>/g, '<li class="ml-2 pl-2">')
            // Improve paragraph spacing
            .replace(/<p>/g, '<p class="my-3">')
            // Add styling for blockquotes
            .replace(/<blockquote>/g, '<blockquote class="pl-4 border-l-4 border-gray-300 my-4 italic">')
            // Improve table formatting
            .replace(/<table>/g, '<table class="min-w-full border-collapse my-4">')
            .replace(/<th>/g, '<th class="border px-4 py-2 bg-gray-100 font-semibold">')
            .replace(/<td>/g, '<td class="border px-4 py-2">');
            
          // Update editor content with properly formatted HTML
          this.editor.commands.setContent(formattedHtml);
        } catch (error) {
          console.error('Error converting markdown to HTML:', error);
          // Fallback to setting raw content if conversion fails
          this.editor.commands.setContent(`<div>${buffer}</div>`);
        }
      }

      console.log('Tender generation completed successfully')
      
      // Parse the final content into structured sections
      this.parseContent(buffer)

    } catch (error) {
      console.error('Error in tender generation:', error)
      throw error
    } finally {
      this.isWriting = false
      
      // Commented out to disable auto-complete functionality
      // Re-enable suggestions after agent is done
      // this.editor.view.dispatch(
      //   this.editor.view.state.tr.setMeta(suggestionPluginKey, { add: true })
      // )
    }
  }

  async addSourceDocument(file: File) {
    if (!isBrowser) return
    
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${window.location.origin}/api/tender/sources`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to add source document')
    }

    const sourceDoc = await response.json()
    await this.requirementsAnalyzer.addSource(sourceDoc)
  }

  async addCompanyDocument(file: File) {
    if (!isBrowser) return
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'company')

    const response = await fetch(`${window.location.origin}/api/tender/company-docs`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to add company document')
    }

    const companyDoc = await response.json()
    await this.requirementsAnalyzer.addCompanyDocument(companyDoc)
  }

  private parseContent(content: string) {
    // Split content into sections based on headers
    const sections = content.split(/(?=#{1,3}\s)/)
    
    this.currentDocument!.sections = sections.map(section => {
      const [title, ...contentParts] = section.split('\n')
      return {
        title: title.replace(/^#{1,3}\s/, '').trim(),
        content: contentParts.join('\n').trim(),
        requirements: [], // To be filled by compliance agent
        status: 'draft'
      }
    })
  }

  getCurrentDocument(): TenderDocument | null {
    return this.currentDocument
  }

  isAgentWriting(): boolean {
    return this.isWriting
  }
} 