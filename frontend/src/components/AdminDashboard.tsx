import React, { useEffect, useState } from 'react';

interface Segment {
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  fromSequence: number;
  toSequence: number;
  bookingsCount: number;
  occupancyRate: number;
}

interface JourneyStat {
  id: string;
  name: string;
  departureTime: string;
  direction: string;
  status: string;
  bookingsCount: number;
  revenue: number;
  avgOccupancy: number;
  segments: Segment[];
}

interface DashboardStats {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
  };
  journeys: JourneyStat[];
}

interface BookingRecord {
  id: string;
  bookingReference: string;
  passengerName: string;
  passengerEmail: string;
  fare: number;
  status: string;
  startStation: { name: string };
  endStation: { name: string };
  seat: {
    seatNumber: string;
    coach: { name: string };
  };
  journey: { name: string; departureTime: string };
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch stats
      const statsRes = await fetch(`${apiBaseUrl}/admin/stats`);
      if (!statsRes.ok) throw new Error('Failed to fetch admin stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch all bookings (mocked or custom fetched from stats or direct endpoint)
      // For this simple application, we can fetch all bookings by requesting a custom list or extracting from DB.
      // Let's call the journey endpoint or create a small fetch. Wait, we can fetch all journeys or retrieve bookings from stats.
      // Wait, we can define a small bookings list query or fetch them. Let's make an endpoint on the backend for bookings if we want,
      // or we can extract the bookings from a stats/bookings endpoint.
      // Actually, let's look at the database. In our stats endpoint, we fetched all bookings from database!
      // Let's add a small helper in the admin controller to return all bookings, or let's return them in the stats query itself.
      // Oh! In `getAdminDashboardStats`, we only queried bookings to compute revenue, but didn't return the full bookings list.
      // Let's check: can we fetch the bookings? Let's check if the stats response includes bookings or if we should fetch them.
      // Let's modify the stats response to include the bookings list, or fetch them.
      // Let's check `getAdminDashboardStats` in `admin.controller.ts`. It doesn't return the bookings list in the JSON.
      // We can easily fetch them or modify the controller. Let's make sure we can fetch them. Let's make a call to a `/api/admin/bookings` or fetch them from the stats endpoint.
      // Wait! Let's modify `getAdminDashboardStats` later if needed, or we can just fetch bookings from a separate endpoint `/api/admin/stats` that we can update,
      // or we can write a simple endpoint. In fact, let's just make the stats endpoint return the bookings list as well!
      // That is extremely easy. We will update the admin controller to return the bookings list.
      // For now, let's write the AdminDashboard assuming the API returns `{ summary, journeys, bookings }`.
      if (statsData.bookings) {
        setBookings(statsData.bookings);
      } else {
        // If not present, we will support it. Let's make sure we update the backend admin controller to include bookings!
      }
      
      if (statsData.bookings) {
        setBookings(statsData.bookings);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelBooking = async (pnr: string) => {
    if (!window.confirm(`Are you sure you want to cancel booking ${pnr}?`)) return;
    try {
      setCancellingRef(pnr);
      const res = await fetch(`${apiBaseUrl}/bookings/${pnr}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to cancel booking');
      }
      alert('Booking cancelled successfully.');
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCancellingRef(null);
    }
  };

  if (loading && !stats) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard analytics...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: 'var(--state-booked)' }}>Error: {error}</div>;
  }

  // Fallback to extract bookings from stats if available (we will add it in the backend)
  const bookingsList = stats?.bookings || bookings || [];

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.75rem' }}>Railway Operations Command</h2>
      
      {/* Top Stat Summary Cards */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="stat-box glass-card">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Revenue</span>
            <div className="stat-value">LKR {stats.summary.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="stat-box glass-card">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Confirmed Tickets</span>
            <div className="stat-value">{stats.summary.confirmedBookings}</div>
          </div>
          <div className="stat-box glass-card">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Cancelled Tickets</span>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{stats.summary.cancelledBookings}</div>
          </div>
          <div className="stat-box glass-card">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Bookings Logged</span>
            <div className="stat-value">{stats.summary.totalBookings}</div>
          </div>
        </div>
      )}

      {/* Segment Occupancy Heatmaps */}
      <h3 style={{ margin: '2rem 0 1rem', fontSize: '1.4rem' }}>Line Segment Occupancy Heatmaps</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Real-time seat occupancy levels across each adjacent station leg of the Colombo Fort–Badulla Main Line.
      </p>

      <div className="heatmap-container">
        {stats?.journeys.map((journey) => (
          <div key={journey.id} className="heatmap-journey-section glass-card">
            <div className="heatmap-journey-title">
              <div>
                <span>{journey.name}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                  Departing: {new Date(journey.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                Avg Occupancy: <strong style={{ color: 'var(--accent)' }}>{journey.avgOccupancy.toFixed(1)}%</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {journey.segments.map((seg, idx) => {
                // Color based on occupancy
                let barColor = 'rgba(16, 185, 129, 0.5)'; // green
                if (seg.occupancyRate > 75) {
                  barColor = 'rgba(239, 68, 68, 0.7)'; // red
                } else if (seg.occupancyRate > 40) {
                  barColor = 'rgba(245, 158, 11, 0.6)'; // orange
                }

                return (
                  <div key={idx} className="heatmap-row">
                    <div className="heatmap-labels">
                      <span>{seg.from} ({seg.fromCode}) → {seg.to} ({seg.toCode})</span>
                      <span>{seg.bookingsCount} booked ({seg.occupancyRate}%)</span>
                    </div>
                    <div className="heatmap-bar-bg">
                      <div
                        className="heatmap-bar-fill"
                        style={{
                          width: `${seg.occupancyRate}%`,
                          background: barColor,
                        }}
                      />
                      <div className="heatmap-bar-text">
                        {seg.occupancyRate}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Booking List */}
      <h3 style={{ margin: '2.5rem 0 1rem', fontSize: '1.4rem' }}>Passenger Manifest & Booking Ledger</h3>
      <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <th style={{ padding: '1rem' }}>PNR Ref</th>
              <th style={{ padding: '1rem' }}>Passenger</th>
              <th style={{ padding: '1rem' }}>Journey</th>
              <th style={{ padding: '1rem' }}>Leg</th>
              <th style={{ padding: '1rem' }}>Seat</th>
              <th style={{ padding: '1rem' }}>Fare</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {bookingsList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No bookings found in system ledger.
                </td>
              </tr>
            ) : (
              bookingsList.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem' }}>
                    <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', color: 'var(--accent)' }}>
                      {b.bookingReference}
                    </code>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div>{b.passengerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.passengerEmail}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div>{b.journey.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(b.journey.departureTime).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {b.startStation.name} → {b.endStation.name}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {b.seat.coach.name} - Seat {b.seat.seatNumber}
                  </td>
                  <td style={{ padding: '1rem' }}>LKR {b.fare.toLocaleString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: b.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: b.status === 'CONFIRMED' ? 'var(--state-shared)' : 'var(--state-booked)',
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {b.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleCancelBooking(b.bookingReference)}
                        disabled={cancellingRef === b.bookingReference}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--state-booked)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--state-booked)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          e.currentTarget.style.color = 'var(--state-booked)';
                        }}
                      >
                        {cancellingRef === b.bookingReference ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
