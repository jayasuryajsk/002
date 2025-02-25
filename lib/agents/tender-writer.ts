import { AgentRole, AgentMessage, TenderDocument, TenderSection, SourceDocument } from './types'
import { RequirementsAnalyzer } from './requirements-analyzer'
import { PluginKey } from '@tiptap/pm/state'

const suggestionPluginKey = new PluginKey('suggestions')

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
    
    // Disable suggestions while agent is writing
    this.editor.view.dispatch(
      this.editor.view.state.tr.setMeta(suggestionPluginKey, { clear: true })
    )

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

        // Update editor content
        this.editor.commands.setContent(buffer)
      }

      console.log('Tender generation completed successfully')
      
      // Parse the final content into structured sections
      this.parseContent(buffer)

    } catch (error) {
      console.error('Error in tender generation:', error)
      throw error
    } finally {
      this.isWriting = false
      
      // Re-enable suggestions after agent is done
      this.editor.view.dispatch(
        this.editor.view.state.tr.setMeta(suggestionPluginKey, { add: true })
      )
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