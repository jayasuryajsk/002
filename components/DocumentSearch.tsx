'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from '@radix-ui/react-checkbox';
import { toast } from './ui/use-toast';

type SearchResult = {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
};

type SearchResponse = {
  results: SearchResult[];
  query: string;
  count: number;
  error?: string;
};

export function DocumentSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    docType: '',
    fileType: ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setIsSearching(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters: Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== '')
          ),
          limit: 10,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }
      
      setResults(data);
      
      if (data.count === 0) {
        toast({
          title: 'No Results Found',
          description: 'Try a different query or remove filters',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setResults({ results: [], query, count: 0, error: (error as Error).message });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => {
      // If this filter is already active, remove it, otherwise set it
      const newValue = prev[field as keyof typeof prev] === value ? '' : value;
      return { ...prev, [field]: newValue };
    });
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Document Search</h2>
      
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search-query">Search Query</Label>
          <Input
            id="search-query"
            type="text"
            placeholder="Enter your search query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Filters</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="source-filter" 
                checked={filters.docType === 'source'} 
                onCheckedChange={() => handleFilterChange('docType', 'source')}
              />
              <Label htmlFor="source-filter" className="text-sm">Source Documents</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="company-filter" 
                checked={filters.docType === 'company'} 
                onCheckedChange={() => handleFilterChange('docType', 'company')}
              />
              <Label htmlFor="company-filter" className="text-sm">Company Documents</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="pdf-filter" 
                checked={filters.fileType === 'pdf'} 
                onCheckedChange={() => handleFilterChange('fileType', 'pdf')}
              />
              <Label htmlFor="pdf-filter" className="text-sm">PDF Files</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="docx-filter" 
                checked={filters.fileType === 'docx'} 
                onCheckedChange={() => handleFilterChange('fileType', 'docx')}
              />
              <Label htmlFor="docx-filter" className="text-sm">Word Documents</Label>
            </div>
          </div>
        </div>
        
        <Button 
          type="submit" 
          disabled={!query || isSearching}
          className="w-full"
        >
          {isSearching ? 'Searching...' : 'Search Documents'}
        </Button>
      </form>
      
      {results && (
        <div className="mt-8">
          <h3 className="font-medium text-lg mb-4">
            Results {results.count > 0 ? `(${results.count})` : ''}
          </h3>
          
          {results.error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-md">
              {results.error}
            </div>
          ) : results.results.length > 0 ? (
            <div className="space-y-4">
              {results.results.map((result, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-md">
                  <div className="text-sm font-medium mb-1 flex justify-between">
                    <span>{result.metadata.title || 'Untitled'}</span>
                    <span className="text-xs text-gray-500">
                      Score: {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {result.metadata.docType === 'source' ? 'Source Document' : 'Company Document'} • 
                    {result.metadata.fileType.toUpperCase()}
                  </div>
                  <p className="text-sm">{result.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 text-gray-500 rounded-md">
              No results found for "{results.query}". Try a different search term or adjust your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
} 