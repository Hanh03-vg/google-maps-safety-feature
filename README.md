# Google Maps Safety Feature

A browser-based concept for a safety-oriented extension of Google Maps. The application compares a standard walking route with a safety-focused alternative and provides optional support functions during an active journey.

## Main features

- Standard walking route calculation
- Alternative Safe Route with a limited detour
- Simulated safety indicators:
  - street lighting
  - nearby open businesses
  - travel density
  - recent safety reports
  - verified safe points
- Map markers for open businesses and verified safe points
- Safe Journey monitoring
- Automatic check-in after unusual inactivity
- Notification of saved emergency contacts and verified nearby support
- Confirmed escalation to emergency services with location sharing
- Optional taxi pickup points
- Configurable safety settings
- Late-night notification entry point
- Address autocomplete through Geoapify
- Rural and urban route context classification through countries.dev place data

## User flow

1. The user opens Google Maps through the late-night notification.
2. A starting point and destination are entered.
3. The normal walking route is calculated.
4. The user can compare it with the Safe Route.
5. The Safe Route explains why the alternative may feel safer.
6. The user starts a Safe Journey.
7. Saved emergency contacts are informed when contact sharing is enabled.
8. Monitoring detects unusual inactivity and opens a safety check-in.
9. The user can confirm that they are safe or request help.
10. If the check-in is unanswered, enabled support channels are notified.
11. Emergency services can be notified through the escalation action, sharing the current location and Safe Journey status.
12. The user can alternatively display nearby taxi pickup options.

## Technologies

- HTML
- CSS
- JavaScript
- Google Maps JavaScript API
- Google Routes API
- Geoapify API
- countries.dev Places API

## Project structure

```text
.
├── index.html
├── style.css
├── script.js
├── config.example.js
├── config.js
├── .gitignore
└── README.md
```

`config.js` contains local API keys and must not be committed to GitHub.

## Local setup

1. Clone or download the repository.
2. Copy `config.example.js`.
3. Rename the copy to `config.js`.
4. Add your own API keys:

```js
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
const GEOAPIFY_API_KEY = "YOUR_GEOAPIFY_API_KEY";
```

5. Open the project through a local web server.