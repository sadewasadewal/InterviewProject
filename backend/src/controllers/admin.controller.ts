import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAdminDashboardStats(req: Request, res: Response) {
  try {
    // 1. Overall Revenue
    const bookings = await prisma.booking.findMany({
      include: {
        journey: true,
        seat: { include: { coach: true } },
        startStation: true,
        endStation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.fare, 0);

    // 2. Journey-specific analytics
    const journeys = await prisma.journey.findMany({
      include: {
        journeyStations: {
          include: { station: true },
          orderBy: { stopSequence: 'asc' },
        },
      },
      orderBy: { departureTime: 'asc' },
    });

    const totalSeatsCount = await prisma.seat.count();

    const journeyStats = [];
    for (const journey of journeys) {
      const journeyBookings = confirmedBookings.filter((b) => b.journeyId === journey.id);

      // Generate segments (adjacent station stops)
      const stations = journey.journeyStations;
      const segments = [];
      let totalSegmentOccupancySum = 0;

      for (let i = 0; i < stations.length - 1; i++) {
        const fromStation = stations[i];
        const toStation = stations[i + 1];

        // Bookings covering this segment: startSequence <= fromStation.stopSequence AND endSequence >= toStation.stopSequence
        const segmentBookingsCount = journeyBookings.filter(
          (b) =>
            b.startSequence <= fromStation.stopSequence &&
            b.endSequence >= toStation.stopSequence
        ).length;

        const occupancyRate = totalSeatsCount > 0 ? segmentBookedPercentage(segmentBookingsCount, totalSeatsCount) : 0;
        totalSegmentOccupancySum += occupancyRate;

        segments.push({
          from: fromStation.station.name,
          fromCode: fromStation.station.code,
          to: toStation.station.name,
          toCode: toStation.station.code,
          fromSequence: fromStation.stopSequence,
          toSequence: toStation.stopSequence,
          bookingsCount: segmentBookingsCount,
          occupancyRate,
        });
      }

      const avgOccupancy = segments.length > 0 ? totalSegmentOccupancySum / segments.length : 0;
      const journeyRevenue = journeyBookings.reduce((sum, b) => sum + b.fare, 0);

      journeyStats.push({
        id: journey.id,
        name: journey.name,
        departureTime: journey.departureTime,
        direction: journey.direction,
        status: journey.status,
        bookingsCount: journeyBookings.length,
        revenue: journeyRevenue,
        avgOccupancy,
        segments,
      });
    }

    res.json({
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        cancelledBookings: bookings.length - confirmedBookings.length,
      },
      journeys: journeyStats,
      bookings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

function segmentBookedPercentage(booked: number, total: number): number {
  return parseFloat(((booked / total) * 100).toFixed(2));
}
