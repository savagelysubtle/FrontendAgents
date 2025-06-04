import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile } from '../../types';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; linkTo?: string }> = ({ title, value, icon, linkTo }) => (
  <div className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border hover:shadow-modern-lg dark:hover:shadow-modern-lg transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-textSecondary">{title}</p>
        <p className="text-3xl font-bold text-textPrimary">{value}</p>
      </div>
      <div className="text-primary p-3 bg-primary-light/20 rounded-full">
        {icon}
      </div>
    </div>
    {linkTo && (
      <Link to={linkTo} className="text-sm text-primary hover:underline mt-4 block">
        View Details &rarr;
      </Link>
    )}
  </div>
);

const FileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const TagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>;
const ActivityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>;
const WcatDbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
const CompareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>;


const DashboardPage: React.FC = () => {
  const { files, tags, auditLog, wcatCases, setError } = useAppContext();
  const navigate = useNavigate();

  const [compareEvidenceFileId, setCompareEvidenceFileId] = useState<string>('');
  const [compareWcatCaseId, setCompareWcatCaseId] = useState<string>('');


  const recentFiles = files.slice(0, 5).sort((a, b) =>
    new Date(b.metadata.modifiedAt || b.metadata.createdAt || 0).getTime() -
    new Date(a.metadata.modifiedAt || a.metadata.createdAt || 0).getTime()
  );

  const flaggedEvidence = files.filter(f =>
    f.tags.some(t => ['admission', 'contradiction', 'omission'].includes(t.criteria || ''))
  ).slice(0,5);

  const recentWcatCases = wcatCases.sort((a,b) => new Date(b.ingestedAt).getTime() - new Date(a.ingestedAt).getTime()).slice(0,5);

  const handleStartComparison = () => {
    if (!compareEvidenceFileId || !compareWcatCaseId) {
      setError("Please select both an Evidence File and a WCAT Case to compare.");
      return;
    }
    navigate(`/compare/${compareEvidenceFileId}/${compareWcatCaseId}`);
  };


  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-textPrimary">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Evidence Files" value={files.length} icon={<FileIcon />} linkTo="/viewer" />
        <StatCard title="WCAT Precedents" value={wcatCases.length} icon={<WcatDbIcon />} linkTo="/wcat-database" />
        <StatCard title="Total Tags" value={tags.length} icon={<TagIcon />} linkTo="/tags" />
        <StatCard title="Recent Activities" value={auditLog.length > 0 ? auditLog.length : "0"} icon={<ActivityIcon />} linkTo="/settings" />
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
        <div className="flex items-center mb-4">
          <div className="text-primary p-2 bg-primary-light/20 rounded-full mr-3">
            <CompareIcon />
          </div>
          <h3 className="text-xl font-semibold text-textPrimary">Side-by-Side Comparison</h3>
        </div>
        {files.length > 0 && wcatCases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <label htmlFor="compare-evidence" className="block text-sm font-medium text-textSecondary">Evidence File</label>
              <select
                id="compare-evidence"
                value={compareEvidenceFileId}
                onChange={(e) => setCompareEvidenceFileId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="">Select Evidence File...</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="compare-wcat" className="block text-sm font-medium text-textSecondary">WCAT Case</label>
              <select
                id="compare-wcat"
                value={compareWcatCaseId}
                onChange={(e) => setCompareWcatCaseId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="">Select WCAT Case...</option>
                {wcatCases.map(wc => <option key={wc.id} value={wc.id}>{wc.decisionNumber} ({wc.year})</option>)}
              </select>
            </div>
            <button
              onClick={handleStartComparison}
              disabled={!compareEvidenceFileId || !compareWcatCaseId}
              className="md:col-span-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Compare Items
            </button>
          </div>
        ) : (
          <p className="text-textSecondary">
            You need at least one evidence file and one WCAT case to use the comparison tool.
            {files.length === 0 && <Link to="/ingestion" className="text-primary hover:underline"> Add evidence files.</Link>}
            {wcatCases.length === 0 && <Link to="/wcat-search" className="text-primary hover:underline"> Add WCAT cases.</Link>}
          </p>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
          <h3 className="text-xl font-semibold text-textPrimary mb-4">Recently Added WCAT Cases</h3>
          {recentWcatCases.length > 0 ? (
            <ul className="space-y-3">
              {recentWcatCases.map(wcase => (
                <li key={wcase.id} className="p-3 bg-background rounded-md hover:bg-primary-light/10">
                  <Link to={`/wcat-database/${wcase.decisionNumber}`} className="text-textPrimary hover:text-primary block mb-1">
                    {wcase.decisionNumber} ({wcase.year})
                  </Link>
                  <p className="text-xs text-textSecondary truncate" title={wcase.outcomeSummary}>{wcase.outcomeSummary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-textSecondary">No WCAT cases in database. <Link to="/wcat-search" className="text-primary hover:underline">Add some precedents</Link>.</p>
          )}
        </div>

        <div className="lg:col-span-1 bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
          <h3 className="text-xl font-semibold text-textPrimary mb-4">Recent Evidence Files</h3>
          {recentFiles.length > 0 ? (
            <ul className="space-y-3">
              {recentFiles.map(file => (
                <li key={file.id} className="flex justify-between items-center p-3 bg-background rounded-md hover:bg-primary-light/10">
                  <Link to={`/viewer/${file.id}`} className="text-textPrimary hover:text-primary">{file.name}</Link>
                  <span className="text-xs text-textSecondary">{new Date(file.metadata.modifiedAt || file.metadata.createdAt || Date.now()).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-textSecondary">No files yet. <Link to="/ingestion" className="text-primary hover:underline">Add some files</Link>.</p>
          )}
        </div>

        <div className="lg:col-span-1 bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
          <h3 className="text-xl font-semibold text-textPrimary mb-4">Flagged Evidence</h3>
          {flaggedEvidence.length > 0 ? (
            <ul className="space-y-3">
              {flaggedEvidence.map(file => (
                <li key={file.id} className="p-3 bg-background rounded-md hover:bg-primary-light/10">
                  <Link to={`/viewer/${file.id}`} className="text-textPrimary hover:text-primary block mb-1">{file.name}</Link>
                  <div className="flex flex-wrap gap-1">
                    {file.tags.filter(t => ['admission', 'contradiction', 'omission'].includes(t.criteria || '')).map(tag => (
                       <span key={tag.id} className={`text-xs px-2 py-0.5 rounded-full ${tag.color} text-white`}>{tag.name}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-textSecondary">No evidence flagged with critical criteria yet.</p>
          )}
        </div>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-4">
          <Link to="/ingestion" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
            Add New Evidence
          </Link>
          <Link to="/chat" className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary-dark transition-colors">
            Open AI Chat Agent
          </Link>
           <Link to="/search" className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">
            Search Evidence
          </Link>
          <Link to="/wcat-search" className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
            Search WCAT Cases
          </Link>
           <Link to="/policy-manual" className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors">
            View Policy Manual
          </Link>
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;