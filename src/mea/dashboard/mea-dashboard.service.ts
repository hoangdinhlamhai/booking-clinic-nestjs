import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * MEA Dashboard Service
 * 
 * Provides statistics and data for the MEA dashboard.
 * Adapted from MEA's dashboard service to use Prisma.
 */
@Injectable()
export class MeaDashboardService {
    private readonly logger = new Logger(MeaDashboardService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        const now = new Date();

        // Calculate date boundaries
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Today's sessions
        const todaySessions = await this.prisma.examinationSession.findMany({
            where: {
                createdAt: { gte: todayStart },
            },
        });

        const todayCompleted = todaySessions.filter(
            (s) => s.status === 'completed',
        ).length;
        const todayActive = todaySessions.filter(
            (s) => s.status === 'active',
        ).length;

        // This week's sessions
        const weekSessionsCount = await this.prisma.examinationSession.count({
            where: {
                createdAt: { gte: weekStart },
            },
        });

        // This week's new bookings
        const weekNewBookingsCount = await this.prisma.booking.count({
            where: {
                createdAt: { gte: weekStart },
            },
        });

        // This month's sessions
        const monthSessionsCount = await this.prisma.examinationSession.count({
            where: {
                createdAt: { gte: monthStart },
            },
        });

        // This month's new bookings
        const monthNewBookingsCount = await this.prisma.booking.count({
            where: {
                createdAt: { gte: monthStart },
            },
        });

        // Total counts
        const [totalBookings, totalSessions] = await Promise.all([
            this.prisma.booking.count(),
            this.prisma.examinationSession.count(),
        ]);

        return {
            today: {
                totalSessions: todaySessions.length,
                completedSessions: todayCompleted,
                activeSessions: todayActive,
            },
            thisWeek: {
                totalSessions: weekSessionsCount,
                newBookings: weekNewBookingsCount,
            },
            thisMonth: {
                totalSessions: monthSessionsCount,
                newBookings: monthNewBookingsCount,
            },
            total: {
                bookings: totalBookings,
                sessions: totalSessions,
            },
        };
    }

    /**
     * Get list of bookings ready for MEA examination
     * Only shows paid/confirmed bookings that have a future booking time
     */
    async getBookingsList(limit: number = 50, page: number = 1) {
        const skip = (page - 1) * limit;

        // Calculate start of today
        const now = new Date();
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );

        // Get bookings that are paid/confirmed and still valid
        const paidStatuses = ['paid', 'confirmed', 'approved'];

        const bookings = await this.prisma.booking.findMany({
            where: {
                status: { in: paidStatuses },
                bookingTime: { gte: todayStart },
            },
            orderBy: { bookingTime: 'desc' },
            skip,
            take: limit,
            include: {
                examinationSessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        // Transform to include session status
        const bookingsWithSummary = bookings.map((booking) => ({
            id: booking.id,
            displayId: booking.displayId,
            patientName: booking.patientName,
            patientPhone: booking.patientPhone,
            age: booking.age,
            gender: booking.gender,
            symptoms: booking.symptoms,
            bookingTime: booking.bookingTime,
            status: booking.status,
            hasSession: booking.examinationSessions.length > 0,
            sessionStatus: booking.examinationSessions[0]?.status || null,
        }));

        return bookingsWithSummary;
    }

    /**
     * Get recent comparison records for analytics
     */
    async getRecentComparisons(limit: number = 10) {
        return this.prisma.comparisonRecord.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                session: true,
                medicalRecord: true,
            },
        });
    }

    /**
     * Get average match score for comparisons
     */
    async getAverageMatchScore() {
        const result = await this.prisma.comparisonRecord.aggregate({
            _avg: {
                matchScore: true,
            },
        });

        return result._avg.matchScore || 0;
    }
}
