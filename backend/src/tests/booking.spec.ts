import request from 'supertest';
import app from '../server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Booking API & Segment Logic Tests', () => {
  let journeyId: string;
  let seatId: string;
  let startStationId: string;
  let endStationId: string;
  let intermediateStationId: string;

  beforeAll(async () => {
    // Make sure we connect and find seeded records
    const journey = await prisma.journey.findFirst({
      include: {
        journeyStations: {
          include: { station: true },
          orderBy: { stopSequence: 'asc' },
        },
      },
    });

    const seat = await prisma.seat.findFirst();

    if (!journey || !seat) {
      throw new Error('Database must be seeded before running tests. Run npm run prisma:seed');
    }

    journeyId = journey.id;
    seatId = seat.id;
    
    // We assume stations are seeded in order:
    // e.g. Colombo Fort -> Gampaha -> Polgahawela -> Rambukkana...
    const stations = journey.journeyStations;
    startStationId = stations[0].stationId;
    intermediateStationId = stations[1].stationId;
    endStationId = stations[2].stationId;

    // Clean up any bookings on this seat for this journey before running tests
    await prisma.booking.deleteMany({
      where: {
        journeyId,
        seatId,
      },
    });
  });

  afterAll(async () => {
    // Clean up bookings created in tests
    await prisma.booking.deleteMany({
      where: {
        journeyId,
        seatId,
      },
    });
    await prisma.$disconnect();
  });

  it('1. Should return successful health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('2. Should book a segment and mark it occupied, but keep non-overlapping segment available', async () => {
    // 2.1 Check availability (should be AVAILABLE)
    let res = await request(app)
      .get(`/api/journeys/${journeyId}/availability`)
      .query({ startStationId, endStationId: intermediateStationId });
    
    expect(res.status).toBe(200);
    let coach = res.body.coaches.find((c: any) => c.seats.some((s: any) => s.id === seatId));
    let seat = coach.seats.find((s: any) => s.id === seatId);
    expect(seat.status).toBe('AVAILABLE');

    // 2.2 Book segment: startStation to intermediateStation
    const bookingRes = await request(app)
      .post('/api/bookings')
      .send({
        journeyId,
        seatId,
        passengerName: 'Test Passenger 1',
        passengerEmail: 'test1@example.com',
        startStationId,
        endStationId: intermediateStationId,
      });

    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.bookingReference).toBeDefined();
    const pnr = bookingRes.body.bookingReference;

    // 2.3 Check same segment again: should be OCCUPIED
    res = await request(app)
      .get(`/api/journeys/${journeyId}/availability`)
      .query({ startStationId, endStationId: intermediateStationId });

    coach = res.body.coaches.find((c: any) => c.seats.some((s: any) => s.id === seatId));
    seat = coach.seats.find((s: any) => s.id === seatId);
    expect(seat.status).toBe('OCCUPIED');

    // 2.4 Check overlapping segment (startStation to endStation): should be OCCUPIED
    res = await request(app)
      .get(`/api/journeys/${journeyId}/availability`)
      .query({ startStationId, endStationId });

    coach = res.body.coaches.find((c: any) => c.seats.some((s: any) => s.id === seatId));
    seat = coach.seats.find((s: any) => s.id === seatId);
    expect(seat.status).toBe('OCCUPIED');

    // 2.5 Check non-overlapping next segment (intermediateStation to endStation): should be SHARED_AVAILABLE (reusable!)
    res = await request(app)
      .get(`/api/journeys/${journeyId}/availability`)
      .query({ startStationId: intermediateStationId, endStationId });

    coach = res.body.coaches.find((c: any) => c.seats.some((s: any) => s.id === seatId));
    seat = coach.seats.find((s: any) => s.id === seatId);
    expect(seat.status).toBe('SHARED_AVAILABLE');

    // 2.6 Cancel the booking to reset state
    const cancelRes = await request(app).post(`/api/bookings/${pnr}/cancel`);
    expect(cancelRes.status).toBe(200);

    // 2.7 Verify it is available again
    res = await request(app)
      .get(`/api/journeys/${journeyId}/availability`)
      .query({ startStationId, endStationId: intermediateStationId });

    coach = res.body.coaches.find((c: any) => c.seats.some((s: any) => s.id === seatId));
    seat = coach.seats.find((s: any) => s.id === seatId);
    expect(seat.status).toBe('AVAILABLE');
  });

  it('3. Should handle concurrent bookings correctly, letting only one succeed', async () => {
    // We send two requests at the same time to book the same seat on the same leg
    const reqBody = {
      journeyId,
      seatId,
      passengerName: 'Concurrent Booker',
      passengerEmail: 'concurrent@example.com',
      startStationId,
      endStationId: intermediateStationId,
    };

    // Fire both requests in parallel using Promise.all
    const [res1, res2] = await Promise.all([
      request(app).post('/api/bookings').send(reqBody),
      request(app).post('/api/bookings').send(reqBody),
    ]);

    // Check status codes
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201); // One must succeed
    expect(statuses).toContain(409); // One must fail due to overlap conflict

    // Clean up whichever booking succeeded
    const pnr1 = res1.body.bookingReference;
    const pnr2 = res2.body.bookingReference;
    if (pnr1) await request(app).post(`/api/bookings/${pnr1}/cancel`);
    if (pnr2) await request(app).post(`/api/bookings/${pnr2}/cancel`);
  });

  it('4. Should register waitlist and auto-promote waitlisted passenger on cancellation', async () => {
    // 4.1 Create an active booking to block the seat segment
    const bookRes = await request(app)
      .post('/api/bookings')
      .send({
        journeyId,
        seatId,
        passengerName: 'Blocking Passenger',
        passengerEmail: 'blocker@example.com',
        startStationId,
        endStationId: intermediateStationId,
      });

    expect(bookRes.status).toBe(201);
    const originalPnr = bookRes.body.bookingReference;

    // 4.2 Submit a waitlist request for the blocked seat
    const waitlistRes = await request(app)
      .post('/api/waitlists')
      .send({
        journeyId,
        seatId,
        passengerName: 'Waitlisted Passenger',
        passengerEmail: 'waitlisted@example.com',
        startStationId,
        endStationId: intermediateStationId,
      });

    expect(waitlistRes.status).toBe(201);
    expect(waitlistRes.body.status).toBe('WAITING');
    const waitlistId = waitlistRes.body.id;

    // 4.3 Cancel original booking to trigger waitlist auto-promotion
    const cancelRes = await request(app)
      .post(`/api/bookings/${originalPnr}/cancel`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.message).toContain('Promoted');

    // 4.4 Check that waitlist record is now PROMOTED
    const wlRecord = await prisma.waitlist.findUnique({
      where: { id: waitlistId },
    });
    expect(wlRecord?.status).toBe('PROMOTED');

    // 4.5 Check that a new confirmed booking exists for the waitlisted passenger
    const newBooking = await prisma.booking.findFirst({
      where: {
        journeyId,
        seatId,
        passengerEmail: 'waitlisted@example.com',
        status: 'CONFIRMED',
      },
    });
    expect(newBooking).not.toBeNull();
    expect(newBooking?.passengerName).toBe('Waitlisted Passenger');

    // Cleanup
    if (newBooking) {
      await request(app).post(`/api/bookings/${newBooking.bookingReference}/cancel`);
    }
  });
});
