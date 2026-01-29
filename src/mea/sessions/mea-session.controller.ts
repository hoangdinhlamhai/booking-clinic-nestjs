import {
    Controller,
    Post,
    Get,
    Put,
    Body,
    Param,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { MeaSessionService } from './mea-session.service';

/**
 * MEA Session Controller
 * 
 * Endpoints for managing examination sessions.
 */
@Controller('mea/sessions')
export class MeaSessionController {
    private readonly logger = new Logger(MeaSessionController.name);

    constructor(private readonly sessionService: MeaSessionService) { }

    /**
     * Create session from booking
     * 
     * POST /mea/sessions/booking
     */
    @Post('booking')
    async createFromBooking(
        @Body() body: { bookingId: string; chiefComplaint?: string },
    ) {
        if (!body.bookingId) {
            throw new BadRequestException('bookingId is required');
        }

        return this.sessionService.createSessionFromBooking(
            body.bookingId,
            body.chiefComplaint,
        );
    }

    /**
     * Create session from patient
     * 
     * POST /mea/sessions/patient
     */
    @Post('patient')
    async createFromPatient(
        @Body() body: { patientId: string; chiefComplaint?: string; visitId?: string },
    ) {
        if (!body.patientId) {
            throw new BadRequestException('patientId is required');
        }

        return this.sessionService.createSessionFromPatient(
            body.patientId,
            body.chiefComplaint,
            body.visitId,
        );
    }

    /**
     * Get session by ID
     * 
     * GET /mea/sessions/:id
     */
    @Get(':id')
    async getSession(@Param('id') id: string) {
        const session = await this.sessionService.getSessionById(id);
        if (!session) {
            throw new BadRequestException('Session not found');
        }
        return session;
    }

    /**
     * Get sessions by booking
     * 
     * GET /mea/sessions/booking/:bookingId
     */
    @Get('booking/:bookingId')
    async getSessionsByBooking(@Param('bookingId') bookingId: string) {
        return this.sessionService.getSessionsByBooking(bookingId);
    }

    /**
     * Get active sessions
     * 
     * GET /mea/sessions/active
     */
    @Get('active')
    async getActiveSessions() {
        return this.sessionService.getActiveSessions();
    }

    /**
     * Update session status
     * 
     * PUT /mea/sessions/:id/status
     */
    @Put(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
    ) {
        if (!body.status) {
            throw new BadRequestException('status is required');
        }

        return this.sessionService.updateSessionStatus(id, body.status);
    }

    /**
     * Get medical record for session
     * 
     * GET /mea/sessions/:id/medical-record
     */
    @Get(':id/medical-record')
    async getMedicalRecord(@Param('id') id: string) {
        return this.sessionService.getMedicalRecordBySession(id);
    }

    /**
     * Save medical record for session
     * 
     * POST /mea/sessions/:id/medical-record
     */
    @Post(':id/medical-record')
    async saveMedicalRecord(
        @Param('id') id: string,
        @Body() body: {
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
        return this.sessionService.saveMedicalRecord(id, body);
    }
}
