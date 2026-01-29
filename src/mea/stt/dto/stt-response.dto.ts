/**
 * STT Response DTOs
 * 
 * Data transfer objects for Speech-to-Text processing
 */

/**
 * Raw segment from Whisper STT
 */
export interface TranscriptSegment {
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
    /** Transcribed text */
    text: string;
}

/**
 * Processed segment with role detection and text fixing
 */
export interface ProcessedSegment {
    /** Speaker role: "Bác sĩ" or "Bệnh nhân" */
    role: string;
    /** Original transcribed text */
    raw_text: string;
    /** Cleaned text with medical terms fixed */
    clean_text: string;
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
}

/**
 * STT Processing Result
 */
export interface SttProcessingResult {
    success: boolean;
    segments: ProcessedSegment[];
    raw_text: string;
    num_speakers: number;
}
