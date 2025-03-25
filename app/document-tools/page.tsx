import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentSearch } from '@/components/DocumentSearch';

export default function DocumentToolsPage() {
  return (
    <div className="container mx-auto py-10 space-y-10">
      <h1 className="text-3xl font-bold text-center mb-10">Document Management</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <DocumentUploader />
        </div>
        
        <div>
          <DocumentSearch />
        </div>
      </div>
    </div>
  );
} 