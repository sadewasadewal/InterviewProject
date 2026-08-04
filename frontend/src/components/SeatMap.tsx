import React from 'react';

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

interface SeatMapProps {
  coach: Coach;
  selectedSeatId: string | null;
  onSeatSelect: (seat: Seat) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  coach,
  selectedSeatId,
  onSeatSelect,
}) => {
  // Constants for SVG drawing
  const svgWidth = 400;
  const svgHeight = 520;

  // We have 5 rows and 4 columns: A, B, C, D
  const rows = [1, 2, 3, 4, 5];
  const columns = ['A', 'B', 'C', 'D'];

  const getSeatX = (col: string) => {
    switch (col) {
      case 'A': return 40;
      case 'B': return 110;
      case 'C': return 250;
      case 'D': return 320;
      default: return 0;
    }
  };

  const getSeatY = (row: number) => {
    return 70 + (row - 1) * 80;
  };

  return (
    <div className="seat-map-container">
      <div className="legend">
        <div className="legend-item">
          <div className="legend-dot empty" />
          <span>Empty (LKR)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot shared" />
          <span>Vacated & Reusable</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot selected" />
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot booked" />
          <span>Occupied</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="train-coach-svg"
      >
        <defs>
          <pattern id="diagonal-stripes" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {/* Coach Body Outline */}
        <rect
          x="10"
          y="10"
          width={svgWidth - 20}
          height={svgHeight - 20}
          rx="25"
          ry="25"
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="3"
        />

        {/* Coach Head / Connector */}
        <path
          d={`M ${svgWidth / 2 - 30} 10 L ${svgWidth / 2 - 20} 2 L ${svgWidth / 2 + 20} 2 L ${svgWidth / 2 + 30} 10`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="3"
        />
        <path
          d={`M ${svgWidth / 2 - 30} ${svgHeight - 10} L ${svgWidth / 2 - 20} ${svgHeight - 2} L ${svgWidth / 2 + 20} ${svgHeight - 2} L ${svgWidth / 2 + 30} ${svgHeight - 10}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="3"
        />

        {/* Aisle Path Label */}
        <line
          x1={svgWidth / 2}
          y1="50"
          x2={svgWidth / 2}
          y2={svgHeight - 50}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="40"
          strokeDasharray="10 15"
        />
        
        <text
          x={svgWidth / 2}
          y={svgHeight / 2}
          textAnchor="middle"
          className="aisle-text"
          transform={`rotate(-90 ${svgWidth / 2} ${svgHeight / 2})`}
        >
          Aisle
        </text>

        {/* Render Seats */}
        {rows.map((row) => {
          return columns.map((col) => {
            const seatNumber = `${row}${col}`;
            const seat = coach.seats.find((s) => s.seatNumber === seatNumber);

            if (!seat) return null;

            const isSelected = selectedSeatId === seat.id;
            const x = getSeatX(col);
            const y = getSeatY(row);
            const w = 45;
            const h = 45;

            // Class mappings
            let seatClass = 'state-empty';
            if (isSelected) {
              seatClass = 'state-selected';
            } else if (seat.status === 'OCCUPIED') {
              seatClass = 'state-booked';
            } else if (seat.status === 'SHARED_AVAILABLE') {
              seatClass = 'state-shared';
            }

            const handleClick = () => {
              onSeatSelect(seat);
            };

            return (
              <g key={seat.id} onClick={handleClick}>
                {/* Seat Cushion */}
                 <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  className={`seat-rect ${seatClass}`}
                />
                {seat.status === 'OCCUPIED' && !isSelected && (
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="url(#diagonal-stripes)"
                    rx="5"
                    ry="5"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Seat Backrest (Visual refinement) */}
                <rect
                  x={x + 3}
                  y={y + h - 10}
                  width={w - 6}
                  height="7"
                  rx="2"
                  ry="2"
                  fill="rgba(255, 255, 255, 0.15)"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Seat Label */}
                <text
                  x={x + w / 2}
                  y={y + h / 2 - 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="seat-text"
                >
                  {seatNumber}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
};
