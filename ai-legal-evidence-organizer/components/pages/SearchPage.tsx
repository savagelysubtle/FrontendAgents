
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile } from '../../types';

const SearchPage: React.FC = () => {
  const { files, tags } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Tag IDs
  const [searchType, setSearchType] = useState<'keyword' | 'tag' | 'metadata'>('keyword');
  // For metadata search
  const [authorSearch, setAuthorSearch] = useState('');
  const [dateSearch, setDateSearch] = useState(''); // Could be more complex with date pickers

  const filteredFiles = useMemo(() => {
    if (!searchTerm && selectedTags.length === 0 && !authorSearch && !dateSearch) return files; // Show all if no filter

    return files.filter(file => {
      let matches = true;

      if (searchType === 'keyword' && searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        matches = matches && (
          file.name.toLowerCase().includes(lowerSearchTerm) ||
          (file.summary && file.summary.toLowerCase().includes(lowerSearchTerm)) ||
          (file.content && file.type === 'txt' && file.content.toLowerCase().includes(lowerSearchTerm)) // Basic content search for txt
        );
      }
      
      if (searchType === 'tag' && selectedTags.length > 0) {
        matches = matches && selectedTags.every(tagId => file.tags.some(t => t.id === tagId));
      }

      if (searchType === 'metadata') {
          if (authorSearch) {
            matches = matches && (file.metadata.author?.toLowerCase().includes(authorSearch.toLowerCase()) || false);
          }
          if (dateSearch) { // Simple date string matching (YYYY-MM-DD)
            matches = matches && ((file.metadata.createdAt && file.metadata.createdAt.startsWith(dateSearch)) || (file.metadata.modifiedAt && file.metadata.modifiedAt.startsWith(dateSearch)) || false);
          }
      }
      return matches;
    });
  }, [files, searchTerm, selectedTags, searchType, authorSearch, dateSearch]);

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-textPrimary">Search Evidence</h2>

      <div className="bg-surface p-4 rounded-lg shadow border border-border space-y-4">
        <div className="flex space-x-2 border-b border-border pb-3 mb-3">
            { (['keyword', 'tag', 'metadata'] as const).map(type => (
                <button key={type} onClick={() => setSearchType(type)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${searchType === type ? 'bg-primary text-white' : 'text-textSecondary hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    {type.charAt(0).toUpperCase() + type.slice(1)} Search
                </button>
            ))}
        </div>

        {searchType === 'keyword' && (
            <input
            type="text"
            placeholder="Search by keyword in name, summary, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
        )}

        {searchType === 'tag' && (
            <div>
                <h4 className="text-textPrimary font-medium mb-2">Filter by Tags (AND logic):</h4>
                <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                    <button
                        key={tag.id}
                        onClick={() => handleTagToggle(tag.id)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors
                        ${selectedTags.includes(tag.id) ? `${tag.color} text-white border-transparent` : 'bg-background text-textPrimary border-border hover:border-primary'} `}
                    >
                        {tag.name}
                    </button>
                    ))}
                </div>
                {tags.length === 0 && <p className="text-xs text-textSecondary">No tags available to filter by.</p>}
            </div>
        )}

        {searchType === 'metadata' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    placeholder="Search by Author..."
                    value={authorSearch}
                    onChange={(e) => setAuthorSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                    type="date" // Or text with YYYY-MM-DD format hint
                    placeholder="Search by Date (YYYY-MM-DD)..."
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold text-textPrimary mb-3">
            Results ({filteredFiles.length} found)
        </h3>
        {filteredFiles.length > 0 ? (
          <ul className="space-y-3">
            {filteredFiles.map(file => (
              <li key={file.id} className="bg-surface p-4 rounded-lg shadow border border-border hover:shadow-md transition-shadow">
                <Link to={`/viewer/${file.id}`} className="font-semibold text-primary hover:underline text-lg block mb-1">{file.name}</Link>
                <p className="text-xs text-textSecondary mb-1">Type: {file.type} | Modified: {new Date(file.metadata.modifiedAt || file.metadata.createdAt || 0).toLocaleDateString()}</p>
                {file.summary && <p className="text-sm text-textSecondary truncate mb-2">{file.summary}</p>}
                <div className="flex flex-wrap gap-1">
                    {file.tags.map(tag => (
                         <span key={tag.id} className={`text-xs px-2 py-0.5 rounded-full ${tag.color} text-white`}>{tag.name}</span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-textSecondary text-center py-8">No files match your search criteria.</p>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
    