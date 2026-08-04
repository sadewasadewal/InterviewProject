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

interface WaitlistRecord {
  id: string;
  passengerName: string;
  passengerEmail: string;
  status: string; // 'WAITING' | 'PROMOTED' | 'EXPIRED'
  createdAt: string;
  startStation: { name: string };
  endStation: { name: string };
  seat: {
    seatNumber: string;
    coach: { name: string };
  };
  journey: { name: string };
}

interface DashboardStats {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
  };
  journeys: JourneyStat[];
  bookings: BookingRecord[];
  waitlists: WaitlistRecord[];
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
  const [loading, setLoading] = useState(true);
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsRes = await fetch(`${apiBaseUrl}/admin/stats`);
      if (!statsRes.ok) throw new Error('Failed to fetch admin stats');
      const statsData = await statsRes.json();
      setStats(statsData);
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

  const bookingsList = stats?.bookings || [];
  const waitlistsList = stats?.waitlists || [];

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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Active Waitlisted Passengers</span>
            <div className="stat-value">{waitlistsList.filter(w => w.status === 'WAITING').length}</div>
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
              <div style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                Avg Occupancy: <strong>{journey.avgOccupancy.toFixed(1)}%</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {journey.segments.map((seg, idx) => {
                // Monochrome colors based on occupancy
                let barColor = 'var(--state-empty)'; // zinc-700
                if (seg.occupancyRate > 75) {
                  barColor = '#ffffff'; // white highlight for high load
                } else if (seg.occupancyRate > 40) {
                  barColor = 'var(--state-shared)'; // zinc-400
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
      <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto', marginBottom: '2.5rem' }}>
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
                    <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', color: '#ffffff' }}>
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
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: b.status === 'CONFIRMED' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(82, 82, 91, 0.08)',
                        border: b.status === 'CONFIRMED' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(82, 82, 91, 0.2)',
                        color: b.status === 'CONFIRMED' ? '#ffffff' : 'var(--text-muted)',
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
                          background: 'rgba(255, 255, 255, 0.02)',
                          color: '#ffffff',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          e.currentTarget.style.color = '#ffffff';
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

      {/* Waitlist Registry Ledger */}
      <h3 style={{ margin: '2rem 0 1rem', fontSize: '1.4rem' }}>Waitlist Registry Logs</h3>
      <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <th style={{ padding: '1rem' }}>Registered At</th>
              <th style={{ padding: '1rem' }}>Passenger</th>
              <th style={{ padding: '1rem' }}>Journey</th>
              <th style={{ padding: '1rem' }}>Leg Requested</th>
              <th style={{ padding: '1rem' }}>Seat</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {waitlistsList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No waitlisted entries found.
                </td>
              </tr>
            ) : (
              waitlistsList.map((w) => {
                let badgeClass = 'badge-waiting';
                if (w.status === 'PROMOTED') badgeClass = 'badge-promoted';
                if (w.status === 'EXPIRED') badgeClass = 'badge-cancelled';

                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      {new Date(w.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>{w.passengerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.passengerEmail}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{w.journey.name}</td>
                    <td style={{ padding: '1rem' }}>
                      {w.startStation.name} → {w.endStation.name}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {w.seat.coach.name} - Seat {w.seat.seatNumber}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${badgeClass}`}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
