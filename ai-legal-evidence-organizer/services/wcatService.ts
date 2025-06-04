
import { WcatSearchResultItem, WcatCase, WcatCaseInfoExtracted, PolicyReference } from '../types';
import { WCAT_SEARCH_URL_TEMPLATE, WCAT_DECISION_PDF_URL_BASE } from '../constants';
import { extractWcatCaseInfoFromText } from './geminiService'; // Assuming this will be enhanced
import { McpClient } from './McpClient'; // McpClient needed for saving PDF

// --- MOCK DATA & SIMULATION ---

const ALL_MOCK_WCAT_SEARCH_RESULTS: WcatSearchResultItem[] = [
  {
    decisionNumber: "2023-00101",
    title: "Decision No. WCAT-2023-00101 - Chronic Pain Application",
    pdfUrl: `${WCAT_DECISION_PDF_URL_BASE}2023/03/2023-00101.pdf`,
    snippet: "This case discusses the application of the Chronic Pain policy C3-16.00. The worker's appeal regarding chronic pain syndrome was partially allowed.",
    date: "2023-03-15",
  },
  {
    decisionNumber: "2022-05234",
    title: "Decision No. WCAT-2022-05234 - Spinal Stenosis and Pre-existing Conditions",
    pdfUrl: `${WCAT_DECISION_PDF_URL_BASE}2022/10/2022-05234.pdf`,
    snippet: "Appeal regarding spinal stenosis. The panel considered the impact of pre-existing degenerative disc disease on causation. Appeal dismissed.",
    date: "2022-10-20",
  },
  {
    decisionNumber: "2024-00001",
    title: "Decision No. WCAT-2024-00001 - PTSD and Workplace Events",
    pdfUrl: "https://www.wcat.bc.ca/research/decisions/2024/01/2024-00001.pdf",
    snippet: "Application concerning PTSD diagnosis resulting from a series of workplace incidents. Policy on psychological trauma C4-40.00 applied. Appeal allowed.",
    date: "2024-01-05",
  },
  {
    decisionNumber: "2023-00777",
    title: "Decision No. WCAT-2023-00777 - Omission of Medical Evidence",
    pdfUrl: `${WCAT_DECISION_PDF_URL_BASE}2023/08/2023-00777.pdf`,
    snippet: "Worker alleged that key medical reports from treating physician were not properly considered by the Board. Remitted for reconsideration.",
    date: "2023-08-22",
  },
  {
    decisionNumber: "2022-01230",
    title: "Decision No. WCAT-2022-01230 - Board Consultant vs Treating Physician",
    pdfUrl: `${WCAT_DECISION_PDF_URL_BASE}2022/04/2022-01230.pdf`,
    snippet: "Case examining conflicting medical opinions between the worker's long-term treating specialist and a Board medical advisor. Emphasis on weighing evidence.",
    date: "2022-04-11",
  }
];

const MOCK_PDF_TEXT_CONTENT: Record<string, string> = {
  "2023-00101": `WCAT DECISION 2023-00101\n\nThis is a mock text extraction for WCAT decision 2023-00101 concerning chronic pain. The Board's policy C3-16.00 was considered. The worker, identified as AB, appealed. Outcome: Appeal allowed in part. Key phrase: "substantial contribution to the disability". Keywords: chronic pain, C3-16.00, appeal. The decision was made in the year 2023. Full analysis showed that while some aspects of the claim were not supported, the chronic pain itself was work-related.`,
  "2022-05234": `WCAT DECISION 2022-05234\n\nMock text for WCAT-2022-05234 about spinal stenosis. Policy AP1-2-1 on pre-existing conditions was relevant. The applicant presented evidence. Outcome: Appeal dismissed. The panel found the pre-existing condition was the primary cause, and the work incident did not significantly aggravate it beyond natural progression. Quote: "The evidence does not support a causal link to the workplace incident for the degree of disability claimed." Year: 2022.`,
  "2024-00001": `WCAT DECISION 2024-00001\n\nThis document is a simulated text content for WCAT decision 2024-00001 regarding PTSD. Policy C4-40.00, Psychological Trauma, was reviewed. The applicant's claim was initially denied. Outcome: Appeal Allowed. The panel determined the events met the criteria for compensable psychological trauma. Keywords: PTSD, psychological trauma, C4-40.00. Year of decision: 2024. Important quote: "The cumulative effect of the workplace incidents led to the psychological injury."`,
  "2023-00777": `WCAT DECISION 2023-00777\n\nRegarding alleged omission of medical evidence. The worker argued that reports from Dr. Smith, treating physician, were not given due weight. Outcome: Matter remitted. The panel found that the Board did not sufficiently address specific findings in Dr. Smith's reports. Policy C1-1.00 (Principles of Adjudication) relevant. Year: 2023.`,
  "2022-01230": `WCAT DECISION 2022-01230\n\nCase focusing on conflicting medical opinions. Dr. Alpha (treating specialist) opined X, while Board Medical Advisor Dr. Beta opined Y. Outcome: Appeal allowed. The panel preferred Dr. Alpha's reasoning due to longitudinal knowledge of the worker and detailed clinical findings. Relevant policy: C1-1.00 (Principles of Adjudication), weighing evidence. Year: 2022.`,
};


export const searchWcatDecisions = async (
  query: string,
  startDate?: string,
  endDate?: string,
  classification?: string,
  isDeepSearch: boolean = false // Flag for deep search simulation
): Promise<WcatSearchResultItem[]> => {
  console.log(`Simulating WCAT search for: query='${query}', startDate='${startDate}', endDate='${endDate}', classification='${classification}', deepSearch='${isDeepSearch}'`);
  await new Promise(resolve => setTimeout(resolve, isDeepSearch ? 2000 : 1000)); // Simulate longer delay for deep search

  const queryLower = query.toLowerCase();
  
  let results = ALL_MOCK_WCAT_SEARCH_RESULTS.filter(item => 
    item.title.toLowerCase().includes(queryLower) || 
    item.snippet?.toLowerCase().includes(queryLower) ||
    item.decisionNumber.includes(query) ||
    (MOCK_PDF_TEXT_CONTENT[item.decisionNumber] || "").toLowerCase().includes(queryLower) // Search in mock content too
  );

  if (classification === "noteworthy") {
    // Simulate noteworthy filter if specific terms are present (highly simplified)
    if (queryLower.includes("stenosis") || queryLower.includes("chronic pain") || queryLower.includes("ptsd")) {
        // No change, results already filtered by query
    } else { // If no specific noteworthy term, return less for "noteworthy"
        results = results.slice(0, Math.floor(results.length / 2));
    }
  }
  
  // Simulate deep search returning more results (all available mocks if deep)
  if (isDeepSearch) {
    return results; // Return all matches from the full mock list
  }

  return results.length > 0 ? results.slice(0, 3) : []; // Return top 3 for normal search, or empty
};


export const fetchAndProcessWcatPdf = async (
  pdfUrl: string,
  decisionNumber: string,
  addAuditLogEntry: (action: string, details: string) => void,
  mcpClient: McpClient | null // Pass McpClient instance
): Promise<Partial<Omit<WcatCase, 'id' | 'ingestedAt'>>> => {
  console.log(`Simulating PDF processing for: ${decisionNumber} from ${pdfUrl}`);
  addAuditLogEntry('WCAT_PDF_FETCH_START', `Fetching WCAT PDF for ${decisionNumber} from ${pdfUrl}`);
  await new Promise(resolve => setTimeout(resolve, 1500)); 

  const rawTextContent = MOCK_PDF_TEXT_CONTENT[decisionNumber] || `Mock PDF text for ${decisionNumber}. Content not fully available for simulation. Policies: C1-1.00, C3-16.00. Outcome: Varies.`;
  
  if (!rawTextContent) {
    addAuditLogEntry('WCAT_PDF_FETCH_ERROR', `Mock PDF text not found for ${decisionNumber}.`);
    throw new Error(`Mock PDF text content not found for decision ${decisionNumber}`);
  }
  addAuditLogEntry('WCAT_PDF_TEXT_EXTRACTED', `Simulated text extraction complete for ${decisionNumber}. Length: ${rawTextContent.length}`);

  let mcpPath: string | undefined = undefined;
  if (mcpClient && mcpClient.ready) {
    try {
      // Simulate fetching actual PDF blob and saving it
      const simulatedPdfBlobContent = `SIMULATED_PDF_CONTENT_FOR_${decisionNumber}`; // In reality, this would be ArrayBuffer or Blob
      mcpPath = `/wcat_cases/${decisionNumber}.pdf`;
      const success = await mcpClient.writeFile(mcpPath, simulatedPdfBlobContent);
      if (success) {
        addAuditLogEntry('WCAT_PDF_SAVED_MCP', `Simulated PDF for ${decisionNumber} saved to MCP: ${mcpPath}`);
      } else {
        addAuditLogEntry('WCAT_PDF_SAVE_MCP_FAILED', `Failed to save simulated PDF for ${decisionNumber} to MCP: ${mcpPath}`);
        mcpPath = undefined; // Clear path if save failed
      }
    } catch (mcpError: any) {
      addAuditLogEntry('WCAT_PDF_SAVE_MCP_ERROR', `Error saving PDF for ${decisionNumber} to MCP: ${mcpError.message}`);
      mcpPath = undefined;
    }
  } else {
    addAuditLogEntry('WCAT_PDF_SAVE_MCP_SKIPPED', `MCP client not ready, skipped saving PDF for ${decisionNumber}.`);
  }

  try {
    const extractedInfo: WcatCaseInfoExtracted = await extractWcatCaseInfoFromText(rawTextContent, decisionNumber);
    addAuditLogEntry('WCAT_GEMINI_EXTRACTION_SUCCESS', `Gemini successfully extracted info for ${decisionNumber}.`);
    
    const casePartial: Partial<Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>> = { // tags will be added later
        decisionNumber: extractedInfo.decisionNumber,
        year: extractedInfo.year || new Date().getFullYear(),
        applicantIdentifier: extractedInfo.applicantIdentifier,
        outcomeSummary: extractedInfo.outcomeSummary || "Summary not extracted",
        referencedPolicies: extractedInfo.referencedPolicies || [],
        keywords: extractedInfo.keywords || [],
        keyQuotes: extractedInfo.keyQuotes || [],
        aiSummary: extractedInfo.aiSummary || "AI summary not generated.",
        fullPdfUrl: pdfUrl,
        rawTextContent: rawTextContent,
        mcpPath: mcpPath, // Include the MCP path
    };
    return casePartial;

  } catch (error: any) {
    addAuditLogEntry('WCAT_GEMINI_EXTRACTION_ERROR', `Gemini extraction failed for ${decisionNumber}: ${error.message}`);
    console.error(`Error processing WCAT PDF ${decisionNumber} with Gemini:`, error);
    throw new Error(`Failed to process WCAT PDF ${decisionNumber} with AI: ${error.message}`);
  }
};
