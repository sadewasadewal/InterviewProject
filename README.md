# Sri Lanka Railways - Segment-Based Train Seat Booking System

A real-time reserved seat booking application for Sri Lanka's historic **Colombo Fort – Badulla Main Line** that allows a single reserved seat to be booked independently for multiple, non-overlapping legs of the same journey.

By reselling seats vacated partway through the trip, this system maximizes seat utilization, prevents overcrowding in unreserved coaches, and lowers fares for short-distance travelers while increasing overall railway revenue.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React (Vite + TypeScript)
  - Designed with premium, dark glassmorphic **Vanilla CSS** for smooth micro-animations, loading states, and custom UI components.
  - Interactive **SVG-based Seat Map** rendering real-time booking states.
- **Backend**: Node.js + Express with TypeScript
  - Rest APIs for journey listing, segment availability querying, booking creation/cancellation, and admin analytics.
- **Database**: SQLite (via Prisma ORM for zero-dependency local setup, with PostgreSQL migration compatibility)
- **Orchestration**: Docker Compose or standalone local dev servers

---

## 📐 Design & Modeling Decisions

### 1. Segment-Based Occupancy Model
A journey is modeled as an ordered sequence of stations. Rather than storing bookings as a static 1-to-1 mapping of seat to journey, we check seat availability over station indices:
- Let $S$ be the sequence of stations on the journey (e.g., Colombo Fort [0], Peradeniya [4], Kandy [5], Ella [12], Badulla [13]).
- When a user books a leg from station $A$ to station $B$, we fetch their sequence numbers on the journey ($S_A < S_B$).
- The booking occupies segments from stop index $S_A$ to $S_B$.
- **Overlap Logic**: Two bookings $B_1$ and $B_2$ on the same seat and journey overlap if and only if:
  $$\max(B_1.start\_sequence, B_2.start\_sequence) < \min(B_1.end\_sequence, B_2.end\_sequence)$$
  In SQL: `B.start_sequence < :req_end_sequence AND B.end_sequence > :req_start_sequence`.
  This allows a seat to be booked for Colombo Fort $\to$ Kandy ($0 \to 5$) and Kandy $\to$ Badulla ($5 \to 13$) on the same journey. The query correctly sees that $5$ is not less than $5$, so they do not overlap.

### 2. Concurrency Locking (`SELECT FOR UPDATE`)
To prevent double booking when multiple users submit concurrent requests for the same seat on overlapping legs:
- All booking attempts are wrapped in a database transaction.
- When running with PostgreSQL, we issue a row-level lock on the specific seat record:
  ```sql
  SELECT id FROM "Seat" WHERE id = $1 FOR UPDATE;
  ```
- This forces concurrent transactions requesting the *same seat* to queue up. Once the lock is acquired, we run the overlap check query against confirmed bookings. If an overlap is found, the transaction is aborted (`ROLLBACK`), and a `409 Conflict` is returned.
- This ensures absolute booking correctness under high concurrent loads without blocking bookings on *different* seats.

### 3. Dynamic Fare & Yield Management
Instead of rigid distance fares, we implement a premium fare logic:
- **Base Rate**: Based on carriage class (LKR 10/km for 1st Class, LKR 6/km for 2nd Class, LKR 4/km for 3rd Class).
- **Booking Fee**: Flat LKR 150 per ticket.
- **Yield Surcharge (Dynamic Pricing)**: As booking density on the requested segment increases, a multiplier is applied to reflect high demand:
  - Leg Occupancy $< 50\%$: 1.0x multiplier
  - Leg Occupancy $50\% - 80\%$: 1.2x multiplier
  - Leg Occupancy $> 80\%$: 1.5x multiplier
- **Short-Leg Premium**: If a passenger books a short leg ($< 20\%$ of the total journey length), a 15% surcharge is added. This mimics yield management practices that protect long-distance seats from being blocked by short-distance passengers.

---

## ✨ Extra Credit Features Built

1. **Interactive SVG Seat Map**:
   - Renders a physical train carriage layout (2x2 seats with a central aisle).
   - Seats are color-coded in real time:
     - ⚪ **Grey (Empty)**: Available for booking.
     - 🔴 **Red (Occupied)**: Booked on an overlapping segment of this train.
     - 🟢 **Teal (Vacated & Reusable)**: Indicates that the seat is booked on another leg but is vacant and re-bookable for your selected search! Shows optimization in action.
2. **Operations Command Dashboard (Admin View)**:
   - Displays key operational metrics: Total Revenue, Confirmed vs. Cancelled Tickets, and Total Passenger Bookings.
   - **Segment Occupancy Heatmaps**: Renders progress bars for each leg of a train (e.g. Hatton $\to$ Nanu Oya) showing what percentage of seats are occupied. This highlights route hotspots and low-load stretches.
   - **Ledger & Real-time Cancellation**: Displays the passenger ledger where tickets can be cancelled to immediately free up carriage segments on the seat map.

---

## 🚀 Running the Project

### Option A: Quick Local Run (Zero External Dependencies)

#### 1. Start Backend
```bash
cd backend
npm install
npx prisma generate
npm run dev
```
The backend API server will start on **http://localhost:5001**.

#### 2. Start Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The web application will be live at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

### Option B: Run with Docker Compose

Make sure Docker is running on your machine, then run in the root directory:
```bash
docker compose up --build
```

This starts:
1. **Express API Server** on port `5001`
2. **Vite React Client** on port `5173`

Navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Running Automated Tests

Run the Jest integration and concurrency tests in the `backend` folder:
```bash
cd backend
npm test
```
Or if running via Docker:
```bash
docker compose exec backend npm run test
```

This test suite verifies:
1. **API Health check**.
2. **Segment Occupancy Logic**: Reserving a leg, verifying that overlapping searches show as occupied, and verifying that adjacent legs show as vacated/reusable.
3. **Concurrency Control**: Sending parallel requests for the same seat on overlapping legs, confirming that only one succeeds with a `201 Created` status while the other fails with `409 Conflict`.
4. **Waitlist Auto-Promotion**: Registering waitlists and promoting passengers when conflicting seats are cancelled.

