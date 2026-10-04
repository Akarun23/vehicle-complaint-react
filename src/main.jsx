import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

/* =========================================================
   DEFAULT MAP LOCATION
========================================================= */

const DEFAULT_CENTER = [20.5937, 78.9629];

/* =========================================================
   LEAFLET MARKER ICON
========================================================= */

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/* =========================================================
   MAP RECENTER COMPONENT
========================================================= */

function MapRecenter({ position, zoom = 15 }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, {
        duration: 1.5,
      });
    }
  }, [position, zoom, map]);

  return null;
}

/* =========================================================
   MAP CLICK COMPONENT
========================================================= */

function ClickPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

/* =========================================================
   REVERSE GEOCODING
   LAT/LONG -> ADDRESS
========================================================= */

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const data = await response.json();

    return data.display_name || "";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "";
  }
}

/* =========================================================
   PLACE SEARCH
   ADDRESS -> LAT/LONG
========================================================= */

async function searchPlace(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2` +
    `&limit=1` +
    `&addressdetails=1` +
    `&q=${encodeURIComponent(query)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Place search failed");
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    throw new Error("Place not found");
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    name: data[0].display_name,
  };
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  /* =======================================================
     ACTIVE PAGE
  ======================================================= */

  const [activePage, setActivePage] = useState("dashboard");

  /* =======================================================
     COMPLAINTS
  ======================================================= */

  const [complaints, setComplaints] = useState(() => {
    try {
      const saved = localStorage.getItem("vehicleComplaints");

      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Could not load complaints:", error);
      return [];
    }
  });

  /* =======================================================
     FORM DATA
  ======================================================= */

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",

    vehicleNumber: "",
    vehicleType: "Car",

    complaintType: "Vehicle Theft",

    incidentDate: "",
    incidentTime: "",

    description: "",

    firNumber: "",
  });

  /* =======================================================
     MAP DATA
  ======================================================= */

  const [location, setLocation] = useState(null);

  const [locationAddress, setLocationAddress] = useState("");

  const [search, setSearch] = useState("");

  const [mapMessage, setMapMessage] = useState(
    "Search a place or use your current location.",
  );

  const [searching, setSearching] = useState(false);

  const [locating, setLocating] = useState(false);

  /* =======================================================
     TOAST
  ======================================================= */

  const [toast, setToast] = useState("");

  /* =======================================================
     SAVE COMPLAINTS TO LOCAL STORAGE
  ======================================================= */

  useEffect(() => {
    localStorage.setItem("vehicleComplaints", JSON.stringify(complaints));
  }, [complaints]);

  /* =======================================================
     TOAST TIMER
  ======================================================= */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => {
      setToast("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  /* =======================================================
     DASHBOARD STATISTICS
  ======================================================= */

  const stats = useMemo(() => {
    return {
      total: complaints.length,

      theft: complaints.filter(
        (complaint) => complaint.complaintType === "Vehicle Theft",
      ).length,

      pending: complaints.filter((complaint) => complaint.status === "Pending")
        .length,

      resolved: complaints.filter(
        (complaint) => complaint.status === "Resolved",
      ).length,
    };
  }, [complaints]);

  /* =======================================================
     UPDATE FORM FIELD
  ======================================================= */

  const updateField = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  /* =======================================================
     SELECT MAP LOCATION
  ======================================================= */

  const selectLocation = async (latitude, longitude, address = "") => {
    const coordinates = [Number(latitude), Number(longitude)];

    setLocation(coordinates);

    if (address) {
      setLocationAddress(address);
      return;
    }

    const reverseAddress = await reverseGeocode(latitude, longitude);

    if (reverseAddress) {
      setLocationAddress(reverseAddress);
    } else {
      setLocationAddress(
        `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`,
      );
    }
  };

  /* =======================================================
     MAP SEARCH
     
     IMPORTANT:
     This function does NOT submit the complaint form.
  ======================================================= */

  const handleSearch = async () => {
    const query = search.trim();

    if (!query) {
      setMapMessage("Please enter a place to search.");
      return;
    }

    setSearching(true);

    setMapMessage("Searching the exact place...");

    try {
      const result = await searchPlace(query);

      console.log("Search result:", result);

      await selectLocation(result.lat, result.lon, result.name);

      setMapMessage(`Found: ${result.name}`);
    } catch (error) {
      console.error("Map search error:", error);

      setMapMessage(
        "Place not found. Try a city, street, landmark or full address.",
      );
    } finally {
      setSearching(false);
    }
  };

  /* =======================================================
     USE CURRENT LOCATION
  ======================================================= */

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapMessage("Geolocation is not supported by this browser.");

      return;
    }

    setLocating(true);

    setMapMessage("Requesting your current location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;

        const longitude = position.coords.longitude;

        console.log("Current location:", latitude, longitude);

        await selectLocation(latitude, longitude);

        setMapMessage("Your current location is selected.");

        setLocating(false);
      },

      (error) => {
        console.error("Geolocation error:", error);

        setMapMessage(
          "Could not access your location. Allow location permission and try again.",
        );

        setLocating(false);
      },

      {
        enableHighAccuracy: true,

        timeout: 10000,

        maximumAge: 0,
      },
    );
  };

  /* =======================================================
     SUBMIT COMPLAINT
  ======================================================= */

  const handleSubmit = (event) => {
    event.preventDefault();

    /* Location validation */

    if (!location) {
      setToast("Please select the incident location on the map.");

      return;
    }

    /* Required field validation */

    if (!form.name || !form.phone || !form.vehicleNumber || !form.description) {
      setToast("Please fill all required fields.");

      return;
    }

    /* Generate complaint */

    const complaint = {
      id: `CMP-${Date.now().toString().slice(-7)}`,

      ...form,

      location: {
        lat: location[0],

        lon: location[1],

        address: locationAddress,
      },

      status: "Pending",

      submittedAt: new Date().toISOString(),
    };

    /* Save complaint */

    setComplaints((previous) => [complaint, ...previous]);

    /* Show success */

    setToast(`Complaint ${complaint.id} submitted successfully.`);

    /* Reset form */

    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",

      vehicleNumber: "",
      vehicleType: "Car",

      complaintType: "Vehicle Theft",

      incidentDate: "",
      incidentTime: "",

      description: "",

      firNumber: "",
    });

    /* Reset map */

    setLocation(null);

    setLocationAddress("");

    setSearch("");

    setMapMessage("Search a place or use your current location.");

    /* Go to complaint records */

    setActivePage("complaints");
  };

  /* =======================================================
     DELETE COMPLAINT
  ======================================================= */

  const removeComplaint = (id) => {
    const confirmDelete = window.confirm(
      "Delete this complaint from this browser?",
    );

    if (!confirmDelete) {
      return;
    }

    setComplaints((previous) =>
      previous.filter((complaint) => complaint.id !== id),
    );

    setToast("Complaint removed.");
  };

  /* =======================================================
     UPDATE COMPLAINT STATUS
  ======================================================= */

  const updateStatus = (id, status) => {
    setComplaints((previous) =>
      previous.map((complaint) =>
        complaint.id === id
          ? {
              ...complaint,
              status,
            }
          : complaint,
      ),
    );

    setToast("Complaint status updated.");
  };

  /* =======================================================
     OPEN COMPLAINT LOCATION
  ======================================================= */

  const openComplaintLocation = (complaint) => {
    setLocation([complaint.location.lat, complaint.location.lon]);

    setLocationAddress(complaint.location.address);

    setSearch(complaint.location.address || "");

    setActivePage("complaint");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">
      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">VG</div>

          <div>
            <h1>VehicleGuard</h1>

            <span>Complaint Portal</span>
          </div>
        </div>

        <nav>
          <button
            className={
              activePage === "dashboard" ? "nav-btn active" : "nav-btn"
            }
            onClick={() => setActivePage("dashboard")}
          >
            <span>▦</span>
            Dashboard
          </button>

          <button
            className={
              activePage === "complaint" ? "nav-btn active" : "nav-btn"
            }
            onClick={() => setActivePage("complaint")}
          >
            <span>＋</span>
            File Complaint
          </button>

          <button
            className={
              activePage === "complaints" ? "nav-btn active" : "nav-btn"
            }
            onClick={() => setActivePage("complaints")}
          >
            <span>☷</span>
            My Complaints
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="security-dot"></div>

          <div>
            <strong>Frontend Demo</strong>

            <small>Data saved locally</small>
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="main">
        {/* TOP BAR */}

        <header className="topbar">
          <div>
            <p className="eyebrow">VEHICLE SAFETY PORTAL</p>

            <h2>
              {activePage === "dashboard"
                ? "Dashboard"
                : activePage === "complaint"
                  ? "File a Complaint"
                  : "Complaint Records"}
            </h2>
          </div>

          <button
            className="primary-btn"
            onClick={() => setActivePage("complaint")}
          >
            + New Complaint
          </button>
        </header>

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activePage === "dashboard" && (
          <Dashboard
            stats={stats}
            complaints={complaints}
            onNew={() => setActivePage("complaint")}
          />
        )}

        {/* =================================================
            COMPLAINT FORM
        ================================================= */}

        {activePage === "complaint" && (
          <ComplaintForm
            form={form}
            updateField={updateField}
            location={location}
            locationAddress={locationAddress}
            setLocation={selectLocation}
            search={search}
            setSearch={setSearch}
            onSearch={handleSearch}
            searching={searching}
            onCurrentLocation={useCurrentLocation}
            locating={locating}
            mapMessage={mapMessage}
            onSubmit={handleSubmit}
          />
        )}

        {/* =================================================
            COMPLAINT LIST
        ================================================= */}

        {activePage === "complaints" && (
          <ComplaintList
            complaints={complaints}
            onDelete={removeComplaint}
            onStatus={updateStatus}
            onLocate={openComplaintLocation}
          />
        )}
      </main>

      {/* =================================================
          TOAST
      ================================================= */}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ stats, complaints, onNew }) {
  return (
    <section className="content">
      {/* HERO */}

      <div className="hero">
        <div>
          <span className="hero-badge">● LIVE FRONTEND PORTAL</span>

          <h3>
            Report a vehicle incident
            <br />
            with precise location.
          </h3>

          <p>
            Submit theft complaints, attach FIR details and pinpoint the
            incident location using an interactive map.
          </p>

          <button className="light-btn" onClick={onNew}>
            File a Complaint →
          </button>
        </div>

        <div className="hero-art">
          <div className="car">🚙</div>

          <div className="radar r1"></div>
          <div className="radar r2"></div>
          <div className="radar r3"></div>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="stats-grid">
        <Stat title="Total Complaints" value={stats.total} icon="▣" />

        <Stat title="Vehicle Theft" value={stats.theft} icon="⚠" />

        <Stat title="Pending Cases" value={stats.pending} icon="◷" />

        <Stat title="Resolved" value={stats.resolved} icon="✓" />
      </div>

      {/* RECENT ACTIVITY */}

      <div className="section-heading">
        <div>
          <p className="eyebrow">RECENT ACTIVITY</p>

          <h3>Latest complaints</h3>
        </div>

        <button className="text-btn" onClick={onNew}>
          + File new
        </button>
      </div>

      {complaints.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🚘</div>

          <h3>No complaints yet</h3>

          <p>Your submitted complaints will appear here.</p>
        </div>
      ) : (
        <div className="table-card">
          {complaints.slice(0, 5).map((complaint) => (
            <div className="complaint-row" key={complaint.id}>
              <div className="case-icon">🚗</div>

              <div className="case-main">
                <strong>
                  {complaint.id}
                  {" · "}
                  {complaint.vehicleNumber}
                </strong>

                <span>
                  {complaint.complaintType}
                  {" · "}
                  {complaint.location.address || "Location selected"}
                </span>
              </div>

              <Status status={complaint.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function Stat({ title, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <span>{title}</span>

        <strong>{value}</strong>
      </div>
    </div>
  );
}

/* =========================================================
   COMPLAINT FORM
========================================================= */

function ComplaintForm({
  form,
  updateField,

  location,
  locationAddress,

  setLocation,

  search,
  setSearch,

  onSearch,
  searching,

  onCurrentLocation,
  locating,

  mapMessage,

  onSubmit,
}) {
  return (
    <section className="content">
      {/* FORM INTRO */}

      <div className="form-intro">
        <div>
          <p className="eyebrow">CASE REGISTRATION</p>

          <h3>Vehicle complaint & FIR details</h3>

          <p>
            Enter the complainant information, vehicle details and exact
            incident location.
          </p>
        </div>

        <div className="required-note">
          <span>*</span> Required fields
        </div>
      </div>

      {/* =================================================
          IMPORTANT:
          ONLY ONE MAIN FORM
      ================================================= */}

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          {/* =============================================
              COMPLAINANT DETAILS
          ============================================= */}

          <div className="form-card">
            <div className="card-title">
              <span className="number">01</span>

              <div>
                <h4>Complainant details</h4>

                <p>Personal information of the person filing the complaint.</p>
              </div>
            </div>

            <div className="input-grid">
              <Field label="Full Name *">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </Field>

              <Field label="Phone Number *">
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="10-digit mobile number"
                  required
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="Address">
                <input
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Residential address"
                />
              </Field>
            </div>
          </div>

          {/* =============================================
              VEHICLE & FIR DETAILS
          ============================================= */}

          <div className="form-card">
            <div className="card-title">
              <span className="number">02</span>

              <div>
                <h4>Vehicle & FIR details</h4>

                <p>Information about the vehicle and incident.</p>
              </div>
            </div>

            <div className="input-grid">
              <Field label="Vehicle Number *">
                <input
                  value={form.vehicleNumber}
                  onChange={(event) =>
                    updateField(
                      "vehicleNumber",
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder="TN 00 AB 0000"
                  required
                />
              </Field>

              <Field label="Vehicle Type">
                <select
                  value={form.vehicleType}
                  onChange={(event) =>
                    updateField("vehicleType", event.target.value)
                  }
                >
                  <option>Car</option>

                  <option>Bike</option>

                  <option>Scooter</option>

                  <option>Auto</option>

                  <option>Truck</option>

                  <option>Other</option>
                </select>
              </Field>

              <Field label="Complaint Type">
                <select
                  value={form.complaintType}
                  onChange={(event) =>
                    updateField("complaintType", event.target.value)
                  }
                >
                  <option>Vehicle Theft</option>

                  <option>Vehicle Missing</option>

                  <option>Accident</option>

                  <option>Vandalism</option>

                  <option>Other</option>
                </select>
              </Field>

              <Field label="FIR Number">
                <input
                  value={form.firNumber}
                  onChange={(event) =>
                    updateField("firNumber", event.target.value)
                  }
                  placeholder="Optional FIR / CSR number"
                />
              </Field>

              <Field label="Incident Date">
                <input
                  type="date"
                  value={form.incidentDate}
                  onChange={(event) =>
                    updateField("incidentDate", event.target.value)
                  }
                />
              </Field>

              <Field label="Incident Time">
                <input
                  type="time"
                  value={form.incidentTime}
                  onChange={(event) =>
                    updateField("incidentTime", event.target.value)
                  }
                />
              </Field>
            </div>

            <Field label="Incident Description *">
              <textarea
                rows="4"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Describe what happened, last known location, vehicle condition, identifying details..."
                required
              />
            </Field>
          </div>
        </div>

        {/* =================================================
            LOCATION SECTION
        ================================================= */}

        <div className="form-card location-card">
          <div className="card-title">
            <span className="number">03</span>

            <div>
              <h4>Incident location</h4>

              <p>
                Search an exact place, use your GPS location, or click directly
                on the map.
              </p>
            </div>
          </div>

          {/* =================================================
              MAP SEARCH
              
              IMPORTANT:
              THIS IS A DIV, NOT A FORM.
              THEREFORE IT WILL NOT SUBMIT
              THE MAIN COMPLAINT FORM.
          ================================================= */}

          <div className="map-tools">
            <div className="search-box">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();

                    onSearch();
                  }
                }}
                placeholder="Search city, street, landmark or address..."
              />

              <button type="button" onClick={onSearch} disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            <button
              type="button"
              className="outline-btn"
              onClick={onCurrentLocation}
              disabled={locating}
            >
              {locating ? "Locating..." : "◎ Use My Location"}
            </button>
          </div>

          {/* SEARCH STATUS */}

          <div className="map-message">{mapMessage}</div>

          {/* =================================================
              MAP
          ================================================= */}

          <div className="map-wrap">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={5}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Click map */}

              <ClickPicker
                onPick={(coordinates) => {
                  setLocation(coordinates[0], coordinates[1]);
                }}
              />

              {/* Move map after search/GPS */}

              <MapRecenter position={location} zoom={16} />

              {/* Marker */}

              {location && (
                <>
                  <Marker position={location} icon={markerIcon}>
                    <Popup>
                      <strong>Incident Location</strong>

                      <br />

                      {locationAddress ||
                        `${location[0].toFixed(6)}, ${location[1].toFixed(6)}`}
                    </Popup>
                  </Marker>

                  <Circle
                    center={location}
                    radius={120}
                    pathOptions={{
                      color: "#2563eb",
                      fillOpacity: 0.08,
                    }}
                  />
                </>
              )}
            </MapContainer>
          </div>

          {/* =================================================
              SELECTED LOCATION
          ================================================= */}

          <div className="location-readout">
            <div className="pin">⌖</div>

            <div>
              <span>Selected location</span>

              <strong>{locationAddress || "No location selected yet"}</strong>

              {location && (
                <small>
                  Latitude: {location[0].toFixed(6)}
                  {" · "}
                  Longitude: {location[1].toFixed(6)}
                </small>
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            SUBMIT BAR
        ================================================= */}

        <div className="submit-bar">
          <div>
            <strong>Ready to submit?</strong>

            <span>Your complaint is stored locally in this frontend demo.</span>
          </div>

          <button className="primary-btn large" type="submit">
            Submit Complaint & FIR →
          </button>
        </div>
      </form>
    </section>
  );
}

/* =========================================================
   FORM FIELD COMPONENT
========================================================= */

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>

      {children}
    </label>
  );
}

/* =========================================================
   STATUS COMPONENT
========================================================= */

function Status({ status }) {
  return <span className={`status ${status.toLowerCase()}`}>{status}</span>;
}

/* =========================================================
   COMPLAINT LIST
========================================================= */

function ComplaintList({ complaints, onDelete, onStatus, onLocate }) {
  return (
    <section className="content">
      <div className="form-intro">
        <div>
          <p className="eyebrow">LOCAL CASE DATABASE</p>

          <h3>Complaint records</h3>

          <p>
            All records below are stored in this browser using localStorage.
          </p>
        </div>
      </div>

      {/* NO COMPLAINTS */}

      {complaints.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>

          <h3>No records available</h3>

          <p>File your first complaint to see it here.</p>
        </div>
      ) : (
        /* RECORDS */

        <div className="record-grid">
          {complaints.map((complaint) => (
            <article className="record-card" key={complaint.id}>
              {/* HEADER */}

              <div className="record-head">
                <div>
                  <span className="record-id">{complaint.id}</span>

                  <h4>{complaint.complaintType}</h4>
                </div>

                <Status status={complaint.status} />
              </div>

              {/* DETAILS */}

              <div className="record-details">
                <div>
                  <span>Complainant</span>

                  <strong>{complaint.name}</strong>
                </div>

                <div>
                  <span>Vehicle</span>

                  <strong>
                    {complaint.vehicleNumber}
                    {" · "}
                    {complaint.vehicleType}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>

                  <strong>{complaint.phone}</strong>
                </div>

                <div>
                  <span>FIR / CSR</span>

                  <strong>{complaint.firNumber || "Not provided"}</strong>
                </div>
              </div>

              {/* LOCATION */}

              <div className="record-location">
                <span>⌖</span>

                <div>
                  <strong>Incident location</strong>

                  <p>{complaint.location.address || "Coordinates selected"}</p>

                  <small>
                    {complaint.location.lat.toFixed(6)}
                    {", "}
                    {complaint.location.lon.toFixed(6)}
                  </small>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="record-actions">
                <button type="button" onClick={() => onLocate(complaint)}>
                  View on Map
                </button>

                <select
                  value={complaint.status}
                  onChange={(event) =>
                    onStatus(complaint.id, event.target.value)
                  }
                >
                  <option>Pending</option>

                  <option>Investigating</option>

                  <option>Resolved</option>
                </select>

                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(complaint.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   START REACT APPLICATION
========================================================= */

createRoot(document.getElementById("root")).render(<App />);
