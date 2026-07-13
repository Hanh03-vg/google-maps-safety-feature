"use strict";

/* ==========================================================================
   1. SETUP, KONSTANTEN UND ZUSTAND
   ========================================================================== */

// Die vorhandenen Demo-Zeiten bleiben unverändert, damit während der
// Präsentation genug Zeit zum Erklären bleibt.
const MONITORING_STATUS_DELAY_MS = 7000;
const CHECK_IN_TRIGGER_DELAY_MS = 14000;

// Nach dem sichtbaren Check-in bleibt genug Zeit zum Erklären und Reagieren.
// Im realen Produkt wäre dieser Wert deutlich länger und fachlich zu validieren.
const CHECK_IN_RESPONSE_TIMEOUT_MS = 30000;

let map = null;
let RouteClass = null;
let normalRoute = null;
let safeRoute = null;
let normalRouteLine = null;
let safeRouteLine = null;
let startMarker = null;
let destinationMarker = null;
let safePointMarker = null;
let selectedMode = "normal";
let safeRouteLoaded = false;
let monitoringTimer = null;
let checkInTimer = null;
let checkInResponseTimer = null;
let safetyDataMarkers = [];
let currentSafetyProfile = null;
let taxiMarkers = [];
let taxiRouteLine = null;
let simulatedCurrentPosition = null;
let currentPositionMarker = null;
let safetySettings = loadSafetySettings();

const routeCard = document.getElementById("routeCard");
const journeyCard = document.getElementById("journeyCard");
const safeDetails = document.getElementById("safeDetails");
const checkInOverlay = document.getElementById("checkInOverlay");
const supportOverlay = document.getElementById("supportOverlay");
const emergencyConfirmOverlay = document.getElementById(
  "emergencyConfirmOverlay",
);
const statusMessage = document.getElementById("statusMessage");
const featureInfo = document.getElementById("featureInfo");
const taxiOptionCard = document.getElementById("taxiOptionCard");
const taxiModeCard = document.getElementById("taxiModeCard");
const lockScreen = document.getElementById("lockScreen");
const lateNightNotification = document.getElementById("lateNightNotification");
const settingsPanel = document.getElementById("settingsPanel");
const settingsButton = document.getElementById("settingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const featureEmergencyContact = document.getElementById(
  "featureEmergencyContact",
);
const featureCheckIn = document.getElementById("featureCheckIn");
const featureLocalSupport = document.getElementById("featureLocalSupport");
const featureTaxiPickup = document.getElementById("featureTaxiPickup");
const contactManagement = document.getElementById("contactManagement");
const contactList = document.getElementById("contactList");
const contactNameInput = document.getElementById("contactNameInput");
const addContactButton = document.getElementById("addContactButton");

/* ==========================================================================
   GEMEINSAME DOM-HILFSFUNKTIONEN
   ========================================================================== */

function showElement(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hideElement(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function setStatus(message) {
  statusMessage.textContent = message;
}

/* ==========================================================================
   2. KARTENINITIALISIERUNG UND EVENT-BINDING
   ========================================================================== */

async function initMap() {
  try {
    const mapsLibrary = await google.maps.importLibrary("maps");
    const routesLibrary = await google.maps.importLibrary("routes");

    RouteClass = routesLibrary.Route;

    map = new mapsLibrary.Map(document.getElementById("map"), {
      center: {
        lat: 52.52,
        lng: 13.405,
      },
      zoom: 13,
      mapId: "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    bindEvents();
    setupGeoapifyAutocomplete();

    setStatus("Enter a starting point and destination.");
  } catch (error) {
    console.error(error);

    setStatus("Google Maps could not be loaded.");
  }
}

function bindEvents() {
  document
    .getElementById("searchButton")
    .addEventListener("click", searchNormalRoute);

  document
    .getElementById("normalRouteButton")
    .addEventListener("click", showNormalRoute);

  document
    .getElementById("safeRouteButton")
    .addEventListener("click", showSafeRoute);

  document
    .getElementById("startJourneyButton")
    .addEventListener("click", startJourney);

  document
    .getElementById("confirmSafeButton")
    .addEventListener("click", confirmSafe);

  document
    .getElementById("needHelpButton")
    .addEventListener("click", requestLocalHelp);

  document
    .getElementById("escalateButton")
    .addEventListener("click", openEmergencyConfirmation);

  document
    .getElementById("confirmEmergencyButton")
    .addEventListener("click", confirmEmergencyEscalation);

  document
    .getElementById("cancelEmergencyButton")
    .addEventListener("click", closeEmergencyConfirmation);

  document
    .getElementById("closeSupportButton")
    .addEventListener("click", closeSupport);

  document
    .getElementById("closeJourneyButton")
    .addEventListener("click", closeJourney);

  document
    .getElementById("startInput")
    .addEventListener("keydown", handleEnter);

  document
    .getElementById("destinationInput")
    .addEventListener("keydown", handleEnter);

  document
    .getElementById("showTaxiButton")
    .addEventListener("click", showTaxiOptions);

  document
    .getElementById("backToSafeRouteButton")
    .addEventListener("click", returnToSafeRoute);

  lateNightNotification.addEventListener(
    "click",
    openFromLateNightNotification,
  );

  lateNightNotification.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFromLateNightNotification();
    }
  });

  settingsButton.addEventListener("click", openSettingsPanel);

  closeSettingsButton.addEventListener("click", closeSettingsPanel);

  featureEmergencyContact.addEventListener(
    "change",
    updateSafetySettingsFromPanel,
  );

  featureCheckIn.addEventListener("change", updateSafetySettingsFromPanel);

  featureLocalSupport.addEventListener("change", updateSafetySettingsFromPanel);

  featureTaxiPickup.addEventListener("change", updateSafetySettingsFromPanel);

  addContactButton.addEventListener("click", addEmergencyContact);

  contactNameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      addEmergencyContact();
    }
  });

  renderSettingsPanel();
}

function handleEnter(event) {
  if (event.key === "Enter") {
    searchNormalRoute();
  }
}

/* ==========================================================================
   3. ROUTENBERECHNUNG UND NORMALE ROUTE
   ========================================================================== */

async function computeRoute(origin, destination, intermediatePoint) {
  const request = {
    origin: origin,
    destination: destination,
    travelMode: "WALKING",
    fields: ["path", "distanceMeters", "durationMillis", "viewport"],
  };

  if (intermediatePoint) {
    request.intermediates = [
      {
        location: intermediatePoint,
      },
    ];
  }

  const response = await RouteClass.computeRoutes(request);

  if (!response.routes || response.routes.length === 0) {
    throw new Error("No route was found.");
  }

  return response.routes[0];
}

async function searchNormalRoute() {
  const startAddress = document.getElementById("startInput").value.trim();

  const destinationAddress = document
    .getElementById("destinationInput")
    .value.trim();

  if (!startAddress || !destinationAddress) {
    setStatus("Enter both locations.");

    return;
  }

  try {
    setStatus("Searching for walking route...");

    clearAllRoutes();

    safeRoute = null;
    safeRouteLoaded = false;

    normalRoute = await computeRoute(startAddress, destinationAddress, null);

    drawNormalRoute();
    updateNormalSummary();
    createEndpointMarkers();

    if (normalRoute.viewport) {
      map.fitBounds(normalRoute.viewport, 70);
    }

    selectedMode = "normal";

    updateSelectedButtons();
    hideElement(safeDetails);
    showElement(featureInfo);

    document.getElementById("safeRouteSummary").textContent =
      "Prioritise safety";

    document.getElementById("startJourneyButton").textContent = "Start";

    showElement(routeCard);

    setStatus("Walking route found.");
  } catch (error) {
    console.error(error);

    setStatus(error.message || "The route could not be loaded.");
  }
}

function convertPath(path) {
  return path.map(function (point) {
    return {
      lat: typeof point.lat === "function" ? point.lat() : point.lat,

      lng: typeof point.lng === "function" ? point.lng() : point.lng,
    };
  });
}

function drawNormalRoute() {
  removePolyline(normalRouteLine);

  normalRouteLine = new google.maps.Polyline({
    map: map,
    path: convertPath(normalRoute.path),
    strokeColor: "#1a73e8",
    strokeOpacity: 1,
    strokeWeight: 6,
    zIndex: 2,
  });
}

function drawSafeRoute() {
  removePolyline(safeRouteLine);

  safeRouteLine = new google.maps.Polyline({
    map: map,
    path: convertPath(safeRoute.path),
    strokeColor: "#188038",
    strokeOpacity: 1,
    strokeWeight: 7,
    zIndex: 3,
  });
}

function removePolyline(polyline) {
  if (polyline) {
    polyline.setMap(null);
  }
}

function removeMarker(marker) {
  if (marker) {
    marker.setMap(null);
  }
}

function clearAllRoutes() {
  removePolyline(normalRouteLine);
  removePolyline(safeRouteLine);

  removeMarker(startMarker);
  removeMarker(destinationMarker);
  removeMarker(safePointMarker);

  clearSafetyDataMarkers();
  clearTaxiMarkers();
  clearTaxiRoute();
  clearCurrentPositionMarker();

  normalRouteLine = null;
  safeRouteLine = null;

  startMarker = null;
  destinationMarker = null;
  safePointMarker = null;
}

function createEndpointMarkers() {
  if (!normalRoute.path || normalRoute.path.length < 2) {
    return;
  }

  const convertedPath = convertPath(normalRoute.path);

  const firstPoint = convertedPath[0];

  const finalPoint = convertedPath[convertedPath.length - 1];

  startMarker = new google.maps.Marker({
    map: map,
    position: firstPoint,
    label: "A",
    title: "Starting point",
  });

  destinationMarker = new google.maps.Marker({
    map: map,
    position: finalPoint,
    label: "B",
    title: "Destination",
  });
}

function calculateSafePoint(detourDistance) {
  const convertedPath = convertPath(normalRoute.path);

  const middleIndex = Math.floor(convertedPath.length / 2);

  const previousIndex = Math.max(0, middleIndex - 3);

  const nextIndex = Math.min(convertedPath.length - 1, middleIndex + 3);

  const middlePoint = convertedPath[middleIndex];

  const previousPoint = convertedPath[previousIndex];

  const nextPoint = convertedPath[nextIndex];

  const directionLat = nextPoint.lat - previousPoint.lat;

  const directionLng = nextPoint.lng - previousPoint.lng;

  const length = Math.sqrt(
    directionLat * directionLat + directionLng * directionLng,
  );

  if (length === 0) {
    return {
      lat: middlePoint.lat + 0.006,
      lng: middlePoint.lng + 0.006,
    };
  }

  const perpendicularLat = -directionLng / length;

  const perpendicularLng = directionLat / length;

  return {
    lat: middlePoint.lat + perpendicularLat * detourDistance,

    lng: middlePoint.lng + perpendicularLng * detourDistance,
  };
}

function getDetourMinutes(route) {
  if (
    !normalRoute ||
    !route ||
    !normalRoute.durationMillis ||
    !route.durationMillis
  ) {
    return 0;
  }

  const normalMinutes = Math.round(normalRoute.durationMillis / 60000);

  const routeMinutes = Math.round(route.durationMillis / 60000);

  return routeMinutes - normalMinutes;
}

function routeHasSelfOverlap(route) {
  if (!route || !route.path || route.path.length < 8) {
    return false;
  }

  const path = convertPath(route.path);

  const minimumIndexGap = Math.max(8, Math.floor(path.length * 0.12));

  for (let i = 0; i < path.length; i += 2) {
    for (let j = i + minimumIndexGap; j < path.length; j += 2) {
      const distance = calculateDistanceMeters(path[i], path[j]);

      if (distance < 25) {
        return true;
      }
    }
  }

  return false;
}

function calculateDistanceMeters(pointA, pointB) {
  const earthRadius = 6371000;

  const latA = (pointA.lat * Math.PI) / 180;

  const latB = (pointB.lat * Math.PI) / 180;

  const latDifference = ((pointB.lat - pointA.lat) * Math.PI) / 180;

  const lngDifference = ((pointB.lng - pointA.lng) * Math.PI) / 180;

  const haversine =
    Math.sin(latDifference / 2) * Math.sin(latDifference / 2) +
    Math.cos(latA) *
      Math.cos(latB) *
      Math.sin(lngDifference / 2) *
      Math.sin(lngDifference / 2);

  return (
    earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

/* ==========================================================================
   4. SAFE-ROUTE-LOGIK
   ========================================================================== */

// Mehrere seitliche Zwischenpunkte werden getestet, damit die Alternative
// sicherer wirken kann, ohne einen unplausiblen Umweg oder Selbstüberschneidung.
async function findSafeRouteWithinLimit(startAddress, destinationAddress) {
  const maxDetourMinutes = 10;

  const detourDistances = [
    0.0008, -0.0008, 0.0012, -0.0012, 0.0018, -0.0018, 0.0025, -0.0025,
  ];

  let bestRoute = null;
  let bestSafePoint = null;
  let smallestDetour = Infinity;

  for (const detourDistance of detourDistances) {
    const safePoint = calculateSafePoint(detourDistance);

    const candidateRoute = await computeRoute(
      startAddress,
      destinationAddress,
      safePoint,
    );

    const detourMinutes = getDetourMinutes(candidateRoute);

    const hasSelfOverlap = routeHasSelfOverlap(candidateRoute);

    if (hasSelfOverlap) {
      continue;
    }

    if (detourMinutes <= maxDetourMinutes && detourMinutes >= 0) {
      return {
        route: candidateRoute,
        safePoint: safePoint,
      };
    }

    if (detourMinutes < smallestDetour) {
      smallestDetour = detourMinutes;
      bestRoute = candidateRoute;
      bestSafePoint = safePoint;
    }
  }

  return {
    route: bestRoute,
    safePoint: bestSafePoint,
  };
}

/* ==========================================================================
   5. SICHERHEITSINDIKATOREN UND KARTENMARKER
   ========================================================================== */

// Die Anzahl der simulierten Orte skaliert mit der Routenlänge.
// Dadurch stimmen Anzeige und sichtbare Marker nachvollziehbar überein.
function generateSafetyProfile(routeDistanceMeters) {
  const lightingOptions = ["Medium", "Medium/high", "High"];
  const densityOptions = ["Medium", "Medium/high", "High"];
  const reportOptions = ["Low risk", "Very low risk", "Few recent reports"];

  const routeKm = routeDistanceMeters / 1000;

  let openBusinessMin = 2;
  let openBusinessMax = 4;
  let verifiedMin = 1;
  let verifiedMax = 1;

  if (routeKm < 1) {
    openBusinessMin = 1;
    openBusinessMax = 3;
    verifiedMin = 1;
    verifiedMax = 1;
  } else if (routeKm < 3) {
    openBusinessMin = 3;
    openBusinessMax = 6;
    verifiedMin = 1;
    verifiedMax = 2;
  } else if (routeKm < 8) {
    openBusinessMin = 5;
    openBusinessMax = 9;
    verifiedMin = 1;
    verifiedMax = 3;
  } else {
    openBusinessMin = 8;
    openBusinessMax = 14;
    verifiedMin = 2;
    verifiedMax = 4;
  }

  return {
    streetLighting: pickRandom(lightingOptions),
    openBusinesses: getRandomNumber(openBusinessMin, openBusinessMax),
    travelDensity: pickRandom(densityOptions),
    safetyReports: pickRandom(reportOptions),
    verifiedSafePoints: getRandomNumber(verifiedMin, verifiedMax),
    estimatedDetour: "Calculating...",
  };
}

function calculateDetourText() {
  if (
    !normalRoute ||
    !safeRoute ||
    !normalRoute.durationMillis ||
    !safeRoute.durationMillis
  ) {
    return "Small detour";
  }

  const normalMinutes = Math.round(normalRoute.durationMillis / 60000);

  const safeMinutes = Math.round(safeRoute.durationMillis / 60000);

  const difference = safeMinutes - normalMinutes;

  if (difference <= 0) {
    return "No extra time";
  }

  return "+" + difference + " min";
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateSafetyIndicators(profile) {
  safeDetails.innerHTML =
    "<h3>Why this route is safer</h3>" +
    "<p class='prototype-note'>Safety indicators are simulated for prototype evaluation.</p>" +
    "<div class='safety-grid'>" +
    "<div><strong>Street lighting</strong><span>" +
    profile.streetLighting +
    "</span></div>" +
    "<div><strong><span class='legend-dot business-dot'></span>Open places nearby</strong><span>" +
    profile.openBusinesses +
    "</span></div>" +
    "<div><strong>Travel density</strong><span>" +
    profile.travelDensity +
    "</span></div>" +
    "<div><strong>Safety reports</strong><span>" +
    profile.safetyReports +
    "</span></div>" +
    "<div><strong><span class='legend-dot safe-dot'></span>Verified safe point</strong><span>" +
    profile.verifiedSafePoints +
    " nearby</span></div>" +
    "<div><strong>Estimated detour</strong><span>" +
    calculateDetourText() +
    "</span></div>" +
    "</div>";
}

function clearSafetyDataMarkers() {
  safetyDataMarkers.forEach(function (marker) {
    marker.setMap(null);
  });

  safetyDataMarkers = [];
}

function addSafetyDataMarkers(
  safePoint,
  openBusinessCount,
  verifiedSafePointCount,
) {
  clearSafetyDataMarkers();

  if (!safeRoute || !safeRoute.path || safeRoute.path.length < 2) {
    return;
  }

  const routePath = convertPath(safeRoute.path);

  const businessNames = [
    "Open café",
    "Late-night kiosk",
    "Hotel reception",
    "Open supermarket",
    "Pharmacy emergency service",
    "Open restaurant",
    "24h convenience store",
  ];

  for (let i = 0; i < openBusinessCount; i++) {
    const ratio = (i + 1) / (openBusinessCount + 1);

    const offset = i % 2 === 0 ? 0.00035 : -0.00035;

    const markerPosition = offsetPointNearRoute(routePath, ratio, offset);

    const title = businessNames[i % businessNames.length];

    const marker = new google.maps.Marker({
      map: map,
      position: markerPosition,
      title: title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#fbbc04",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        scale: 8,
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content:
        "<strong>" +
        title +
        "</strong><br>" +
        "Currently open · Publicly accessible<br>" +
        "Safety indicator for this route",
    });

    marker.addListener("click", function () {
      infoWindow.open(map, marker);
    });

    safetyDataMarkers.push(marker);
  }

  for (let i = 1; i < verifiedSafePointCount; i++) {
    const ratio = (i + 1) / (verifiedSafePointCount + 1);

    const markerPosition = offsetPointNearRoute(routePath, ratio, 0.00055);

    const marker = new google.maps.Marker({
      map: map,
      position: markerPosition,
      title: "Verified safe point",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#188038",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        scale: 9,
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content:
        "<strong>Verified safe point</strong><br>" +
        "Verified location near Safe route<br>" +
        "Suitable as a support point during the journey",
    });

    marker.addListener("click", function () {
      infoWindow.open(map, marker);
    });

    safetyDataMarkers.push(marker);
  }
}

function getPointAlongRoute(routePath, ratio) {
  const index = Math.min(
    routePath.length - 1,
    Math.max(0, Math.floor(routePath.length * ratio)),
  );

  return routePath[index];
}

function offsetPointNearRoute(routePath, ratio, offsetDistance) {
  const index = Math.min(
    routePath.length - 2,
    Math.max(1, Math.floor(routePath.length * ratio)),
  );

  const previousPoint = routePath[index - 1];
  const currentPoint = routePath[index];
  const nextPoint = routePath[index + 1];

  const directionLat = nextPoint.lat - previousPoint.lat;

  const directionLng = nextPoint.lng - previousPoint.lng;

  const length = Math.sqrt(
    directionLat * directionLat + directionLng * directionLng,
  );

  if (length === 0) {
    return {
      lat: currentPoint.lat + offsetDistance,
      lng: currentPoint.lng + offsetDistance,
    };
  }

  const perpendicularLat = -directionLng / length;

  const perpendicularLng = directionLat / length;

  return {
    lat: currentPoint.lat + perpendicularLat * offsetDistance,

    lng: currentPoint.lng + perpendicularLng * offsetDistance,
  };
}

async function showSafeRoute() {
  if (!normalRoute) {
    setStatus("Search for a normal route first.");

    return;
  }

  try {
    if (!safeRouteLoaded) {
      setStatus("Calculating Safe route...");

      const startAddress = document.getElementById("startInput").value.trim();

      const destinationAddress = document
        .getElementById("destinationInput")
        .value.trim();

      const safeRouteResult = await findSafeRouteWithinLimit(
        startAddress,
        destinationAddress,
      );

      safeRoute = safeRouteResult.route;

      const safePoint = safeRouteResult.safePoint;

      safeRouteLoaded = true;

      drawSafeRoute();

      safePointMarker = new google.maps.Marker({
        map: map,
        position: safePoint,
        title: "Verified safe point",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#188038",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 9,
        },
      });

      currentSafetyProfile = generateSafetyProfile(safeRoute.distanceMeters);

      addSafetyDataMarkers(
        safePoint,
        currentSafetyProfile.openBusinesses,
        currentSafetyProfile.verifiedSafePoints,
      );

      updateSafeSummary();
      updateSafetyIndicators(currentSafetyProfile);
    } else if (safeRouteLine) {
      safeRouteLine.setMap(map);

      if (safePointMarker) {
        safePointMarker.setMap(map);
      }

      if (currentSafetyProfile && safePointMarker) {
        addSafetyDataMarkers(
          safePointMarker.getPosition().toJSON(),
          currentSafetyProfile.openBusinesses,
          currentSafetyProfile.verifiedSafePoints,
        );

        updateSafetyIndicators(currentSafetyProfile);
      }
    }

    if (normalRouteLine) {
      normalRouteLine.setMap(null);
    }

    selectedMode = "safe";

    updateSelectedButtons();
    showElement(safeDetails);
    hideElement(featureInfo);

    document.getElementById("startJourneyButton").textContent =
      "Start Safe journey";

    if (safeRoute.viewport) {
      map.fitBounds(safeRoute.viewport, 70);
    }

    setStatus("Safe route selected.");
  } catch (error) {
    console.error(error);

    setStatus(error.message || "The Safe route could not be loaded.");
  }
}

function showNormalRoute() {
  if (!normalRoute) {
    return;
  }

  if (safeRouteLine) {
    safeRouteLine.setMap(null);
  }

  if (normalRouteLine) {
    normalRouteLine.setMap(map);
  }

  removeMarker(safePointMarker);
  clearSafetyDataMarkers();

  selectedMode = "normal";

  updateSelectedButtons();
  hideElement(safeDetails);

  document.getElementById("startJourneyButton").textContent = "Start";

  if (normalRoute.viewport) {
    map.fitBounds(normalRoute.viewport, 70);
  }

  setStatus("Normal walking route selected.");
}

function updateSelectedButtons() {
  document
    .getElementById("normalRouteButton")
    .classList.toggle("active", selectedMode === "normal");

  document
    .getElementById("safeRouteButton")
    .classList.toggle("active", selectedMode === "safe");
}

function updateNormalSummary() {
  document.getElementById("normalRouteSummary").textContent =
    formatDuration(normalRoute.durationMillis) +
    " | " +
    formatDistance(normalRoute.distanceMeters);
}

function updateSafeSummary() {
  document.getElementById("safeRouteSummary").textContent =
    formatDuration(safeRoute.durationMillis) +
    " | " +
    formatDistance(safeRoute.distanceMeters);
}

function formatDuration(durationMillis) {
  const minutes = Math.max(1, Math.round(durationMillis / 60000));

  return minutes + " min";
}

function formatDistance(distanceMeters) {
  if (distanceMeters < 1000) {
    return Math.round(distanceMeters) + " m";
  }

  return (distanceMeters / 1000).toFixed(1) + " km";
}

/* ==========================================================================
   7. JOURNEY-MONITORING, CHECK-IN UND SUPPORT-FLOW
   ========================================================================== */

function clearSafetyTimers() {
  if (monitoringTimer) {
    clearTimeout(monitoringTimer);
    monitoringTimer = null;
  }

  if (checkInTimer) {
    clearTimeout(checkInTimer);
    checkInTimer = null;
  }

  if (checkInResponseTimer) {
    clearTimeout(checkInResponseTimer);
    checkInResponseTimer = null;
  }
}

function startJourney() {
  hideElement(routeCard);
  showElement(journeyCard);

  const journeyModeLabel = document.getElementById("journeyModeLabel");
  const journeyTitle = document.getElementById("journeyTitle");
  const journeyStatus = document.getElementById("journeyStatus");

  if (selectedMode === "safe") {
    journeyModeLabel.textContent = "SAFE JOURNEY";
    journeyTitle.textContent = "Safe navigation active";

    setSafeJourneyStatus(
      safetySettings.checkIn
        ? "Journey monitoring and safety check-ins are enabled."
        : "Safe Journey is active.",
    );

    if (safetySettings.taxiPickup) {
      showElement(taxiOptionCard);
    } else {
      hideElement(taxiOptionCard);
    }

    hideElement(taxiModeCard);
    clearSafetyTimers();

    if (safetySettings.checkIn) {
      monitoringTimer = setTimeout(function () {
        setSafeJourneyStatus(
          "Monitoring active. No unusual movement detected.",
        );
      }, MONITORING_STATUS_DELAY_MS);

      checkInTimer = setTimeout(function () {
        setSafeJourneyStatus("You have been stationary for several minutes.");
        openCheckIn();
      }, CHECK_IN_TRIGGER_DELAY_MS);
    }
  } else {
    journeyModeLabel.textContent = "WALKING";
    journeyTitle.textContent = "Navigation active";
    journeyStatus.innerHTML =
      '<p class="journey-note">Follow the highlighted route.</p>';
    hideElement(taxiOptionCard);
    hideElement(taxiModeCard);
  }
}

function closeJourney() {
  clearSafetyTimers();
  hideElement(checkInOverlay);
  hideElement(supportOverlay);
  hideElement(emergencyConfirmOverlay);
  hideElement(journeyCard);
  showElement(routeCard);
}

function openCheckIn() {
  showElement(checkInOverlay);

  if (checkInResponseTimer) {
    clearTimeout(checkInResponseTimer);
  }

  // Erst bei ausbleibender Reaktion wird automatisch Unterstützung informiert.
  checkInResponseTimer = setTimeout(
    handleUnansweredCheckIn,
    CHECK_IN_RESPONSE_TIMEOUT_MS,
  );
}


function confirmSafe() {
  clearCheckInResponseTimer();
  hideElement(checkInOverlay);

  document.getElementById("journeyStatus").textContent =
    "Safety confirmed. Navigation continues.";

  document.getElementById("progressBar").style.width = "62%";
}

function requestLocalHelp() {
  clearCheckInResponseTimer();
  hideElement(checkInOverlay);

  showSupportResult(
    "Support alerted",
    buildSupportNotificationText("You requested help."),
  );
}

function handleUnansweredCheckIn() {
  checkInResponseTimer = null;
  hideElement(checkInOverlay);

  playAttentionSignal();

  showSupportResult(
    "No response received",
    buildSupportNotificationText(
      "An audible alert was activated after the unanswered check-in.",
    ),
  );
}

function clearCheckInResponseTimer() {
  if (checkInResponseTimer) {
    clearTimeout(checkInResponseTimer);
    checkInResponseTimer = null;
  }
}

function buildSupportNotificationText(prefix) {
  const messages = [prefix];

  // Alle gespeicherten Kontakte werden genannt, nicht nur der erste.
  if (
    safetySettings.emergencyContact &&
    safetySettings.contacts &&
    safetySettings.contacts.length > 0
  ) {
    messages.push(
      "Emergency contacts notified: " +
        safetySettings.contacts.join(", ") +
        ".",
    );
  }

  if (safetySettings.localSupport) {
    messages.push(
      "Verified nearby users and participating local businesses were alerted.",
    );
  }

  if (messages.length === 1) {
    messages.push("No support channel is currently enabled in Settings.");
  }

  return messages.join(" ");
}

function showSupportResult(title, text) {
  document.getElementById("supportTitle").textContent = title;
  document.getElementById("supportText").textContent = text;
  document.getElementById("journeyStatus").textContent =
    "Support flow is active.";

  const escalateButton = document.getElementById("escalateButton");

  // Notruf bleibt ein bewusster, zusätzlicher Schritt.
  if (safetySettings.localSupport) {
    showElement(escalateButton);
  } else {
    hideElement(escalateButton);
  }

  showElement(supportOverlay);
}

function openEmergencyConfirmation() {
  showElement(emergencyConfirmOverlay);
}

function closeEmergencyConfirmation() {
  hideElement(emergencyConfirmOverlay);
}

function confirmEmergencyEscalation() {
  hideElement(emergencyConfirmOverlay);

  document.getElementById("supportTitle").textContent =
    "Emergency services notified";

  document.getElementById("supportText").textContent =
    "Emergency services have been notified and received your current location and Safe Journey status.";

  document.getElementById("journeyStatus").textContent =
    "Emergency escalation is active.";

  hideElement(document.getElementById("escalateButton"));
}

function closeSupport() {
  hideElement(supportOverlay);
  hideElement(emergencyConfirmOverlay);
}

function playAttentionSignal() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
  } catch (error) {
    console.warn("Attention signal could not be played.", error);
  }
}

/* ==========================================================================
   8. AUTOCOMPLETE
   ========================================================================== */

function setupGeoapifyAutocomplete() {
  setupAutocompleteForInput("startInput");
  setupAutocompleteForInput("destinationInput");
}

function setupAutocompleteForInput(inputId) {
  const input = document.getElementById(inputId);

  const suggestionBox = document.createElement("div");
  suggestionBox.className = "suggestion-box hidden";

  document.body.appendChild(suggestionBox);

  let debounceTimer = null;

  input.addEventListener("input", function () {
    positionSuggestionBox(input, suggestionBox);
    const query = input.value.trim();

    clearTimeout(debounceTimer);

    if (query.length < 3) {
      hideAutocompleteSuggestions(suggestionBox);
      return;
    }

    debounceTimer = setTimeout(function () {
      loadGeoapifySuggestions(query, suggestionBox, input);
    }, 300);
  });

  input.addEventListener("focus", function () {
    positionSuggestionBox(input, suggestionBox);
    if (input.value.trim().length >= 3) {
      loadGeoapifySuggestions(input.value.trim(), suggestionBox, input);
    }
  });

  document.addEventListener("click", function (event) {
    if (event.target !== input && !suggestionBox.contains(event.target)) {
      hideAutocompleteSuggestions(suggestionBox);
    }
  });
}

function positionSuggestionBox(input, suggestionBox) {
  const rect = input.getBoundingClientRect();

  suggestionBox.style.left = rect.left + "px";
  suggestionBox.style.top = rect.bottom + "px";
  suggestionBox.style.width = rect.width + "px";
}

async function loadGeoapifySuggestions(query, suggestionBox, input) {
  try {
    const url =
      "https://api.geoapify.com/v1/geocode/autocomplete" +
      "?text=" +
      encodeURIComponent(query) +
      "&filter=countrycode:de" +
      "&bias=proximity:13.4050,52.5200" +
      "&limit=5" +
      "&format=json" +
      "&apiKey=" +
      encodeURIComponent(GEOAPIFY_API_KEY);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Autocomplete request failed.");
    }

    const data = await response.json();

    suggestionBox.innerHTML = "";

    if (!data.results || data.results.length === 0) {
      hideAutocompleteSuggestions(suggestionBox);
      return;
    }

    data.results.forEach(function (place) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "suggestion-item";

      item.textContent = place.formatted || place.address_line1 || place.name;

      item.addEventListener("click", function () {
        input.value = item.textContent;
        hideAutocompleteSuggestions(suggestionBox);
      });

      suggestionBox.appendChild(item);
    });

    positionSuggestionBox(input, suggestionBox);
    showAutocompleteSuggestions(suggestionBox);
  } catch (error) {
    console.error(error);
    hideAutocompleteSuggestions(suggestionBox);
  }
}

function showAutocompleteSuggestions(suggestionBox) {
  suggestionBox.classList.remove("hidden");
}

function hideAutocompleteSuggestions(suggestionBox) {
  suggestionBox.classList.add("hidden");
}

/* ==========================================================================
   9. TAXI-PICKUP ALS OPTIONALE PLAN-B-FUNKTION
   ========================================================================== */

function clearTaxiMarkers() {
  taxiMarkers.forEach(function (marker) {
    marker.setMap(null);
  });

  taxiMarkers = [];
}

function clearTaxiRoute() {
  if (taxiRouteLine) {
    taxiRouteLine.setMap(null);
    taxiRouteLine = null;
  }
}

function clearCurrentPositionMarker() {
  if (currentPositionMarker) {
    currentPositionMarker.setMap(null);
    currentPositionMarker = null;
  }
}

function getSimulatedCurrentPosition() {
  if (!safeRoute || !safeRoute.path || safeRoute.path.length < 2) {
    return null;
  }

  const routePath = convertPath(safeRoute.path);

  return getPointAlongRoute(routePath, 0.35);
}

function showCurrentPositionMarker(position) {
  clearCurrentPositionMarker();

  currentPositionMarker = new google.maps.Marker({
    map: map,
    position: position,
    title: "Current position",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "#34a853",
      fillOpacity: 1,
      strokeColor: "#b7f0c0",
      strokeWeight: 6,
      scale: 8,
    },
  });
}

function showTaxiOptions() {
  if (!safeRoute) {
    return;
  }

  clearTaxiMarkers();
  clearTaxiRoute();
  clearSafetyDataMarkers();

  if (safePointMarker) {
    safePointMarker.setMap(null);
  }

  simulatedCurrentPosition = getSimulatedCurrentPosition();

  if (!simulatedCurrentPosition) {
    return;
  }

  showCurrentPositionMarker(simulatedCurrentPosition);

  createTaxiPickupMarkers();

  hideElement(taxiOptionCard);
  showElement(taxiModeCard);

  setSafeJourneyStatus("Taxi pickup options are shown near the route.");
}

function createTaxiPickupMarkers() {
  if (!safeRoute || !safeRoute.path || safeRoute.path.length < 2) {
    return;
  }

  const routePath = convertPath(safeRoute.path);

  const taxiOptions = [
    {
      title: "Taxi stand",
      subtitle: "Taxi pickup point · approx. 7 min walk",
      ratio: 0.42,
      offset: 0.0012,
    },
    {
      title: "Hotel pickup point",
      subtitle: "Public pickup point · approx. 10 min walk",
      ratio: 0.63,
      offset: -0.0016,
    },
    {
      title: "Station pickup area",
      subtitle: "Taxi pickup area · approx. 14 min walk",
      ratio: 0.82,
      offset: 0.0021,
    },
  ];

  taxiOptions.forEach(function (option) {
    const position = offsetPointNearRoute(
      routePath,
      option.ratio,
      option.offset,
    );

    const marker = new google.maps.Marker({
      map: map,
      position: position,
      title: option.title,
      label: {
        text: "T",
        color: "#202124",
        fontWeight: "bold",
      },
      icon: {
        path: "M -10 -10 L 10 -10 L 10 10 L -10 10 Z",
        fillColor: "#ffea00",
        fillOpacity: 1,
        strokeColor: "#202124",
        strokeWeight: 2,
        scale: 1,
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content:
        "<strong>" +
        option.title +
        "</strong><br>" +
        option.subtitle +
        "<br>" +
        "<button class='map-popup-button' onclick='selectTaxiPickup(" +
        JSON.stringify(position.lat) +
        "," +
        JSON.stringify(position.lng) +
        ")'>Choose this pickup</button>",
    });

    marker.addListener("click", function () {
      infoWindow.open(map, marker);
    });

    taxiMarkers.push(marker);
  });
}

async function selectTaxiPickup(lat, lng) {
  const taxiPoint = {
    lat: lat,
    lng: lng,
  };

  if (!simulatedCurrentPosition) {
    simulatedCurrentPosition = getSimulatedCurrentPosition();
  }

  if (!simulatedCurrentPosition) {
    return;
  }

  try {
    clearTaxiRoute();

    if (safeRouteLine) {
      safeRouteLine.setMap(null);
    }

    if (normalRouteLine) {
      normalRouteLine.setMap(null);
    }

    const taxiRoute = await computeRoute(
      simulatedCurrentPosition,
      taxiPoint,
      null,
    );

    taxiRouteLine = new google.maps.Polyline({
      map: map,
      path: convertPath(taxiRoute.path),
      strokeColor: "#f29900",
      strokeOpacity: 1,
      strokeWeight: 7,
      zIndex: 5,
    });

    if (taxiRoute.viewport) {
      map.fitBounds(taxiRoute.viewport, 70);
    }

    setSafeJourneyStatus("Route updated to the selected taxi pickup point.");
  } catch (error) {
    console.error(error);

    document.getElementById("journeyStatus").textContent =
      "Taxi pickup route could not be calculated.";
  }
}

function returnToSafeRoute() {

  clearTaxiMarkers();
  clearTaxiRoute();
  clearCurrentPositionMarker();

  if (safeRouteLine) {
    safeRouteLine.setMap(map);
  }

  if (safePointMarker) {
    safePointMarker.setMap(map);
  }

  if (currentSafetyProfile && safePointMarker) {
    addSafetyDataMarkers(
      safePointMarker.getPosition().toJSON(),
      currentSafetyProfile.openBusinesses,
      currentSafetyProfile.verifiedSafePoints,
    );
  }

  showElement(taxiOptionCard);
  hideElement(taxiModeCard);

  setSafeJourneyStatus("Back on Safe route. Monitoring remains active.");

  if (safeRoute.viewport) {
    map.fitBounds(safeRoute.viewport, 70);
  }
}

/* ==========================================================================
   10. LATE-NIGHT-BENACHRICHTIGUNG
   ========================================================================== */

function openFromLateNightNotification() {
  hideElement(lockScreen);

  document.getElementById("startInput").focus();
}

/* ==========================================================================
   11. EINSTELLUNGEN, KONTAKTE UND LOCAL STORAGE
   ========================================================================== */

function loadSafetySettings() {
  const savedSettings = localStorage.getItem("safetySettings");

  if (savedSettings) {
    let parsedSettings;

    try {
      parsedSettings = JSON.parse(savedSettings);
    } catch (error) {
      console.warn("Saved safety settings could not be read.", error);
      localStorage.removeItem("safetySettings");
      parsedSettings = {};
    }

    // Bestehende Browserdaten aus älteren Prototype-Versionen weiterverwenden.
    if (
      parsedSettings.localSupport === undefined &&
      parsedSettings.sosSupport !== undefined
    ) {
      parsedSettings.localSupport = parsedSettings.sosSupport;
      delete parsedSettings.sosSupport;
    }

    return {
      emergencyContact: parsedSettings.emergencyContact ?? true,
      checkIn: parsedSettings.checkIn ?? true,
      localSupport: parsedSettings.localSupport ?? true,
      taxiPickup: parsedSettings.taxiPickup ?? true,
      contacts: Array.isArray(parsedSettings.contacts)
        ? parsedSettings.contacts
        : ["Anna"],
    };
  }

  return {
    emergencyContact: true,
    checkIn: true,
    localSupport: true,
    taxiPickup: true,
    contacts: ["Anna"],
  };
}

function saveSafetySettings() {
  localStorage.setItem("safetySettings", JSON.stringify(safetySettings));
}

function openSettingsPanel() {
  renderSettingsPanel();
  showElement(settingsPanel);
}

function closeSettingsPanel() {
  hideElement(settingsPanel);
}

function updateSafetySettingsFromPanel() {
  safetySettings.emergencyContact = featureEmergencyContact.checked;

  safetySettings.checkIn = featureCheckIn.checked;

  safetySettings.localSupport = featureLocalSupport.checked;

  safetySettings.taxiPickup = featureTaxiPickup.checked;

  saveSafetySettings();
  renderSettingsPanel();
  applyFeatureVisibility();
}

function renderSettingsPanel() {
  featureEmergencyContact.checked = safetySettings.emergencyContact;

  featureCheckIn.checked = safetySettings.checkIn;

  featureLocalSupport.checked = safetySettings.localSupport;

  featureTaxiPickup.checked = safetySettings.taxiPickup;

  contactManagement.classList.toggle(
    "hidden",
    !safetySettings.emergencyContact,
  );

  contactList.innerHTML = "";

  if (!safetySettings.contacts || safetySettings.contacts.length === 0) {
    contactList.innerHTML =
      "<p class='empty-contact-note'>No contact added.</p>";
  } else {
    safetySettings.contacts.forEach(function (contactName, index) {
      const contactItem = document.createElement("div");

      contactItem.className = "contact-item";

      contactItem.innerHTML =
        "<span>" +
        contactName +
        "</span>" +
        "<button type='button'>Delete</button>";

      contactItem
        .querySelector("button")
        .addEventListener("click", function () {
          deleteEmergencyContact(index);
        });

      contactList.appendChild(contactItem);
    });
  }
}

function addEmergencyContact() {
  const newContact = contactNameInput.value.trim();

  if (!newContact) {
    return;
  }

  safetySettings.contacts.push(newContact);

  contactNameInput.value = "";

  saveSafetySettings();
  renderSettingsPanel();
}

function deleteEmergencyContact(index) {
  safetySettings.contacts.splice(index, 1);

  saveSafetySettings();
  renderSettingsPanel();
}

function applyFeatureVisibility() {
  if (!safetySettings.taxiPickup) {
    hideElement(taxiOptionCard);
    hideElement(taxiModeCard);
    clearTaxiMarkers();
    clearTaxiRoute();
    clearCurrentPositionMarker();
  }

  if (!safetySettings.checkIn) {
    clearSafetyTimers();
    hideElement(checkInOverlay);
  }

  if (!safetySettings.localSupport) {
    hideElement(supportOverlay);
    hideElement(emergencyConfirmOverlay);
  }
}

function getEmergencyContactStatusHtml() {
  if (!safetySettings.emergencyContact) {
    return "";
  }

  if (!safetySettings.contacts || safetySettings.contacts.length === 0) {
    return (
      "<div class='contact-alert'>" +
      "<strong>No emergency contact set</strong>" +
      "<span>Add a contact in Settings to enable contact sharing.</span>" +
      "</div>"
    );
  }

  const contactText = safetySettings.contacts.join(", ");

  return (
    "<div class='contact-alert'>" +
    "<strong>Emergency contacts notified</strong>" +
    "<span>" +
    contactText +
    " can now see your Safe journey status.</span>" +
    "</div>"
  );
}

function setSafeJourneyStatus(note) {
  document.getElementById("journeyStatus").innerHTML =
    getEmergencyContactStatusHtml() +
    "<p class='journey-note'>" +
    note +
    "</p>";
}

window.initMap = initMap;
