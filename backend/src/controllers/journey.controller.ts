import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateFare } from '../utils/fare';

const prisma = new PrismaClient();

// Get all stations sorted by sequence distance
export async function getStations(req: Request, res: Response) {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { distanceKm: 'asc' },
    });
    res.json(stations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Get all journeys with their route details
export async function getJourneys(req: Request, res: Response) {
  try {
    const journeys = await prisma.journey.findMany({
      include: {
        journeyStations: {
          include: { station: true },
          orderBy: { stopSequence: 'asc' },
        },
      },
      orderBy: { departureTime: 'asc' },
    });
    res.json(journeys);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Get seat availability map for a specific leg of a journey
export async function getJourneyAvailability(req: Request, res: Response) {
  try {
    const { id: journeyId } = req.params;
    const { startStationId, endStationId } = req.query;

    if (!startStationId || !endStationId) {
      return res.status(400).json({ error: 'startStationId and endStationId are required' });
    }

    // Get journey stations for start and end stations
    const journeyStations = await prisma.journeyStation.findMany({
      where: {
        journeyId,
        stationId: { in: [startStationId as string, endStationId as string] },
      },
    });

    const startJS = journeyStations.find((js) => js.stationId === startStationId);
    const endJS = journeyStations.find((js) => js.stationId === endStationId);

    if (!startJS || !endJS) {
      return res.status(404).json({ error: 'Start or end station not found on this journey route' });
    }

    const startSeq = startJS.stopSequence;
    const endSeq = endJS.stopSequence;

    if (startSeq >= endSeq) {
      return res.status(400).json({ error: 'Start station must come before end station in this journey direction' });
    }

    // Get all stations in the journey to calculate total journey distance
    const allJourneyStations = await prisma.journeyStation.findMany({
      where: { journeyId },
      include: { station: true },
      orderBy: { stopSequence: 'asc' },
    });

    const firstJS = allJourneyStations[0];
    const lastJS = allJourneyStations[allJourneyStations.length - 1];
    const totalDistance = Math.abs(lastJS.station.distanceKm - firstJS.station.distanceKm);

    // Calculate distance of this segment
    const startStation = allJourneyStations.find((js) => js.stationId === startStationId)?.station;
    const endStation = allJourneyStations.find((js) => js.stationId === endStationId)?.station;

    if (!startStation || !endStation) {
      return res.status(404).json({ error: 'Stations not found' });
    }

    const travelDistance = Math.abs(endStation.distanceKm - startStation.distanceKm);

    // Get all coaches and seats
    const coaches = await prisma.coach.findMany({
      include: {
        seats: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get confirmed bookings for this journey
    const bookings = await prisma.booking.findMany({
      where: {
        journeyId,
        status: 'CONFIRMED',
      },
    });

    // Calculate segment occupancy rate
    // Total occupied seats on this specific leg
    let occupiedSeatsCount = 0;
    let totalSeatsCount = 0;

    const coachSeatAvailability = coaches.map((coach) => {
      const coachSeats = coach.seats.map((seat) => {
        totalSeatsCount++;

        // Find bookings for this seat
        const seatBookings = bookings.filter((b) => b.seatId === seat.id);

        // Check if there is an overlap booking
        // Overlap: max(b.start, req.start) < min(b.end, req.end) => b.start < req.end AND b.end > req.start
        const hasOverlap = seatBookings.some(
          (b) => b.startSequence < endSeq && b.endSequence > startSeq
        );

        let availabilityStatus = 'AVAILABLE';
        if (hasOverlap) {
          availabilityStatus = 'OCCUPIED';
          occupiedSeatsCount++;
        } else if (seatBookings.length > 0) {
          // If no overlap but has other bookings, it is "shared" (vacated and re-bookable)
          availabilityStatus = 'SHARED_AVAILABLE';
        }

        return {
          id: seat.id,
          seatNumber: seat.seatNumber,
          status: availabilityStatus,
        };
      });

      return {
        id: coach.id,
        name: coach.name,
        class: coach.coachClass,
        seats: coachSeats,
      };
    });

    // Average occupancy rate for this segment
    const occupancyRate = totalSeatsCount > 0 ? occupiedSeatsCount / totalSeatsCount : 0;

    // Calculate fare for each coach class
    const faresByClass = coaches.reduce((acc, coach) => {
      if (!acc[coach.coachClass]) {
        acc[coach.coachClass] = calculateFare(
          travelDistance,
          coach.coachClass,
          totalDistance,
          occupancyRate
        );
      }
      return acc;
    }, {} as Record<string, number>);

    res.json({
      journeyId,
      startStation: { id: startStation.id, name: startStation.name, code: startStation.code, sequence: startSeq },
      endStation: { id: endStation.id, name: endStation.name, code: endStation.code, sequence: endSeq },
      distanceKm: travelDistance,
      occupancyRate,
      faresByClass,
      coaches: coachSeatAvailability,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
