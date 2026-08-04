/**
 * Calculates the fare for a ticket booking.
 * 
 * @param distanceKm Distance between the start and end stations
 * @param coachClass Class of the coach ("1st Class Reserved", etc.)
 * @param totalJourneyDistance Total distance of the train journey (e.g. 292.4 km)
 * @param segmentOccupancyRate Average occupancy rate of the segments being booked (0.0 to 1.0)
 * @returns Calculated fare in LKR
 */
export function calculateFare(
  distanceKm: number,
  coachClass: string,
  totalJourneyDistance: number,
  segmentOccupancyRate: number
): number {
  // 1. Base rate per km by class
  let baseRatePerKm = 4.0; // 3rd class default
  if (coachClass.includes('1st Class')) {
    baseRatePerKm = 10.0;
  } else if (coachClass.includes('2nd Class')) {
    baseRatePerKm = 6.0;
  }

  // 2. Distance fare
  let fare = distanceKm * baseRatePerKm;

  // 3. Flat booking fee
  const bookingFee = 150.0;
  fare += bookingFee;

  // 4. Yield Multiplier based on occupancy
  let yieldMultiplier = 1.0;
  if (segmentOccupancyRate > 0.8) {
    yieldMultiplier = 1.5;
  } else if (segmentOccupancyRate > 0.5) {
    yieldMultiplier = 1.2;
  }
  fare *= yieldMultiplier;

  // 5. Short-Leg Premium
  // Surcharge of 15% if the leg is less than 20% of the total journey
  if (distanceKm < totalJourneyDistance * 0.2) {
    fare *= 1.15;
  }

  // Round to nearest integer (Sri Lankan Rupees are typically integers)
  return Math.round(fare);
}
