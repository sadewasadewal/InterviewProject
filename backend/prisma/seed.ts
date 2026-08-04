import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old journey data for re-seeding...');
  // Delete old journeys (which cascade deletes journeyStations and bookings)
  await prisma.journey.deleteMany({});
  await prisma.station.deleteMany({});
  await prisma.coach.deleteMany({});

  console.log('Seeding stations for multiple lines...');

  // 1. Define Stations data with their corresponding lines
  const mainLineStations = [
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

  const northernLineStations = [
    { name: 'Colombo Fort', code: 'FOT', distanceKm: 0.0 },
    { name: 'Kurunegala', code: 'KGL', distanceKm: 94.0 },
    { name: 'Anuradhapura', code: 'ANP', distanceKm: 205.0 },
    { name: 'Vavuniya', code: 'VUN', distanceKm: 256.0 },
    { name: 'Jaffna', code: 'JFN', distanceKm: 398.0 },
  ];

  const coastalLineStations = [
    { name: 'Colombo Fort', code: 'FOT', distanceKm: 0.0 },
    { name: 'Mount Lavinia', code: 'MLV', distanceKm: 11.6 },
    { name: 'Hikkaduwa', code: 'HKW', distanceKm: 94.5 },
    { name: 'Galle', code: 'GLE', distanceKm: 115.3 },
    { name: 'Weligama', code: 'WLM', distanceKm: 143.2 },
    { name: 'Matara', code: 'MTR', distanceKm: 157.1 },
  ];

  // Helper mapping lines
  const stationLineMap: Record<string, string[]> = {
    MAIN_LINE: mainLineStations.map(s => s.name),
    NORTHERN_LINE: northernLineStations.map(s => s.name),
    COASTAL_LINE: coastalLineStations.map(s => s.name),
  };

  // Combine all unique stations
  const allStationsDataMap: Record<string, { code: string; distanceKm: number }> = {};
  [...mainLineStations, ...northernLineStations, ...coastalLineStations].forEach(s => {
    allStationsDataMap[s.name] = { code: s.code, distanceKm: s.distanceKm };
  });

  const stations: Record<string, any> = {};
  for (const name of Object.keys(allStationsDataMap)) {
    const info = allStationsDataMap[name];
    const station = await prisma.station.create({
      data: {
        name,
        code: info.code,
        distanceKm: info.distanceKm,
      },
    });
    stations[name] = station;
  }
  console.log(`Seeded ${Object.keys(stations).length} unique stations across 3 lines.`);

  // 2. Create Carriage classes (Coach A, B, C)
  const coachesData = [
    { name: 'Coach A (1st Class)', class: '1st Class Reserved' },
    { name: 'Coach B (2nd Class)', class: '2nd Class Reserved' },
    { name: 'Coach C (3rd Class)', class: '3rd Class Reserved' },
  ];

  for (const cInfo of coachesData) {
    const coach = await prisma.coach.create({
      data: {
        name: cInfo.name,
        coachClass: cInfo.class,
      },
    });

    // Create 20 seats (rows 1-5, cols A, B, C, D)
    const cols = ['A', 'B', 'C', 'D'];
    for (let r = 1; r <= 5; r++) {
      for (const col of cols) {
        const seatNum = `${r}${col}`;
        await prisma.seat.create({
          data: {
            coachId: coach.id,
            seatNumber: seatNum,
          },
        });
      }
    }
  }
  console.log('Seeded carriage classes (1st, 2nd, 3rd Class carriages, 20 seats each).');

  // 3. Journeys Configuration
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  };
  const tomorrow = addDays(today, 1);

  const journeysConfig = [
    // 3.1 Main Line (Colombo Fort - Badulla)
    { name: 'Podi Menike (Outbound) - Main Line', departureTime: 5.91, direction: 'OUTBOUND', date: today, line: 'MAIN_LINE' },
    { name: 'Udarata Menike (Outbound) - Main Line', departureTime: 8.5, direction: 'OUTBOUND', date: today, line: 'MAIN_LINE' },
    { name: 'Podi Menike (Inbound) - Main Line', departureTime: 8.5, direction: 'INBOUND', date: today, line: 'MAIN_LINE' },
    { name: 'Podi Menike (Outbound) - Main Line', departureTime: 5.91, direction: 'OUTBOUND', date: tomorrow, line: 'MAIN_LINE' },
    { name: 'Podi Menike (Inbound) - Main Line', departureTime: 8.5, direction: 'INBOUND', date: tomorrow, line: 'MAIN_LINE' },

    // 3.2 Northern Line (Colombo Fort - Jaffna)
    { name: 'Yal Devi (Outbound) - Northern Line', departureTime: 6.5, direction: 'OUTBOUND', date: today, line: 'NORTHERN_LINE' },
    { name: 'Yal Devi (Inbound) - Northern Line', departureTime: 9.75, direction: 'INBOUND', date: today, line: 'NORTHERN_LINE' },
    { name: 'Yal Devi (Outbound) - Northern Line', departureTime: 6.5, direction: 'OUTBOUND', date: tomorrow, line: 'NORTHERN_LINE' },
    { name: 'Yal Devi (Inbound) - Northern Line', departureTime: 9.75, direction: 'INBOUND', date: tomorrow, line: 'NORTHERN_LINE' },

    // 3.3 Coastal Line (Colombo Fort - Matara)
    { name: 'Samudra Devi (Outbound) - Coastal Line', departureTime: 7.25, direction: 'OUTBOUND', date: today, line: 'COASTAL_LINE' },
    { name: 'Samudra Devi (Inbound) - Coastal Line', departureTime: 14.75, direction: 'INBOUND', date: today, line: 'COASTAL_LINE' },
    { name: 'Samudra Devi (Outbound) - Coastal Line', departureTime: 7.25, direction: 'OUTBOUND', date: tomorrow, line: 'COASTAL_LINE' },
    { name: 'Samudra Devi (Inbound) - Coastal Line', departureTime: 14.75, direction: 'INBOUND', date: tomorrow, line: 'COASTAL_LINE' },
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

    // Resolve stations for this specific line
    const lineStationNames = stationLineMap[jCfg.line];
    const lineStations = lineStationNames.map(name => stations[name]);

    // Sort by distance from Colombo Fort
    const sortedLineStations = [...lineStations].sort((a, b) => a.distanceKm - b.distanceKm);
    
    // Reverse sequence order if Inbound
    if (jCfg.direction === 'INBOUND') {
      sortedLineStations.reverse();
    }

    let runningTime = new Date(depTime);
    for (let idx = 0; idx < sortedLineStations.length; idx++) {
      const station = sortedLineStations[idx];
      
      let arrival: Date;
      let departure: Date;

      if (idx === 0) {
        arrival = new Date(runningTime);
        departure = new Date(runningTime);
      } else {
        const prevStation = sortedLineStations[idx - 1];
        const distDiff = Math.abs(station.distanceKm - prevStation.distanceKm);
        
        // Assume travel time: ~1.5 min per km + 3 mins stop
        const travelMins = Math.round(distDiff * 1.5 + 2);
        
        runningTime.setMinutes(runningTime.getMinutes() + travelMins);
        arrival = new Date(runningTime);
        
        const stopMins = station.name === 'Kandy' || station.name === 'Anuradhapura' || station.name === 'Galle' ? 10 : 3;
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

  console.log('Seeded multi-line journeys with intermediate stops.');
  console.log('Database re-seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
