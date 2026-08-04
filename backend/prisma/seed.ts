import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Stations
  const stationsData = [
    { name: 'Colombo Fort', code: 'FOT', distanceKm: 0.0 },
    { name: 'Gampaha', code: 'GPH', distanceKm: 28.4 },
    { name: 'Polgahawela', code: 'PLG', distanceKm: 73.4 },
    { name: 'Rambukkana', code: 'RBK', distanceKm: 84.1 },
    { name: 'Peradeniya', code: 'PDA', distanceKm: 115.6 },
    { name: 'Kandy', code: 'KDY', distanceKm: 120.8 },
    { name: 'Nawalapitiya', code: 'NWP', distanceKm: 148.6 },
    { name: 'Hatton', code: 'HTN', distanceKm: 173.3 },
    { name: 'Nanu Oya', code: 'NOA', distanceKm: 206.9 },
    { name: 'Pattipola', code: 'PPL', distanceKm: 224.2 },
    { name: 'Haputale', code: 'HPT', distanceKm: 247.9 },
    { name: 'Bandarawela', code: 'BDW', distanceKm: 258.6 },
    { name: 'Ella', code: 'ELL', distanceKm: 271.6 },
    { name: 'Badulla', code: 'BAD', distanceKm: 292.4 },
  ];

  const stations = [];
  for (const item of stationsData) {
    const station = await prisma.station.upsert({
      where: { name: item.name },
      update: { distanceKm: item.distanceKm, code: item.code },
      create: { name: item.name, code: item.code, distanceKm: item.distanceKm },
    });
    stations.push(station);
  }
  console.log(`Seeded ${stations.length} stations.`);

  // 2. Create Coaches & Seats
  const coachesData = [
    { name: 'Coach A (1st Class)', class: '1st Class Reserved' },
    { name: 'Coach B (2nd Class)', class: '2nd Class Reserved' },
    { name: 'Coach C (3rd Class)', class: '3rd Class Reserved' },
  ];

  for (const cInfo of coachesData) {
    const coach = await prisma.coach.upsert({
      where: { name: cInfo.name },
      update: { coachClass: cInfo.class },
      create: { name: cInfo.name, coachClass: cInfo.class },
    });

    // Create 20 seats: 5 rows of A, B, C, D (2x2 layout with aisle)
    // Row 1: 1A, 1B, 1C, 1D. Row 5: 5A, 5B, 5C, 5D
    const cols = ['A', 'B', 'C', 'D'];
    for (let r = 1; r <= 5; r++) {
      for (const col of cols) {
        const seatNum = `${r}${col}`;
        await prisma.seat.upsert({
          where: {
            coachId_seatNumber: {
              coachId: coach.id,
              seatNumber: seatNum,
            },
          },
          update: {},
          create: {
            coachId: coach.id,
            seatNumber: seatNum,
          },
        });
      }
    }
  }
  console.log('Seeded coaches and seats (20 seats per coach, 2x2 grid).');

  // 3. Create Journeys
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to add days
  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  };

  const tomorrow = addDays(today, 1);

  // We will seed journeys for today and tomorrow
  const journeysConfig = [
    { name: 'Podi Menike - Outbound', departureTime: 5.91, direction: 'OUTBOUND', date: today }, // 5:55 AM
    { name: 'Udarata Menike - Outbound', departureTime: 8.5, direction: 'OUTBOUND', date: today }, // 8:30 AM
    { name: 'Podi Menike - Inbound', departureTime: 8.5, direction: 'INBOUND', date: today }, // 8:30 AM (starts Badulla -> Colombo)
    
    { name: 'Podi Menike - Outbound', departureTime: 5.91, direction: 'OUTBOUND', date: tomorrow },
    { name: 'Udarata Menike - Outbound', departureTime: 8.5, direction: 'OUTBOUND', date: tomorrow },
    { name: 'Podi Menike - Inbound', departureTime: 8.5, direction: 'INBOUND', date: tomorrow },
  ];

  for (const jCfg of journeysConfig) {
    const depTime = new Date(jCfg.date);
    const hours = Math.floor(jCfg.departureTime);
    const minutes = Math.round((jCfg.departureTime - hours) * 60);
    depTime.setHours(hours, minutes, 0, 0);

    const journey = await prisma.journey.create({
      data: {
        name: jCfg.name,
        departureTime: depTime,
        direction: jCfg.direction,
        status: 'SCHEDULED',
      },
    });

    // Populate Journey Stations based on direction
    const orderedStations = [...stations].sort((a, b) => a.distanceKm - b.distanceKm);
    if (jCfg.direction === 'INBOUND') {
      orderedStations.reverse();
    }

    let runningTime = new Date(depTime);
    for (let idx = 0; idx < orderedStations.length; idx++) {
      const station = orderedStations[idx];
      
      let arrival: Date;
      let departure: Date;

      if (idx === 0) {
        arrival = new Date(runningTime);
        departure = new Date(runningTime);
      } else {
        // Assume travel time: approx 1.7 minutes per km + 3 mins stop
        const prevStation = orderedStations[idx - 1];
        const distDiff = Math.abs(station.distanceKm - prevStation.distanceKm);
        const travelMins = Math.round(distDiff * 1.7 + 2); // 1.7 min/km + 2 mins buffer
        
        runningTime.setMinutes(runningTime.getMinutes() + travelMins);
        arrival = new Date(runningTime);
        
        // Stop duration at station (3 minutes, 10 mins at Kandy)
        const stopMins = station.name === 'Kandy' ? 10 : 3;
        runningTime.setMinutes(runningTime.getMinutes() + stopMins);
        departure = new Date(runningTime);
      }

      await prisma.journeyStation.create({
        data: {
          journeyId: journey.id,
          stationId: station.id,
          stopSequence: idx,
          arrivalTime: arrival,
          departureTime: departure,
        },
      });
    }
  }

  console.log('Seeded journeys with station stops.');
  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
