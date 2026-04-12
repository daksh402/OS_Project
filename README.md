# Scheduler Pro Dashboard

A full-stack CPU scheduling simulator built from scratch with a Node.js backend and a browser-based dashboard frontend.

## Features

- Multiple CPU scheduling algorithms:
  - FCFS
  - SJF
  - SRTF
  - Priority
  - Priority Aging
  - Round Robin
- CPU-I/O-CPU cycle simulation using multiple CPU bursts and I/O bursts
- Split-screen Gantt chart comparison for multiple algorithms
- CPU utilization graph
- Automatic metrics:
  - Waiting Time
  - Turnaround Time
  - Response Time
  - Throughput
  - CPU Utilization
- Deadlock avoidance using Banker’s Algorithm
- Visual resource-allocation / request graph
- Dark mode, light mode, and system theme support

## Tech Stack

- Backend: Node.js built-in `http` server
- Frontend: HTML, CSS, JavaScript
- No external runtime dependencies required

## Project Structure

```text
scheduler-pro-dashboard/
├─ lib/
│  └─ scheduler.js
├─ public/
│  ├─ app.js
│  ├─ index.html
│  └─ styles.css
├─ package.json
├─ server.js
└─ README.md
```

## How It Works

1. Users enter process details including arrival time, priority, CPU bursts, I/O bursts, and resource data.
2. The frontend sends the workload to the backend `/api/simulate` endpoint.
3. The backend simulates the selected scheduling algorithms.
4. Banker’s Algorithm checks whether resource requests are safe to grant.
5. The frontend renders:
   - ranking cards
   - Gantt charts
   - queue states
   - CPU utilization graph
   - deadlock graph

## Run Locally

Open a terminal in the project folder and run:

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

## API Endpoints

### `GET /api/health`

Returns service health.

### `GET /api/defaults`

Returns the default demo dataset.

### `POST /api/simulate`

Runs the scheduling simulation.

Example payload:

```json
{
  "processes": [
    {
      "pid": "P1",
      "arrivalTime": 0,
      "priority": 2,
      "cpuBursts": [4, 3],
      "ioBursts": [2],
      "maxResources": [3, 2, 1],
      "allocation": [1, 0, 0],
      "request": [1, 1, 0]
    }
  ],
  "quantum": 2,
  "algorithms": ["fcfs", "srtf", "rr", "aging"],
  "totalResources": [7, 5, 4]
}
```

## Deployment

This app can be hosted easily on:

- Render
- Railway
- VPS with Node.js

Start command:

```bash
node server.js
```

The app uses:

```js
process.env.PORT || 3000
```

so it works with most hosting providers out of the box.

## Notes

- The simulator is dynamic, but it includes a demo dataset and predefined algorithm list for convenience.
- Deadlock handling is implemented with Banker’s Algorithm and visualized as a resource graph.
- The project is designed as a single-service full-stack app where frontend and backend are served together.

## Author

Built for CPU scheduling visualization, comparison, and deadlock-avoidance analysis.
