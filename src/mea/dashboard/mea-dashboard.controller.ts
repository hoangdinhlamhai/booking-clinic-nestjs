import { Controller, Get, Query, Logger } from '@nestjs/common';
import { MeaDashboardService } from './mea-dashboard.service';

/**
 * MEA Dashboard Controller
 * 
 * Endpoints for dashboard statistics and data.
 */
@Controller('mea/dashboard')
export class MeaDashboardController {
    private readonly logger = new Logger(MeaDashboardController.name);

    constructor(private readonly dashboardService: MeaDashboardService) { }

    /**
     * Get dashboard statistics
     * 
     * GET /mea/dashboard/stats
     */
    @Get('stats')
    async getStats() {
        this.logger.log('📊 Fetching dashboard stats');
        return this.dashboardService.getDashboardStats();
    }

    /**
     * Get bookings list for MEA
     * 
     * GET /mea/dashboard/bookings?page=1&limit=50
     */
    @Get('bookings')
    async getBookings(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50',
    ) {
        return this.dashboardService.getBookingsList(
            parseInt(limit, 10),
            parseInt(page, 10),
        );
    }

    /**
     * Get recent comparisons
     * 
     * GET /mea/dashboard/comparisons?limit=10
     */
    @Get('comparisons')
    async getRecentComparisons(@Query('limit') limit: string = '10') {
        return this.dashboardService.getRecentComparisons(parseInt(limit, 10));
    }

    /**
     * Get average match score
     * 
     * GET /mea/dashboard/average-score
     */
    @Get('average-score')
    async getAverageScore() {
        const score = await this.dashboardService.getAverageMatchScore();
        return { averageMatchScore: Math.round(score * 100) / 100 };
    }
}
