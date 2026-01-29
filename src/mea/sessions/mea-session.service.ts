import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * MEA Session Service
 * 
 * Manages examination sessions using Prisma.
 * Adapted from MEA's session service (was using Drizzle).
 */
@Injectable()
export class MeaSessionService {
    private readonly logger = new Logger(MeaSessionService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create session from booking (Primary method)
     * 
     * @param bookingId The booking ID to create session for
     * @param chiefComplaint Optional chief complaint text
     */
    async createSessionFromBooking(bookingId: string, chiefComplaint?: string) {
        this.logger.log(`📋 Creating session for booking: ${bookingId}`);

        // Get visit number for this booking
        const existingSessions = await this.prisma.examinationSession.count({
            where: { bookingId },
        });

        const visitNumber = existingSessions + 1;

        // Create session
        const session = await this.prisma.examinationSession.create({
            data: {
                bookingId,
                visitNumber,
                chiefComplaint: chiefComplaint || null,
                status: 'active',
            },
            include: {
                booking: true,
            },
        });

        this.logger.log(`✅ Session created: ${session.id} (Visit #${visitNumber})`);
        return session;
    }

    /**
     * Create session from patient (Legacy method)
     */
    async createSessionFromPatient(
        patientId: string,
        chiefComplaint?: string,
        visitId?: string,
    ) {
        this.logger.log(`📋 Creating session for patient: ${patientId}`);

        // Get visit number for this patient
        const existingSessions = await this.prisma.examinationSession.count({
            where: { patientId },
        });

        const visitNumber = existingSessions + 1;

        // Create session
        const session = await this.prisma.examinationSession.create({
            data: {
                patientId,
                visitNumber,
                chiefComplaint: chiefComplaint || null,
                visitId: visitId || null,
                status: 'active',
            },
            include: {
                patient: true,
            },
        });

        this.logger.log(`✅ Session created: ${session.id} (Visit #${visitNumber})`);
        return session;
    }

    /**
     * Get session by ID
     */
    async getSessionById(sessionId: string) {
        return this.prisma.examinationSession.findUnique({
            where: { id: sessionId },
            include: {
                booking: true,
                patient: true,
                medicalRecords: true,
            },
        });
    }

    /**
     * Get sessions by booking ID
     */
    async getSessionsByBooking(bookingId: string) {
        return this.prisma.examinationSession.findMany({
            where: { bookingId },
            orderBy: { createdAt: 'desc' },
            include: {
                medicalRecords: true,
            },
        });
    }

    /**
     * Update session status
     */
    async updateSessionStatus(sessionId: string, status: string) {
        return this.prisma.examinationSession.update({
            where: { id: sessionId },
            data: { status },
        });
    }

    /**
     * Get active sessions (for dashboard)
     */
    async getActiveSessions() {
        return this.prisma.examinationSession.findMany({
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            include: {
                booking: true,
                patient: true,
            },
        });
    }

    /**
     * Get medical record by session ID
     */
    async getMedicalRecordBySession(sessionId: string) {
        return this.prisma.medicalRecord.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Create or update medical record for a session
     */
    async saveMedicalRecord(
        sessionId: string,
        data: {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
            icdCodes?: string[];
            diagnosis?: string;
            prescription?: string;
            status?: string;
        },
    ) {
        // Check if record exists
        const existing = await this.prisma.medicalRecord.findFirst({
            where: { sessionId },
        });

        if (existing) {
            // Update existing
            return this.prisma.medicalRecord.update({
                where: { id: existing.id },
                data: {
                    ...data,
                    icdCodes: data.icdCodes as any,
                },
            });
        } else {
            // Create new
            return this.prisma.medicalRecord.create({
                data: {
                    sessionId,
                    diagnosis: data.diagnosis || data.assessment || '',
                    ...data,
                    icdCodes: data.icdCodes as any,
                },
            });
        }
    }
}
