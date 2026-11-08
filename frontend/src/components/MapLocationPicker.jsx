import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const YEMEN_CENTER = [15.5, 47.5];
const markerIcon = L.divIcon({
  className: "",
  html: '<div class="map-location-marker"><span></span></div>',
  iconSize: [30, 40],
  iconAnchor: [15, 38]
});

function validCoordinates(lat, lng) {
  if (lat == null || lng == null || String(lat).trim() === "" || String(lng).trim() === "") return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function MapInteractions({ onSelect, onUserInteract }) {
  useMapEvents({
    dragstart(event) {
      if (event.originalEvent) onUserInteract();
    },
    zoomstart(event) {
      if (event.originalEvent) onUserInteract();
    },
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    }
  });
  return null;
}

function MapCenter({ coordinates, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coordinates, zoom, { duration: 0.5 });
  }, [coordinates, map, zoom]);
  return null;
}

export default function MapLocationPicker({ initialLocation, onConfirm, onClose, title = "حدد الموقع على الخريطة" }) {
  const initialPoint = validCoordinates(initialLocation?.lat, initialLocation?.lng)
    ? [Number(initialLocation.lat), Number(initialLocation.lng)]
    : null;
  const [marker, setMarker] = useState(initialPoint);
  const [mapCenter, setMapCenter] = useState(initialPoint || YEMEN_CENTER);
  const [mapZoom, setMapZoom] = useState(initialPoint ? 14 : 6);
  const [searchLatitude, setSearchLatitude] = useState(initialPoint ? String(initialPoint[0]) : "");
  const [searchLongitude, setSearchLongitude] = useState(initialPoint ? String(initialPoint[1]) : "");
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const userAdjustedLocation = useRef(false);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationMessage("");
      setError("خدمة تحديد الموقع غير متاحة في هذا المتصفح. يمكنك تحديد النقطة يدويًا على الخريطة.");
      return;
    }

    userAdjustedLocation.current = false;
    setError("");
    setLocationMessage("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        if (userAdjustedLocation.current) return;
        const point = [coords.latitude, coords.longitude];
        setMapCenter(point);
        setMapZoom(17);
        setMarker(point);
        setSearchLatitude(point[0].toFixed(6));
        setSearchLongitude(point[1].toFixed(6));
        setLocationMessage("تم تقريب الخريطة إلى موقعك. حرّك العلامة إلى موقع الخدمة بدقة أو أكّدها.");
      },
      (geoError) => {
        setIsLocating(false);
        const reason = geoError.code === geoError.PERMISSION_DENIED
          ? "لم تسمح بالوصول إلى الموقع."
          : geoError.code === geoError.POSITION_UNAVAILABLE
            ? "تعذر الوصول إلى بيانات موقعك."
            : "انتهت مهلة تحديد موقعك.";
        setError(`${reason} يمكنك تحديد النقطة يدويًا على الخريطة أو إعادة المحاولة.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  const selectPoint = (point) => {
    userAdjustedLocation.current = true;
    setMarker(point);
    setSearchLatitude(point[0].toFixed(6));
    setSearchLongitude(point[1].toFixed(6));
    setError("");
    setLocationMessage("");
  };

  const goToCoordinates = (event) => {
    event.preventDefault();
    if (!validCoordinates(searchLatitude, searchLongitude)) {
      setError("أدخل إحداثيات صحيحة (خط العرض من -90 إلى 90 والطول من -180 إلى 180).");
      return;
    }
    const point = [Number(searchLatitude), Number(searchLongitude)];
    setMapCenter(point);
    setMapZoom(16);
    selectPoint(point);
  };

  const confirmLocation = () => {
    if (!marker) {
      setError("اضغط على الخريطة لتحديد النقطة المطلوبة أولًا.");
      return;
    }
    onConfirm({ lat: marker[0], lng: marker[1] });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="map-picker-title" className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h2 id="map-picker-title" className="font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">حرّك الخريطة واضغط على الموقع، أو اسحب العلامة الحمراء إلى النقطة الدقيقة.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق الخريطة" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 hover:bg-slate-200">×</button>
        </header>

        <form onSubmit={goToCoordinates} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 border-b border-slate-100 p-3 sm:px-5">
          <label className="text-[11px] font-bold text-slate-600">خط العرض
            <input inputMode="decimal" value={searchLatitude} onChange={(event) => setSearchLatitude(event.target.value)} placeholder="15.3694" className="mt-1 min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" dir="ltr" />
          </label>
          <label className="text-[11px] font-bold text-slate-600">خط الطول
            <input inputMode="decimal" value={searchLongitude} onChange={(event) => setSearchLongitude(event.target.value)} placeholder="44.1910" className="mt-1 min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" dir="ltr" />
          </label>
          <button type="submit" className="rounded-lg bg-slate-800 px-3 py-2.5 text-xs font-black text-white hover:bg-slate-700">انتقال</button>
        </form>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 sm:px-5">
          <p className="text-xs font-bold text-slate-600">
            {isLocating ? "جارٍ تقريب الخريطة إلى موقعك..." : "يمكنك تعديل النقطة على الخريطة قبل التأكيد."}
          </p>
          <button type="button" onClick={locateUser} disabled={isLocating} className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-60">
            {isLocating ? "جارٍ التحديد..." : "الانتقال إلى موقعي"}
          </button>
        </div>

        <div className="relative h-[42dvh] min-h-64 shrink-0 sm:h-[52vh]">
          <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={false} className="h-full w-full" zoomControl>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenter coordinates={mapCenter} zoom={mapZoom} />
            <MapInteractions
              onSelect={selectPoint}
              onUserInteract={() => { userAdjustedLocation.current = true; }}
            />
            {marker && <Marker
              position={marker}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const position = event.target.getLatLng();
                  selectPoint([position.lat, position.lng]);
                }
              }}
            />}
          </MapContainer>
          {isLocating && <div className="pointer-events-none absolute inset-x-4 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-black text-sky-800 shadow">جارٍ تحديد موقعك وتقريب الخريطة...</div>}
          {!marker && <div className="pointer-events-none absolute inset-x-4 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-black text-slate-700 shadow sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">اضغط على الخريطة لوضع العلامة</div>}
        </div>

        <footer className="space-y-2 border-t border-slate-100 p-3 sm:px-5">
          {marker && <p className="text-center text-xs font-bold text-slate-600" dir="ltr">{marker[0].toFixed(6)}, {marker[1].toFixed(6)}</p>}
          {locationMessage && <p role="status" className="text-center text-xs font-bold text-emerald-700">{locationMessage}</p>}
          {error && <p role="alert" className="text-center text-xs font-bold text-red-700">{error}</p>}
          <button type="button" onClick={confirmLocation} disabled={!marker} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">تأكيد الموقع</button>
          <p className="text-center text-[10px] text-slate-400">الخريطة © OpenStreetMap contributors</p>
        </footer>
      </section>
    </div>
  );
}
