
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002'; // Example if image gen was needed

export const APP_NAME = 'AI Legal Evidence Organizer';

export const DEFAULT_TAG_COLOR = 'bg-blue-500';
export const DEFAULT_WCAT_PATTERN_TAG_COLOR = 'bg-purple-500';


export const FILE_TYPES_SUPPORTED = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'];

export const AI_ANALYSIS_PROMPT_PREFIX = 
`Analyze the following legal document text. Identify and extract "big fat markers" which include:
- Admissions of fact or liability
- Contradictions in statements or evidence
- Omissions of relevant policy, law, or facts
- Critical quotes or statements that are highly relevant to a legal case
- Instances of minimization of symptoms or impact
- Statements related to chronic pain
- Statements related to causation of an injury or condition

For each marker, provide the verbatim quote and a brief explanation of why it's a marker.
If possible, categorize the marker (e.g., Admission, Contradiction).
Present the analysis in a structured way.

Document Text:
"""
`;

export const AI_CHAT_SYSTEM_INSTRUCTION = `You are an AI legal assistant specializing in evidence organization and analysis for complex cases.
You have access to a collection of legal documents, their summaries, tags, annotations, WCAT precedent cases, and WorkSafeBC policy manuals.
Your goal is to help the user understand their evidence, find relevant information, draft arguments, and manage files.
Always refer to specific documents, WCAT cases (by decision number), or policy sections when possible.
When asked to perform file operations (rename, move, bundle), confirm with the user before suggesting the action.
Interpret "big fat markers" as: admissions, contradictions, policy/law omissions, critical quotes, minimizations, chronic pain references, causation statements.
When performing WCAT searches, inform the user about the scope (e.g., "Performing a deep search on WCAT...") and the steps involved (query expansion, pagination simulation, ingestion).
Provide feedback during long operations like bulk WCAT ingestion.
Be concise, clear, and helpful. Maintain context of the ongoing conversation and the user's case.
If you use Google Search grounding, you MUST list the source URLs.
When referencing WCAT cases, cite the decision number.`;

// WCAT & Policy Manual Constants
export const WCAT_BASE_URL = "https://www.wcat.bc.ca";
export const WCAT_SEARCH_URL_TEMPLATE = `${WCAT_BASE_URL}/home/search-past-decisions/?q={query}&start_date={startDate}&end_date={endDate}&classification={classification}&sortby=relevant`;
// Example: https://www.wcat.bc.ca/home/search-past-decisions/?q=stenosis&start_date=2020-01-01&end_date=2025-06-01&classification=noteworthy&sortby=relevant
export const WCAT_DECISION_PDF_URL_BASE = `${WCAT_BASE_URL}/research/decisions/`; // e.g., /research/decisions/2022/02/2022-00234.pdf (path structure varies)


export const AI_WCAT_CASE_EXTRACTION_PROMPT = (decisionNumber: string) =>
`Analyze the following text from WCAT decision ${decisionNumber}.
Extract the following information and return it as a JSON object matching the WcatCaseInfoExtracted interface:
{
  "decisionNumber": "${decisionNumber}", // string, already provided
  "year": "integer, year of the decision",
  "applicantIdentifier": "string, anonymized if possible (e.g., 'Worker', 'Applicant', or initials if present and seems anonymized, otherwise null)",
  "outcomeSummary": "string, a concise summary of the main outcome or decision (e.g., 'Appeal allowed', 'Claim denied for...', 'Matter remitted')",
  "referencedPolicies": [ // Array of PolicyReference objects
    // { "policyNumber": "string, e.g., C3-16.00", "policyTitle": "string, if discernible, e.g., Chronic Pain Policy", "manualVersion": "string, e.g., RSCM II, if discernible" }
  ],
  "keywords": [ // Array of strings, key legal or medical terms found, e.g., "chronic pain", "spondylosis", "credibility", "section 5(1)"
  ],
  "keyQuotes": [ // Array of objects { "quote": "string, verbatim key quote", "page": "integer, if discernible", "context": "string, brief context of the quote" }
    // Limit to 3-5 most impactful quotes.
  ],
  "aiSummary": "string, a comprehensive AI-generated summary of the entire case facts, arguments, and reasoning (200-300 words)."
}

Focus on accuracy and conciseness. If a field is not clearly determinable, omit it or use null where appropriate for optional string fields in the JSON structure.
Ensure all policy numbers are correctly formatted (e.g., C3-16.00, AP1-2-1).

Document Text:
"""
`;

export const POLICY_NUMBER_REGEX = /(\b[A-Za-z]{1,3}\d{1,2}-\d{1,2}(?:\.\d{1,2})?\b)/g; // General pattern like C3-16.00 or AP1-2-1


export const AI_WCAT_QUERY_EXPANSION_PROMPT = (userQuery: string) =>
`Expand the following legal search query for WCAT (Workers' Compensation Appeal Tribunal of BC) decisions.
Identify key concepts and generate a more comprehensive list of search terms including synonyms, related legal phrases, and relevant WorkSafeBC policy numbers or keywords.
Return the expanded query as a single string, suitable for a search engine.
User Query: "${userQuery}"
Expanded Query:
`;

export const AI_WCAT_PATTERN_IDENTIFICATION_PROMPT = (caseText: string) =>
`Analyze the provided WCAT case text. Identify and extract key legal arguments, factual patterns, or procedural issues.
Focus on patterns like (but not limited to):
- Pre-existing conditions influencing outcome
- Omission or mischaracterization of medical evidence
- Conflicts between treating physician opinions and Board consultant opinions
- Application/misapplication of specific policies (cite policy number if evident)
- Credibility findings and their impact
- Sufficiency of evidence arguments
- Causation arguments (e.g., material contribution)

Return a JSON array of concise strings, where each string describes a distinct pattern or key finding. Max 5-7 patterns.
Example JSON output: ["Pre-existing condition acknowledged but found not to be sole cause", "Board medical advisor opinion preferred over treating specialist", "Policy C3-16.00 (Chronic Pain) applied"]

Case Text:
"""
${caseText}
"""
JSON Output:
`;

export const AI_POLICY_MANUAL_INDEXING_PROMPT = (manualName: string) =>
`Analyze the following text extracted from the policy manual "${manualName}".
Identify all distinct policy sections or entries. For each entry, extract:
1.  The full policy number (e.g., "C3-16.00", "AP1-2-1").
2.  A concise title for the policy entry, if one is clearly associated with the number.
3.  The page number where this policy entry likely begins, if discernible from the text structure (look for page indicators like "Page X of Y" or explicit page numbers near policy headings).
4.  A brief, relevant snippet (1-2 sentences) of text immediately following or describing the policy number/title.

Return the findings as a JSON array of objects, where each object matches the PolicyEntry interface:
{
  "policyNumber": "string",
  "title": "string, optional",
  "page": "integer, optional",
  "snippet": "string, optional"
}

Focus on accuracy. If a field (like title, page, or snippet) isn't clear for a specific policy number, omit it or use null where appropriate for optional fields in the JSON structure.
Prioritize capturing as many policy numbers as possible.

Manual Text:
"""
`;


// Token Counter Constants
export const SIMULATED_CONTEXT_WINDOW_TOKENS = 1_000_000; // Increased to simulate a million token window
export const SIMULATED_TOKEN_WARNING_THRESHOLD = SIMULATED_CONTEXT_WINDOW_TOKENS * 0.80; // 80% threshold