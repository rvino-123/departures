# Departures

A personal phone web app (PWA): open it and it shows live departures from the station you're nearest to, covering National Rail (including the Elizabeth line and Overground), the Tube and the DLR. Trains that call at your home station are pinned at the top.

## How it works

- **Where you are:** GPS each time the app opens. National Rail stations come from a bundled list (`src/data/stations.json`); Tube and DLR stations come from TfL's nearby search. Platforms within 150 m of each other, or linked by TfL's interchange code, become one station. The nearest station is shown, with tabs for the next two closest stations.
- **National Rail:** Rail Data Marketplace "Live Departure Board", called from the phone with your key (`x-apikey`). The key is stored only in the browser's localStorage.
- **Tube & DLR:** TfL Unified API arrivals (no key needed).
- **To home:** a second National Rail request filtered to trains calling at your home station (`filterCrs` + `filterType=to`), looking up to 3 hours ahead.
- **Usage:** Settings → Usage shows how many API requests this phone has made (last minute, today, 7 and 30 days), split by National Rail and TfL. Counts stay on the device for 30 days.
- **Fallbacks:** if location is denied, too vague (over 1 km), or more than 3 km from a station, it shows your home station's board plus a search box. With no signal, it shows the last board it loaded, marked "Offline".

## Get a National Rail key

1. Register for free at [raildata.org.uk](https://raildata.org.uk).
2. Find **Live Departure Board** in the catalogue and subscribe.
3. Copy the product's Consumer key and paste it into the app's settings.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173/departures/?at=51.5178,-0.0817  (?at= fakes GPS in dev only)
npm test        # unit tests for the station, board and home-train logic
npm run build
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Credits

- Powered by TfL Open Data.
- National Rail Enquiries data via Rail Data Marketplace.
- Station list: [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations), ODbL.
