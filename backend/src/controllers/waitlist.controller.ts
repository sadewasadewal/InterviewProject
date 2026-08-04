import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Join waitlist for an occupied seat
export async function joinWaitlist(req: Request, res: Response) {
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

    // 2. Add to Waitlist
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        journeyId,
        seatId,
        passengerName,
        passengerEmail,
        startStationId,
        endStationId,
        startSequence: startSeq,
        endSequence: endSeq,
        status: 'WAITING',
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

    res.status(201).json(waitlistEntry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
