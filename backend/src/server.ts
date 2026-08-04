import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getStations, getJourneys, getJourneyAvailability } from './controllers/journey.controller';
import { createBooking, cancelBooking } from './controllers/booking.controller';
import { getAdminDashboardStats } from './controllers/admin.controller';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for dev/testing ease
}));
app.use(express.json());

// API Routes
app.get('/api/stations', getStations);
app.get('/api/journeys', getJourneys);
app.get('/api/journeys/:id/availability', getJourneyAvailability);

app.post('/api/bookings', createBooking);
app.post('/api/bookings/:reference/cancel', cancelBooking);

app.get('/api/admin/stats', getAdminDashboardStats);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
