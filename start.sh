#!/bin/bash

# Go to the directory where this script lives
cd "$(dirname "$0")" || exit

echo "=== Starting FastAPI Backend ==="
cd API || exit
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Backend running (PID: $BACKEND_PID) on http://localhost:8000"

echo ""
echo "=== Starting Next.js Frontend ==="
cd ../frontend || exit
npm install
npm run dev &

FRONTEND_PID=$!
echo "Frontend running (PID: $FRONTEND_PID) on http://localhost:3000"

echo ""
echo "=== All systems running ==="
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press CTRL+C to stop both servers."
wait
