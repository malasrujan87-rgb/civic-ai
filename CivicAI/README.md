# CivicAI – Smart Civic Action Platform

A beginner-friendly prototype for the “From Complaints to Action” challenge.

## What is included
- Citizen complaint form with optional image upload and location coordinates
- Node.js + Express backend and JSON-file storage
- Explainable rule-based category detection and priority scoring
- Possible duplicate detection using word-set similarity and location
- Admin complaint table, assignment and status workflow
- Citizen complaint tracking by report ID
- Location hotspot summary and optional map pins (Leaflet / OpenStreetMap)
- Dashboard statistics and category summaries

## Requirements
- Node.js 18 or later
- VS Code (recommended)
- Internet connection for Google Fonts, Leaflet map library and map tiles

## Run the project
1. Extract the ZIP file.
2. Open the `CivicAI` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm start
   ```

5. Open `http://localhost:3000` in your browser.

## Suggested demo
1. Open **Report an issue**.
2. Submit “Large pothole near the city bus stand” with location “City Bus Stand, Mysuru”.
3. Submit a similar complaint at the same location to demonstrate possible duplicate detection.
4. Submit “Blocked drain causing water to enter houses” at a nearby location to demonstrate a high-priority suggestion.
5. Open **Overview** to see counts and AI insights.
6. Open **Complaints**, choose **Manage**, assign a team and update the status.
7. Open the Track view by entering the report ID. (The Track view is available from the application by navigating to `/` and using the browser console only in this starter; the report tracking form is included in the app source and can be exposed from a nav link in a later iteration.)

## Important limitations / honesty note
- The “AI” in this prototype is a transparent rule-based analysis and text-similarity heuristic. It is not a trained machine-learning model or a connected commercial LLM.
- Duplicate matches are suggestions, not proof. A human should verify them.
- Priority scores are illustrative decision support, not official emergency triage.
- Hotspots are grouped by matching location text. This is not advanced geospatial clustering.
- The map displays only reports where latitude and longitude were supplied. The map itself uses OpenStreetMap tiles and needs internet.
- This is a local demo prototype, not connected to a real municipality or government department.
- Data is stored in a local JSON file. It is not production-secure, has no authentication, and should not store real personal or sensitive data.
- Image upload is limited to image files up to 5 MB.

## Project structure
```text
CivicAI/
  data/reports.json
  uploads/
  public/
    index.html
    styles.css
    app.js
  package.json
  server.js
  README.md
```
