# VehicleGuard — React Vehicle Complaint Management System

Frontend-only React project for a vehicle complaint / theft reporting portal.

## Technology
- React.js
- JavaScript
- HTML
- CSS
- Vite
- Leaflet + React Leaflet
- OpenStreetMap
- Nominatim geocoding
- Browser Geolocation API
- localStorage

## Features
1. Dashboard with complaint statistics
2. Vehicle theft / missing vehicle complaint form
3. Complainant name, phone, email and address
4. Vehicle number, type and complaint type
5. FIR / CSR number field
6. Incident date, time and description
7. Interactive OpenStreetMap map
8. Search a city, street, landmark or address and jump to that exact search result
9. Use browser GPS location
10. Click anywhere on the map to choose a location
11. Reverse geocoding for selected locations
12. Latitude and longitude display
13. Complaint submission
14. Complaint records stored in browser localStorage
15. Change case status: Pending / Investigating / Resolved
16. View saved complaint location on map
17. Responsive UI for desktop/tablet/mobile

## Run
Install Node.js first.

Open this project folder in VS Code terminal:

```bash
npm install
npm run dev
```

Vite will show a local URL, normally:

`http://localhost:5173`

Open that URL in your browser.

## Important
This is a frontend-only academic/demo project. It does NOT actually submit an FIR to police systems or store data on a server.

Map tiles are provided by OpenStreetMap and place search uses Nominatim. Internet access is required for the map and search.

For browser GPS, allow location permission when the browser asks.

## Project structure

vehicle-complaint-react/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.jsx
    └── styles.css
