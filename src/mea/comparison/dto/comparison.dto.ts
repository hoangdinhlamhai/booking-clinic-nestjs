/**
 * Comparison DTOs
 * 
 * Data transfer objects for AI vs Doctor comparison
 */

/**
 * SOAP Note structure
 */
export interface SoapNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
}

/**
 * AI Analysis Results
 */
export interface AiResults {
    soap: SoapNote;
    icdCodes: string[];
    medicalAdvice?: string;
    references?: string[];
}

/**
 * Doctor's Results
 */
export interface DoctorResults {
    soap: SoapNote;
    icdCodes: string[];
    treatment?: string;
}

/**
 * Comparison Result
 */
export interface ComparisonResult {
    matchScore: number;
    soapMatch: {
        subjective: number;
        objective: number;
        assessment: number;
        plan: number;
    };
    icdMatch: {
        exactMatches: string[];
        aiOnly: string[];
        doctorOnly: string[];
        score: number;
    };
    differences: string[];
}

/**
 * Submit Comparison DTO
 */
export class SubmitComparisonDto {
    sessionId?: string;
    medicalRecordId?: string;
    aiResults: AiResults;
    doctorResults: DoctorResults;
}
