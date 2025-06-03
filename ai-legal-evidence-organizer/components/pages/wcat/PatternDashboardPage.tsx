
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../../contexts/AppContext';
import { PolicyReference } from '../../../types';

const PatternDashboardPage: React.FC = () => {
  const { wcatCases } = useAppContext();

  const policyCounts = useMemo(() => {
    const counts: Record<string, { count: number, policy: PolicyReference, caseIds: string[] }> = {};
    wcatCases.forEach(wcase => {
      wcase.referencedPolicies.forEach(polRef => {
        if (!counts[polRef.policyNumber]) {
          counts[polRef.policyNumber] = { count: 0, policy: polRef, caseIds: [] };
        }
        counts[polRef.policyNumber].count++;
        counts[polRef.policyNumber].caseIds.push(wcase.id);
      });
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [wcatCases]);

  const keywordCounts = useMemo(() => {
    const counts: Record<string, { count: number, keyword: string, caseIds: string[] }> = {};
    wcatCases.forEach(wcase => {
      wcase.keywords.forEach(kw => {
        const lowerKw = kw.toLowerCase();
        if (!counts[lowerKw]) {
          counts[lowerKw] = { count: 0, keyword: kw, caseIds: [] };
        }
        counts[lowerKw].count++;
        counts[lowerKw].caseIds.push(wcase.id);
      });
    });
    return Object.values(counts).filter(item => item.count > 1).sort((a, b) => b.count - a.count).slice(0, 20); // Top 20 recurring keywords
  }, [wcatCases]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-textPrimary">Pattern Dashboard (Simplified)</h2>
      <p className="text-textSecondary">
        This dashboard provides a basic overview of common patterns found in the WCAT precedent database.
        Future enhancements could include visual clustering and more advanced analytics.
      </p>

      {wcatCases.length === 0 ? (
         <p className="text-textSecondary text-center py-8">No WCAT cases in the database to analyze patterns. <Link to="/wcat-search" className="text-primary hover:underline">Add some cases</Link>.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-surface p-6 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-4">Most Referenced Policies</h3>
            {policyCounts.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                {policyCounts.slice(0,15).map(item => (
                    <li key={item.policy.policyNumber} className="text-sm p-2 border-b border-border last:border-b-0">
                    <Link to={`/policy-manual/${item.policy.policyNumber}`} className="font-medium text-primary hover:underline">
                        {item.policy.policyNumber} ({item.policy.policyTitle || 'N/A'})
                    </Link>
                    <span className="text-textSecondary float-right"> - {item.count} cases</span>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-textSecondary">No policies referenced yet or WCAT cases are not processed for policies.</p>
            )}
            </section>

            <section className="bg-surface p-6 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-4">Most Common Keywords</h3>
            {keywordCounts.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                {keywordCounts.map(item => (
                    <li key={item.keyword} className="text-sm p-2 border-b border-border last:border-b-0">
                    <span className="font-medium text-textPrimary">{item.keyword}</span>
                    <span className="text-textSecondary float-right"> - {item.count} cases</span>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-textSecondary">No common keywords found (or only unique keywords present).</p>
            )}
            </section>
        </div>
      )}
    </div>
  );
};

export default PatternDashboardPage;
