
import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Tag } from '../../types';
import { DEFAULT_TAG_COLOR } from '../../constants';
import Modal from '../ui/Modal';

const TagExplorerPage: React.FC = () => {
  const { tags, addTag, files, updateFile } = useAppContext(); // Assuming updateFile can modify a file's tags
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR.replace('bg-', '').replace('-500','')); // e.g. 'blue'
  const [newTagCriteria, setNewTagCriteria] = useState<Tag['criteria']>('other');

  const colorOptions = ['red', 'blue', 'green', 'yellow', 'indigo', 'purple', 'pink', 'gray'];
  const criteriaOptions: Tag['criteria'][] = ['admission', 'minimization', 'omission', 'contradiction', 'chronic pain', 'causation', 'other'];


  const handleAddTag = () => {
    if (newTagName.trim() === '') return;
    addTag({
      name: newTagName.trim(),
      color: `bg-${newTagColor}-500`,
      criteria: newTagCriteria
    });
    setNewTagName('');
    setNewTagColor(DEFAULT_TAG_COLOR.replace('bg-', '').replace('-500',''));
    setNewTagCriteria('other');
    setIsModalOpen(false);
  };

  const filesWithTag = (tagId: string) => {
    return files.filter(file => file.tags.some(t => t.id === tagId));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-textPrimary">Tag Explorer</h2>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
            Create New Tag
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-textSecondary text-center py-8">No tags created yet. Click "Create New Tag" to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map(tag => (
            <div key={tag.id} className={`p-4 rounded-lg shadow-lg border border-border bg-surface`}>
              <div className="flex justify-between items-start">
                <h3 className={`text-xl font-semibold mb-2 flex items-center`}>
                   <span className={`w-4 h-4 rounded-full mr-2 ${tag.color}`}></span> 
                   {tag.name}
                </h3>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-textSecondary px-2 py-0.5 rounded-full">{tag.criteria || 'other'}</span>
              </div>
              <p className="text-sm text-textSecondary mb-1">Color: <span className={tag.color}>{tag.color.replace('bg-','').replace('-500','')}</span></p>
              
              <div className="mt-3 pt-3 border-t border-border">
                <h4 className="text-sm font-medium text-textPrimary mb-1">Files with this tag ({filesWithTag(tag.id).length}):</h4>
                {filesWithTag(tag.id).length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-textSecondary max-h-20 overflow-y-auto">
                    {filesWithTag(tag.id).map(f => <li key={f.id}>{f.name}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-textSecondary">No files have this tag yet.</p>
                )}
              </div>
              {/* Add edit/delete functionality here if needed */}
            </div>
          ))}
        </div>
      )}
      
      <Modal title="Create New Tag" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        footer={
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-md text-textPrimary hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleAddTag} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">Create Tag</button>
            </div>
        }
      >
        <div className="space-y-4">
            <div>
                <label htmlFor="new-tag-name" className="block text-sm font-medium text-textSecondary">Tag Name</label>
                <input type="text" id="new-tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="e.g., Critical Admission"
                />
            </div>
            <div>
                <label htmlFor="new-tag-color" className="block text-sm font-medium text-textSecondary">Color</label>
                <select id="new-tag-color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                    {colorOptions.map(color => <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="new-tag-criteria" className="block text-sm font-medium text-textSecondary">Criteria</label>
                <select id="new-tag-criteria" value={newTagCriteria} onChange={(e) => setNewTagCriteria(e.target.value as Tag['criteria'])}
                     className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                    {criteriaOptions.map(crit => <option key={crit} value={crit}>{crit.charAt(0).toUpperCase() + crit.slice(1)}</option>)}
                </select>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default TagExplorerPage;
    