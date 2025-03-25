import { SourceDocument, CompanyDocument } from './agents/types';

declare global {
  // Define properly typed global variables for document storage
  var sourceDocuments: SourceDocument[];
  var companyDocuments: CompanyDocument[];
  var documentSummaries: Record<string, any>;
} 