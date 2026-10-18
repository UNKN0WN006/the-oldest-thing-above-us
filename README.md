# Above Us

### A Cosmic Compass hackathon project

Look up. There may be something older than you moving silently overhead.

**Above Us** is a small space-history archive that helps people connect an ordinary place on Earth with the human-made objects that have spent decades above it. Enter a city, explore a sample result, and follow the story behind an object in orbit.

The project is being built by **Cosmic Compass**.

## Why we made it

Satellites are easy to think of as distant technology. They are also pieces of history: launched during different eras, built for different purposes, and still travelling around the same planet we live on.

We wanted to make that history feel close to home.

## What is here

- A simple city search
- A browser location option, with permission and fallback handling
- A result page for an orbital object
- Object stories with mission notes, metadata, and a timeline
- An Explore page for the sample archive
- A dark, quiet visual style inspired by space photographs and museum catalogues
- Local space imagery and a small orbit animation with credits

## Current state

This is a frontend prototype for the hackathon. The interface is ready to be connected to the orbital data service, but the current result and pass details are still sample data.

The prototype does **not** currently provide:

- Live orbital predictions
- Verified visibility from a specific location
- Naked-eye visibility claims
- A backend service or persistent database

The data adapter is kept separate in [`lib/data.ts`](./lib/data.ts) so a future FastAPI service can replace the sample source without rewriting the pages.

## Run it locally

You will need Node.js and npm installed.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create and run a production build:

```bash
npm run build
npm start
```

## Project map

```text
app/                 Pages and routes
components/          Reusable interface pieces
lib/data.ts          Data adapter
lib/mockData.ts      Sample object record
lib/types.ts         Shared TypeScript types
public/images/       Local images and animation assets
```

## Credits

- NASA / Apollo 8 Earth image
- NASA Goddard / Hubble Space Telescope image
- NASA Blue Marble via Wikimedia Commons
- “Geostationary orbit animation” by Amitchell125, CC BY-SA 4.0, via Wikimedia Commons

## The idea in one line

**Above Us** turns the sky above an everyday location into a doorway to space history.
