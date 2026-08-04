import { useState, useEffect } from 'react';
import { SeatMap } from './components/SeatMap';
import { AdminDashboard } from './components/AdminDashboard';

interface Station {
  id: string;
  name: string;
  code: string;
  distanceKm: number;
}

interface JourneyStation {
  station: Station;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
}

interface Journey {
  id: string;
  name: string;
  departureTime: string;
  direction: string;
  status: string;
  journeyStations: JourneyStation[];
}

interface Seat {
  id: string;
  seatNumber: string;
  status: string; // 'AVAILABLE' | 'OCCUPIED' | 'SHARED_AVAILABLE'
}

interface Coach {
  id: string;
  name: string;
  class: string;
  seats: Seat[];
}

interface LegAvailability {
  journeyId: string;
  startStation: { id: string; name: string; code: string; sequence: number };
  endStation: { id: string; name: string; code: string; sequence: number };
  distanceKm: number;
  occupancyRate: number;
  faresByClass: Record<string, number>;
  coaches: Coach[];
}

interface BookingReceipt {
  bookingReference: string;
  passengerName: string;
  passengerEmail: string;
  fare: number;
  startStation: { name: string };
  endStation: { name: string };
  seat: {
    seatNumber: string;
    coach: { name: string; coachClass: string };
  };
  journey: { name: string; departureTime: string };
}

function App() {
  const [activeTab, setActiveTab] = useState<'booking' | 'admin'>('booking');
  const [stations, setStations] = useState<Station[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  
  // Search state
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [searched, setSearched] = useState(false);
  const [validJourneys, setValidJourneys] = useState<Journey[]>([]);
  
  // Selection state
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [availability, setAvailability] = useState<LegAvailability | null>(null);
  const [selectedCoachIndex, setSelectedCoachIndex] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  
  // Passenger Form
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  // Load stations on load
  useEffect(() => {
    fetch(`${apiBaseUrl}/stations`)
      .then((res) => res.json())
      .then((data) => setStations(data))
      .catch((err) => console.error('Error fetching stations:', err));

    fetch(`${apiBaseUrl}/journeys`)
      .then((res) => res.json())
      .then((data) => setJourneys(data))
      .catch((err) => console.error('Error fetching journeys:', err));
  }, []);

  // Filter journeys that contain both selected stations in order
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originId || !destinationId) return;

    const filtered = journeys.filter((journey) => {
      const stops = journey.journeyStations;
      const originStop = stops.find((s) => s.station.id === originId);
      const destStop = stops.find((s) => s.station.id === destinationId);

      return (
        originStop &&
        destStop &&
        originStop.stopSequence < destStop.stopSequence
      );
    });

    setValidJourneys(filtered);
    setSearched(true);
    setSelectedJourney(null);
    setAvailability(null);
    setSelectedSeat(null);
    setBookingError(null);
  };

  // Load seat availability for the selected journey leg
  const handleSelectJourney = async (journey: Journey) => {
    setSelectedJourney(journey);
    setSelectedSeat(null);
    setBookingError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/journeys/${journey.id}/availability?startStationId=${originId}&endStationId=${destinationId}`
      );
      if (!res.ok) throw new Error('Failed to load seat availability');
      const data = await res.json();
      setAvailability(data);
      setSelectedCoachIndex(0);
    } catch (err: any) {
      console.error(err);
      alert('Could not fetch seat layout.');
    }
  };

  const handleSeatSelect = (seat: Seat) => {
    setSelectedSeat(seat);
    setBookingError(null);
  };

  const handleBookSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJourney || !selectedSeat || !availability) return;

    setBookingLoading(true);
    setBookingError(null);

    const payload = {
      journeyId: selectedJourney.id,
      seatId: selectedSeat.id,
      passengerName,
      passengerEmail,
      startStationId: originId,
      endStationId: destinationId,
    };

    try {
      const res = await fetch(`${apiBaseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle concurrency double booking conflict (status 409)
        if (res.status === 409) {
          setBookingError(
            'Seat Reservation Conflict: This seat was booked by another passenger for an overlapping leg just a moment ago. Please select another seat.'
          );
          // Refresh availability to show latest state
          handleSelectJourney(selectedJourney);
          return;
        }
        throw new Error(data.error || 'Booking failed');
      }

      // Success
      setReceipt(data);
      setPassengerName('');
      setPassengerEmail('');
      setSelectedSeat(null);
      // Refresh availability
      handleSelectJourney(selectedJourney);
    } catch (err: any) {
      setBookingError(err.message || 'An unexpected error occurred.');
    } finally {
      setBookingLoading(false);
    }
  };

  const currentCoach = availability?.coaches[selectedCoachIndex];
  const currentFare = currentCoach ? availability?.faresByClass[currentCoach.class] : 0;

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="14" rx="2" />
              <path d="M4 11h16" />
              <path d="M12 3v8" />
              <path d="m8 17-4 4" />
              <path d="m16 17 4 4" />
            </svg>
          </div>
          <div className="logo-text">
            <h1>Colombo Fort - Badulla</h1>
            <p>Segment Seat Booking System</p>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'booking' ? 'active' : ''}`}
            onClick={() => setActiveTab('booking')}
          >
            Passenger Booking
          </button>
          <button
            className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Operations Command
          </button>
        </nav>
      </header>

      {activeTab === 'admin' ? (
        <AdminDashboard />
      ) : (
        <div className="dashboard-grid">
          {/* Left Column: Search & Journeys */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Search Card */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.2rem' }}>Plan Your Scenic Journey</h3>
              <form onSubmit={handleSearch}>
                <div className="form-group">
                  <label htmlFor="origin">Origin Station</label>
                  <select
                    id="origin"
                    className="form-select"
                    value={originId}
                    onChange={(e) => setOriginId(e.target.value)}
                    required
                  >
                    <option value="">Select departure station</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.id === destinationId}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="destination">Destination Station</label>
                  <select
                    id="destination"
                    className="form-select"
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    required
                  >
                    <option value="">Select arrival station</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.id === originId}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary">
                  Search Available Trains
                </button>
              </form>
            </div>

            {/* Journeys List */}
            {searched && (
              <div className="glass-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Matching Departures</h3>
                {validJourneys.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No scheduled trains found matching this segment flow.
                  </p>
                ) : (
                  <div className="journey-list">
                    {validJourneys.map((j) => (
                      <div
                        key={j.id}
                        className={`journey-card ${selectedJourney?.id === j.id ? 'selected' : ''}`}
                        onClick={() => handleSelectJourney(j)}
                      >
                        <div>
                          <div className="journey-name">{j.name}</div>
                          <div className="journey-time">
                            Departs:{' '}
                            {new Date(j.departureTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>→</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Seat Map & Details */}
          <div>
            {availability && selectedJourney ? (
              <div className="glass-card dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                {/* SVG Seat Map Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ marginBottom: '1rem', alignSelf: 'flex-start', fontSize: '1.2rem' }}>Select Reserved Seat</h3>
                  
                  {/* Coach Class Selectors */}
                  <div className="coach-selector" style={{ marginBottom: '1.5rem' }}>
                    {availability.coaches.map((c, idx) => (
                      <button
                        key={c.id}
                        className={`coach-btn ${selectedCoachIndex === idx ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedCoachIndex(idx);
                          setSelectedSeat(null);
                        }}
                      >
                        {c.name.split(' ')[0] + ' ' + c.name.split(' ')[1]}
                      </button>
                    ))}
                  </div>

                  {currentCoach && (
                    <SeatMap
                      coach={currentCoach}
                      selectedSeatId={selectedSeat?.id || null}
                      onSeatSelect={handleSeatSelect}
                    />
                  )}
                </div>

                {/* Seat Details & Checkout */}
                <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.05)', paddingLeft: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Ticket Reservation</h3>

                  {selectedSeat ? (
                    <form onSubmit={handleBookSeat} className="checkout-summary">
                      <div className="summary-row">
                        <span style={{ color: 'var(--text-muted)' }}>Train</span>
                        <span>{selectedJourney.name}</span>
                      </div>
                      <div className="summary-row">
                        <span style={{ color: 'var(--text-muted)' }}>Coach</span>
                        <span>{currentCoach?.name}</span>
                      </div>
                      <div className="summary-row">
                        <span style={{ color: 'var(--text-muted)' }}>Seat Class</span>
                        <span style={{ color: 'var(--accent)' }}>{currentCoach?.class}</span>
                      </div>
                      <div className="summary-row">
                        <span style={{ color: 'var(--text-muted)' }}>Seat Code</span>
                        <span style={{ fontWeight: 'bold' }}>{selectedSeat.seatNumber}</span>
                      </div>
                      <div className="summary-row">
                        <span style={{ color: 'var(--text-muted)' }}>Leg Distance</span>
                        <span>{availability.distanceKm.toFixed(1)} km</span>
                      </div>
                      
                      {/* Highlight segment-reuse */}
                      {selectedSeat.status === 'SHARED_AVAILABLE' && (
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          fontSize: '0.8rem',
                          color: 'var(--state-shared)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                          </svg>
                          <span><strong>Seat Optimization:</strong> Reselling a vacated portion of this seat!</span>
                        </div>
                      )}

                      <div className="summary-row total">
                        <span>Total Price</span>
                        <span>LKR {currentFare?.toLocaleString()}</span>
                      </div>

                      <div style={{ marginTop: '1rem' }}>
                        <div className="form-group">
                          <label htmlFor="passengerName">Passenger Name</label>
                          <input
                            type="text"
                            id="passengerName"
                            className="form-input"
                            value={passengerName}
                            onChange={(e) => setPassengerName(e.target.value)}
                            placeholder="John Doe"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="passengerEmail">Passenger Email</label>
                          <input
                            type="email"
                            id="passengerEmail"
                            className="form-input"
                            value={passengerEmail}
                            onChange={(e) => setPassengerEmail(e.target.value)}
                            placeholder="john.doe@example.com"
                            required
                          />
                        </div>
                      </div>

                      {bookingError && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          color: '#f87171',
                          fontSize: '0.8rem',
                          lineHeight: '1.4'
                        }}>
                          {bookingError}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={bookingLoading}
                      >
                        {bookingLoading ? 'Issuing Ticket...' : 'Confirm Ticket Reservation'}
                      </button>
                    </form>
                  ) : (
                    <div style={{
                      padding: '3rem 1rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      border: '1px dashed rgba(255,255,255,0.05)',
                      borderRadius: '12px'
                    }}>
                      <p style={{ fontSize: '0.9rem' }}>Please select a vacant seat from the coach layout to book.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '300px',
                color: 'var(--text-muted)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.5 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p>Choose origin and destination stations, then select a departure to view seat maps.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ticket Success Receipt Modal */}
      {receipt && (
        <div className="modal-overlay">
          <div className="modal-content pulse-border">
            <button className="modal-close" onClick={() => setReceipt(null)}>×</button>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid var(--state-shared)',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--state-shared)',
                marginBottom: '1rem'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', color: '#ffffff' }}>Boarding Pass Issued</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Colombo Fort – Badulla Reserved Carriage</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ticket PNR:</span>
                <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '1.05rem' }}>
                  {receipt.bookingReference}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Passenger:</span>
                <span>{receipt.passengerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Train:</span>
                <span>{receipt.journey.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Departure:</span>
                <span>{new Date(receipt.journey.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Route Leg:</span>
                <span>{receipt.startStation.name} → {receipt.endStation.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Carriage & Seat:</span>
                <span>{receipt.seat.coach.name} - Seat {receipt.seat.seatNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <strong style={{ color: '#ffffff' }}>Fare Paid:</strong>
                <strong style={{ color: 'var(--accent)' }}>LKR {receipt.fare.toLocaleString()}</strong>
              </div>
            </div>

            {/* Fake Barcode SVG for premium aesthetic */}
            <div style={{ textAlign: 'center', background: '#ffffff', padding: '0.75rem', borderRadius: '6px' }}>
              <svg width="100%" height="45" style={{ display: 'block' }}>
                <g fill="#000000">
                  {/* Generate barcode line slices */}
                  {[...Array(30)].map((_, idx) => {
                    const x = 10 + idx * 8 + (idx % 3 === 0 ? 2 : 0);
                    const w = idx % 2 === 0 ? 2 : idx % 3 === 0 ? 4 : 1;
                    return <rect key={idx} x={x} y="5" width={w} height="35" />;
                  })}
                </g>
              </svg>
              <span style={{ color: '#000000', fontSize: '0.65rem', letterSpacing: '0.2em', fontFamily: 'monospace' }}>
                {receipt.bookingReference}
              </span>
            </div>
            
            <button
              onClick={() => setReceipt(null)}
              className="btn btn-primary"
              style={{ marginTop: '1.5rem' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
