import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateFare } from '../utils/fare';

const prisma = new PrismaClient();

// Helper to generate a random PNR code (e.g., PNR-A8D3F9)
function generatePNR(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PNR-${code}`;
}

// Create a seat booking
export async function createBooking(req: Request, res: Response) {
  const {
    journeyId,
    seatId,
    passengerName,
    passengerEmail,
    startStationId,
    endStationId,
  } = req.body;

  if (
    !journeyId ||
    !seatId ||
    !passengerName ||
    !passengerEmail ||
    !startStationId ||
    !endStationId
  ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // 1. Fetch Journey Stations to get sequence ordering
    const journeyStations = await prisma.journeyStation.findMany({
      where: {
        journeyId,
        stationId: { in: [startStationId, endStationId] },
      },
    });

    const startJS = journeyStations.find((js) => js.stationId === startStationId);
    const endJS = journeyStations.find((js) => js.stationId === endStationId);

    if (!startJS || !endJS) {
      return res.status(404).json({ error: 'Start or end station not found on this journey' });
    }

    const startSeq = startJS.stopSequence;
    const endSeq = endJS.stopSequence;

    if (startSeq >= endSeq) {
      return res.status(400).json({ error: 'Start station must come before end station' });
    }

    // 2. Fetch distances
    const allJourneyStations = await prisma.journeyStation.findMany({
      where: { journeyId },
      include: { station: true },
      orderBy: { stopSequence: 'asc' },
    });

    const firstJS = allJourneyStations[0];
    const lastJS = allJourneyStations[allJourneyStations.length - 1];
    const totalDistance = Math.abs(lastJS.station.distanceKm - firstJS.station.distanceKm);

    const startStation = allJourneyStations.find((js) => js.stationId === startStationId)?.station;
    const endStation = allJourneyStations.find((js) => js.stationId === endStationId)?.station;

    if (!startStation || !endStation) {
      return res.status(404).json({ error: 'Stations not found' });
    }

    const travelDistance = Math.abs(endStation.distanceKm - startStation.distanceKm);

    // 3. Start a database transaction with serializable locking on the seat
    const booking = await prisma.$transaction(async (tx) => {
      // Lock the Seat row to serialize concurrent booking requests for this specific seat
      // (Only apply row lock on PostgreSQL. SQLite handles concurrency at the database file level)
      const isSqlite = process.env.DATABASE_URL?.startsWith('file:') || process.env.DATABASE_URL?.includes('sqlite');
      if (!isSqlite) {
        const lockedSeats = await tx.$queryRaw<any[]>`
          SELECT id FROM "Seat" WHERE id = ${seatId} FOR UPDATE
        `;
        if (lockedSeats.length === 0) {
          throw new Error('Seat not found');
        }
      } else {
        const seatExists = await tx.seat.findUnique({ where: { id: seatId } });
        if (!seatExists) {
          throw new Error('Seat not found');
        }
      }

      // Check if there's any active booking for this seat on overlapping segments of the journey
      const overlapBookings = await tx.$queryRaw<any[]>`
        SELECT id FROM "Booking"
        WHERE "journeyId" = ${journeyId}
          AND "seatId" = ${seatId}
          AND "status" = 'CONFIRMED'
          AND "startSequence" < ${endSeq}
          AND "endSequence" > ${startSeq}
      `;

      if (overlapBookings.length > 0) {
        throw new Error('This seat is already booked for an overlapping portion of this journey');
      }

      // Fetch seat and coach details to get class
      const seatDetails = await tx.seat.findUnique({
        where: { id: seatId },
        include: { coach: true },
      });

      if (!seatDetails) {
        throw new Error('Seat details not found');
      }

      // Calculate current segment occupancy rate to apply dynamic pricing
      const totalSeatsCount = await tx.seat.count();
      const segmentBookedCount = await tx.booking.count({
        where: {
          journeyId,
          status: 'CONFIRMED',
          startSequence: { lt: endSeq },
          endSequence: { gt: startSeq },
        },
      });

      const occupancyRate = totalSeatsCount > 0 ? segmentBookedCount / totalSeatsCount : 0;

      // Calculate final fare
      const fare = calculateFare(
        travelDistance,
        seatDetails.coach.coachClass,
        totalDistance,
        occupancyRate
      );

      // Generate a unique PNR code
      let bookingRef = generatePNR();
      let refExists = true;
      while (refExists) {
        const existingRef = await tx.booking.findUnique({
          where: { bookingReference: bookingRef },
        });
        if (!existingRef) {
          refExists = false;
        } else {
          bookingRef = generatePNR();
        }
      }

      // Create and save booking
      const newBooking = await tx.booking.create({
        data: {
          journeyId,
          seatId,
          passengerName,
          passengerEmail,
          startStationId,
          endStationId,
          startSequence: startSeq,
          endSequence: endSeq,
          fare,
          bookingReference: bookingRef,
          status: 'CONFIRMED',
        },
        include: {
          seat: {
            include: { coach: true },
          },
          startStation: true,
          endStation: true,
          journey: true,
        },
      });

      return newBooking;
    });

    res.status(201).json(booking);
  } catch (error: any) {
    if (
      error.message.includes('already booked') ||
      error.message.includes('overlapping portion')
    ) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

// Cancel an existing booking (to test freeing segments)
export async function cancelBooking(req: Request, res: Response) {
  try {
    const { reference } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { bookingReference: reference },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Booking cancelled successfully', booking: updatedBooking });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
