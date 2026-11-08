import React from "react";
import { uploadsUrl } from "../lib/uploads.js";
import { getCategoryIconKey } from "./categoryIconMap.js";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const accent = { fill: "#0b89ed", stroke: "none" };
const pale = { fill: "#dceeff", stroke: "none" };
const gold = { fill: "#efb84a", stroke: "none" };

function Artwork({ kind }) {
  switch (kind) {
    case "marketCars":
      return <><path {...pale} d="M8 24h32l-3.2-8.1a5 5 0 0 0-4.7-3.3H17.9a5 5 0 0 0-4.7 3.3z" /><path {...stroke} d="M7 24h34v9a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3zM11 24l3.5-8.2a4 4 0 0 1 3.7-2.5h11.6a4 4 0 0 1 3.7 2.5L37 24M17 20h14" /><path {...accent} d="M8 27h5v4H8zm27 0h5v4h-5z" /><circle {...stroke} cx="14" cy="36" r="3.5" /><circle {...stroke} cx="34" cy="36" r="3.5" /><path {...gold} d="M19 15h10v2H19z" /></>;
    case "marketProperty":
      return <><path {...pale} d="m5 22 19-15 19 15v19H5z" /><path {...stroke} d="m5 22 19-15 19 15M10 20v21h28V20M20 41V28h9v13" /><path {...accent} d="M31 10h5v8l-5-4z" /><path {...gold} d="M14 25h4v4h-4zm16 0h4v4h-4z" /></>;
    case "marketElectronics":
      return <><rect {...pale} x="10" y="5" width="28" height="38" rx="6" /><rect {...stroke} x="10" y="5" width="28" height="38" rx="6" /><path {...accent} d="M15 12h18v22H15z" /><path {...gold} d="M20 17h8v2h-8zm0 5h8v2h-8z" /><path {...stroke} d="M21 38h6" /></>;
    case "marketFurniture":
      return <><path {...pale} d="M10 19h28v14H10z" /><path {...stroke} d="M10 21h28v14H10zM10 25H8a4 4 0 0 0-4 4v8h40v-8a4 4 0 0 0-4-4h-2M9 37v4m30-4v4M24 21v13" /><path {...accent} d="M13 23h8v8h-8zm14 0h8v8h-8z" /><path {...gold} d="M18 24h3v6h-3zm9 0h3v6h-3z" /></>;
    case "marketJobs":
      return <><path {...pale} d="M6 15h36v25H6z" /><path {...stroke} d="M6 17a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM17 14V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M6 24h36m-22-2v5h8v-5" /><path {...accent} d="M20 27h8v4h-8z" /><path {...gold} d="M20 9h8v2h-8z" /></>;
    case "marketAnimals":
      return <><path {...pale} d="M13 32c-3 0-5-2-5-5-3-3-1-7 2-8 0-4 4-6 7-4 2-5 8-5 10-1 4-2 8 1 7 5 4 2 4 7 1 9l-3 7H14z" /><path {...stroke} d="M13 32c-3 0-5-2-5-5-3-3-1-7 2-8 0-4 4-6 7-4 2-5 8-5 10-1 4-2 8 1 7 5 4 2 4 7 1 9l-3 7H14zM16 34v7m14-7v7m-14 0h-3m17 0h3M35 21c2-3 6-3 8-1l2 4-3 5-7 1-4-4zM35 21l-4-3m13 2 2-3m-8 7h.1m2 4 2-1" /><path {...stroke} d="M13 20c1-2 3-2 4 0m4-4c1-2 4-2 5 0m4 1c2-1 4 0 4 2m-22 4c1-2 3-2 4 0m5 1c1-2 4-2 5 0" /><path {...accent} d="M35 22c2-2 4-2 6 0l-2 4h-5z" /><path {...gold} d="M24 31h5l-1 5h-4z" /><circle {...stroke} cx="40" cy="23" r=".7" /></>;
    case "marketFashion":
      return <><path {...pale} d="m15 9 9 5 9-5 10 7-6 8-5-3v20H16V21l-5 3-6-8z" /><path {...stroke} d="m15 9 9 5 9-5 10 7-6 8-5-3v20H16V21l-5 3-6-8zM19 11a5 5 0 0 0 10 0" /><path {...accent} d="M21 23h6v10h-6z" /><path {...gold} d="M22 18h4v3h-4z" /></>;
    case "marketGames":
      return <><path {...pale} d="M13 15h22a9 9 0 0 1 8 13l-4 8a4 4 0 0 1-6 1l-6-5h-8l-6 5a4 4 0 0 1-6-1l-4-8a9 9 0 0 1 8-13z" /><path {...stroke} d="M13 15h22a9 9 0 0 1 8 13l-4 8a4 4 0 0 1-6 1l-6-5h-8l-6 5a4 4 0 0 1-6-1l-4-8a9 9 0 0 1 8-13zM14 22v10m-5-5h10" /><circle {...gold} cx="33" cy="23" r="2.5" /><circle {...accent} cx="37" cy="29" r="2.5" /></>;
    case "marketServices":
      return <><path {...pale} d="M30 7a13 13 0 0 0-15 17L7 32a5 5 0 0 0 7 7l8-8A13 13 0 0 0 38 16l-8 8-8-8z" /><path {...stroke} d="M30 7a13 13 0 0 0-15 17L7 32a5 5 0 0 0 7 7l8-8A13 13 0 0 0 38 16l-8 8-8-8z" /><circle {...gold} cx="11" cy="35" r="2" /><path {...accent} d="m28 11 5 5-5 5-5-5z" /></>;
    case "marketTools":
      return <><path {...pale} d="M8 18h32v23H8z" /><path {...stroke} d="M8 18h32v23H8zM15 18v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5M8 26h32m-20-2v5h8v-5" /><path {...accent} d="M12 31h9v6h-9zm15 0h9v6h-9z" /><path {...gold} d="M21 11h6v2h-6z" /></>;
    case "marketSpecialVehicles":
      return <><path {...pale} d="M13 29h25a5 5 0 0 1 5 5v3H11v-3a5 5 0 0 1 2-5z" /><path {...stroke} d="M13 29h25a5 5 0 0 1 5 5v3H11v-3a5 5 0 0 1 2-5z" /><circle {...accent} cx="17" cy="34" r="2.5" /><circle {...accent} cx="25" cy="34" r="2.5" /><circle {...accent} cx="34" cy="34" r="2.5" /><path {...pale} d="M17 15h15l5 14H15z" /><path {...stroke} d="M17 15h15l5 14H15zM20 18h9v8h-9zM32 22h5M18 29l-3-5H9v8h4m23-3v4" /><path {...accent} d="M22 20h5v5h-5z" /><path {...gold} d="M7 23h7v3H7zm0 3-3 7h4l4-7z" /><path {...stroke} d="m8 26-3 6m5-6-3 6" /></>;
    case "marketTravel":
      return <><path {...pale} d="M8 14h32v27H8z" /><path {...stroke} d="M8 17a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3zM17 14V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M8 24h32M19 21v6h10v-6" /><path {...accent} d="M21 27h6v8h-6z" /><path {...gold} d="m24 29 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.3 1.2.4-2.6-1.9-1.8 2.7-.4z" /></>;
    case "marketStationery":
      return <><path {...pale} d="M11 6h28v36H11z" /><path {...stroke} d="M11 6h28v36H11zM7 12h8m-8 8h8m-8 8h8m-8 8h8M21 15h12m-12 7h12m-12 7h9" /><path {...accent} d="M5 11h4v3H5zm0 8h4v3H5zm0 8h4v3H5zm0 8h4v3H5z" /><path {...gold} d="M21 34h11v2H21z" /></>;
    case "marketSports":
      return <><circle {...pale} cx="24" cy="24" r="18" /><circle {...stroke} cx="24" cy="24" r="18" /><path {...stroke} d="m24 6 5 12-5 12-5 12M6 18h13l10 6-5 12H12M42 18H29" /><path {...accent} d="M21 21h6v6h-6z" /><path {...gold} d="m24 6 2 5h-4z" /></>;
    case "marketBeauty":
      return <><path {...pale} d="M17 16h14l5 7v18H12V23z" /><path {...stroke} d="M17 16h14l5 7v18H12V23zM20 16V9h8v7m-6-7V5h4v4M12 29h24" /><path {...accent} d="M19 31h10v7H19z" /><path {...gold} d="M19 16h10v2H19z" /></>;
    case "marketBooks":
      return <><path {...pale} d="M6 9h15a5 5 0 0 1 5 5v27a5 5 0 0 0-5-5H6zM42 9H27v32a5 5 0 0 1 5-5h10z" /><path {...stroke} d="M6 9h15a5 5 0 0 1 5 5v27a5 5 0 0 0-5-5H6zM42 9H27v32a5 5 0 0 1 5-5h10zM11 17h8m-8 7h8m13-7h5m-5 7h5" /><path {...accent} d="M23 12h4v25h-4z" /><path {...gold} d="M23 12h4v6l-2-1.5-2 1.5z" /></>;
    case "marketMusic":
      return <><path {...pale} d="m30 10 10-6 4 4-7 11a10 10 0 0 1-2 15 10 10 0 0 1-14 2 10 10 0 0 1 2-17z" /><path {...stroke} d="m30 10 10-6 4 4-7 11a10 10 0 0 1-2 15 10 10 0 0 1-14 2 10 10 0 0 1 2-17zM25 23l10 10M29 19l5-5" /><circle {...accent} cx="27" cy="29" r="3.5" /><circle {...gold} cx="27" cy="29" r="1" /></>;
    case "marketFood":
      return <><path {...pale} d="M8 20h32l-4 21H12z" /><path {...stroke} d="M8 20h32l-4 21H12zM14 20l10-12 10 12M16 26v10m8-10v10m8-10v10" /><circle {...accent} cx="19" cy="17" r="5" /><circle {...gold} cx="29" cy="15" r="5" /><path {...stroke} d="M19 12v-3m10 1 2-3" /></>;
    case "marketAppliances":
      return <><rect {...pale} x="10" y="5" width="28" height="38" rx="4" /><rect {...stroke} x="10" y="5" width="28" height="38" rx="4" /><path {...stroke} d="M12 22h24m-19-12v8m0 7v14" /><path {...accent} d="M15 10h18v9H15zM18 28h12v10H18z" /><path {...gold} d="M21 12h6v2h-6z" /></>;
    case "marketEnergy":
      return <><circle {...gold} cx="24" cy="10" r="5" /><path {...stroke} d="M24 2v3m0 10v2M8 10h5m18 0h5m-28-5 3 3m26-3-3 3" /><path {...pale} d="M8 20h32l4 17H4z" /><path {...stroke} d="M8 20h32l4 17H4zM10 26h31M6 32h37M19 21l-2 15m13-15 2 15M24 37v5m-9 0h18" /><path {...accent} d="M13 22h8v3h-8zm14 0h8v3h-8z" /></>;
    case "marketOrders":
      return <><path {...pale} d="M7 18h34l-4 24H11z" /><path {...stroke} d="M7 18h34l-4 24H11zM14 18l10-12 10 12M17 25v10m7-10v10m7-10v10" /><path {...accent} d="m19 30 4 4 8-9 3 3-11 12-7-7z" /><path {...gold} d="M21 15h6v3h-6z" /></>;
    case "marketOther":
      return <><path {...pale} d="M8 19h32v22H8z" /><path {...stroke} d="M8 19h32v22H8zM5 19l4-12h30l4 12M5 19a5 5 0 0 0 10 0 5 5 0 0 0 10 0 5 5 0 0 0 10 0 5 5 0 0 0 8 0M14 29h8v12h-8" /><path {...accent} d="M27 27h8v6h-8z" /><path {...gold} d="M27 28h8v2h-8z" /></>;
    case "car":
      return <><path {...pale} d="M8 24h32l-3-9a4 4 0 0 0-4-3H17a4 4 0 0 0-4 3z" /><path {...stroke} d="M5 24h38v11H5zM9 35v3m30-3v3M11 24l4-9a4 4 0 0 1 4-3h13a4 4 0 0 1 4 3l4 9M17 19h14" /><circle {...accent} cx="13" cy="31" r="3" /><circle {...accent} cx="35" cy="31" r="3" /></>;
    case "key":
      return <><circle {...stroke} cx="16" cy="20" r="8" /><path {...stroke} d="m22 25 16 16 5-5-5-5 4-4-5-5-4 4-5-5" /><circle {...accent} cx="16" cy="20" r="3" /></>;
    case "transfer":
      return <><path {...stroke} d="M6 17h30l-4-5m4 5-4 5M42 31H12l4-5m-4 5 4 5" /><path {...accent} d="M19 18h8v4h-8zM19 29h8v4h-8z" /></>;
    case "gear":
      return <><path {...stroke} d="m20 5 8 0 1.5 5 4 2 4-2 4 7-4 3v5l4 3-4 7-5-2-4 2-1.5 5h-8l-1.5-5-4-2-4 2-4-7 4-3v-5l-4-3 4-7 5 2 4-2z" /><circle {...accent} cx="24" cy="24" r="6" /></>;
    case "plate":
      return <><rect {...stroke} x="5" y="13" width="38" height="22" rx="4" /><path {...accent} d="M12 18h4v12h-4zm8 0h4v12h-4zm8 0h4v12h-4z" /><path {...stroke} d="M36 20h2m-2 8h2" /></>;
    case "motorcycle":
      return <><circle {...stroke} cx="12" cy="34" r="7" /><circle {...stroke} cx="37" cy="34" r="7" /><path {...stroke} d="m12 34 8-12h8l9 12M20 22l7 12H12m5-15h6m9 0 4 7h4" /><path {...accent} d="M23 20h8l4 5H22z" /></>;
    case "truck":
      return <><path {...pale} d="M5 12h24v23H5z" /><path {...stroke} d="M5 12h24v23H5zM29 20h8l7 8v7H29zM32 23v7h9M12 35v3m20-3v3" /><circle {...accent} cx="13" cy="35" r="4" /><circle {...accent} cx="35" cy="35" r="4" /></>;
    case "house":
      return <><path {...pale} d="m5 22 19-16 19 16v20H5z" /><path {...stroke} d="m5 22 19-16 19 16M10 20v22h28V20M20 42V28h9v14" /><path {...accent} d="M31 8h6v9l-6-5z" /></>;
    case "building":
    case "buildingKey":
    case "office":
      return <><path {...pale} d="M9 6h20v36H9zM29 17h11v25H29z" /><path {...stroke} d="M9 6h20v36H9zM29 17h11v25H29zM15 13h3m6 0h-3m-6 7h3m6 0h-3m-6 7h3m6 0h-3m12-4h3m-3 7h3M16 42V34h6v8" />
        {kind === "buildingKey" ? <circle {...accent} cx="34" cy="10" r="4" /> : <path {...accent} d="M16 10h3v3h-3zm6 0h3v3h-3z" />}</>;
    case "plot":
      return <><path {...pale} d="m8 11 29-4 4 29-30 5z" /><path {...stroke} d="m8 11 29-4 4 29-30 5zM16 14l4 27m9-30 4 28M10 23l29-4m-28 14 29-4" /><path {...accent} d="m19 29 6-8 6 8z" /></>;
    case "villa":
      return <><path {...pale} d="M7 22 24 8l17 14v19H7z" /><path {...stroke} d="M5 23 24 7l19 16M10 21v20h28V21M18 41V29h12v12M14 26h5v5h-5zm15 0h5v5h-5z" /><path {...accent} d="M21 8h6v6l-3-2-3 2z" /></>;
    case "shop":
      return <><path {...pale} d="M8 19h32v23H8z" /><path {...stroke} d="M8 19h32v23H8zM5 19l4-12h30l4 12M5 19a5 5 0 0 0 10 0 5 5 0 0 0 10 0 5 5 0 0 0 10 0 5 5 0 0 0 8 0M14 29h8v13h-8" /><path {...accent} d="M27 27h8v6h-8z" /></>;
    case "chair":
      return <><path {...pale} d="M13 8h22v17H13zM9 25h30v7H9z" /><path {...stroke} d="M13 8h22v17H13zM9 25h30v7H9zM13 32l-3 10m25-10 3 10M18 32v6m12-6v6" /><path {...accent} d="M17 12h14v3H17z" /></>;
    case "phone":
      return <><rect {...stroke} x="13" y="4" width="22" height="40" rx="5" /><rect {...pale} x="17" y="10" width="14" height="25" rx="2" /><path {...accent} d="M21 14h6v11h-6z" /><circle {...stroke} cx="24" cy="39" r="1.5" /></>;
    case "monitor":
    case "screen":
      return <><rect {...stroke} x="5" y="8" width="38" height="26" rx="3" /><path {...pale} d="M9 12h30v18H9z" /><path {...stroke} d="M24 34v7m-9 0h18" /><path {...accent} d="M13 17h12v3H13zm0 7h20v2H13z" /></>;
    case "laptop":
      return <><path {...stroke} d="M10 8h28v23H10zM5 36h38l-3 5H8z" /><path {...pale} d="M14 12h20v15H14z" /><path {...accent} d="M18 17h12v3H18z" /></>;
    case "camera":
      return <><path {...pale} d="M6 15h36v24H6z" /><path {...stroke} d="M6 15h36v24H6zM15 15l3-6h12l3 6" /><circle {...stroke} cx="24" cy="27" r="8" /><circle {...accent} cx="24" cy="27" r="4" /><circle {...accent} cx="36" cy="20" r="1.5" /></>;
    case "chip":
      return <><rect {...stroke} x="11" y="11" width="26" height="26" rx="4" /><rect {...pale} x="17" y="17" width="14" height="14" rx="2" /><path {...stroke} d="M17 5v6m7-6v6m7-6v6m-14 26v6m7-6v6m7-6v6M5 17h6m-6 7h6m-6 7h6m26-14h6m-6 7h6m-6 7h6" /><path {...accent} d="M21 21h6v6h-6z" /></>;
    case "gamepad":
      return <><path {...pale} d="M14 14h20a9 9 0 0 1 8 13l-4 9a4 4 0 0 1-6 1l-6-5h-8l-6 5a4 4 0 0 1-6-1l-4-9a9 9 0 0 1 8-13z" /><path {...stroke} d="M14 14h20a9 9 0 0 1 8 13l-4 9a4 4 0 0 1-6 1l-6-5h-8l-6 5a4 4 0 0 1-6-1l-4-9a9 9 0 0 1 8-13zM14 22v10m-5-5h10" /><circle {...accent} cx="33" cy="23" r="2" /><circle {...accent} cx="37" cy="29" r="2" /></>;
    case "mouse":
      return <><path {...pale} d="M24 5a13 13 0 0 0-13 13v12a13 13 0 0 0 26 0V18A13 13 0 0 0 24 5z" /><path {...stroke} d="M24 5a13 13 0 0 0-13 13v12a13 13 0 0 0 26 0V18A13 13 0 0 0 24 5zM24 5v12m-13 0h26" /><path {...accent} d="M22 8h4v7h-4z" /></>;
    case "wifi":
      return <><path {...stroke} d="M5 17a29 29 0 0 1 38 0M11 24a20 20 0 0 1 26 0m-20 7a10 10 0 0 1 14 0" /><circle {...accent} cx="24" cy="38" r="3" /></>;
    case "headphones":
      return <><path {...stroke} d="M7 25v-4a17 17 0 0 1 34 0v4M7 25h7v13H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3zm34 0h-7v13h7a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3z" /><path {...accent} d="M8 28h3v7H8zm29 0h3v7h-3z" /></>;
    case "printer":
      return <><path {...pale} d="M12 6h24v12H12zM10 26h28v16H10z" /><path {...stroke} d="M12 18V6h24v12M10 26h28v16H10zM6 18h36a4 4 0 0 1 4 4v8h-8M10 30H2v-8a4 4 0 0 1 4-4m10 18h16" /><path {...accent} d="M17 34h14v3H17z" /></>;
    case "watch":
      return <><path {...pale} d="M16 14h16v20H16z" /><path {...stroke} d="m18 14 2-9h8l2 9m-12 20 2 9h8l2-9M16 14h16v20H16z" /><circle {...stroke} cx="24" cy="24" r="6" /><path {...accent} d="m24 20 2 4-3 2z" /></>;
    case "tablet":
      return <><rect {...stroke} x="8" y="5" width="32" height="38" rx="4" /><rect {...pale} x="12" y="10" width="24" height="27" rx="2" /><path {...accent} d="M18 15h12v3H18zm0 7h16v2H18z" /><circle {...stroke} cx="24" cy="40" r="1" /></>;
    case "sofa":
      return <><path {...pale} d="M10 19h28v15H10z" /><path {...stroke} d="M10 19h28v15H10zM10 24H7a3 3 0 0 0-3 3v9h40v-9a3 3 0 0 0-3-3h-3M9 36v5m30-5v5M24 20v13" /><path {...accent} d="M13 22h8v8h-8zm14 0h8v8h-8z" /></>;
    case "bed":
      return <><path {...pale} d="M6 22h36v14H6z" /><path {...stroke} d="M6 16v25m36-25v25M6 32h36M10 22v-6h11v6m3 0v-6h10v6" /><path {...accent} d="M10 25h11v5H10zm15 0h13v5H25z" /></>;
    case "kitchen":
      return <><path {...stroke} d="M9 21h30l-3 20H12zM6 21h36M14 16a10 10 0 0 1 20 0v5M20 16v-4m8 4v-4" /><path {...pale} d="M14 29h20v7H14z" /><path {...accent} d="M20 31h8v3h-8z" /></>;
    case "desk":
      return <><path {...pale} d="M6 15h36v9H6z" /><path {...stroke} d="M6 15h36v9H6zM10 24v18m28-18v18M17 15V8h14v7m-9 9v7h8v-7" /><path {...accent} d="M20 10h8v3h-8z" /></>;
    case "briefcase":
      return <><path {...pale} d="M5 16h38v24H5z" /><path {...stroke} d="M5 16h38v24H5zM17 16v-6h14v6M5 25h38m-23-2v5h8v-5" /><path {...accent} d="M20 27h8v4h-8z" /></>;
    case "government":
      return <><path {...pale} d="m5 18 19-12 19 12zM8 21h32v4H8z" /><path {...stroke} d="m5 18 19-12 19 12zM8 21h32v4H8zM10 26v13m9-13v13m10-13v13m9-13v13M6 42h36" /><path {...accent} d="M21 8h6v6h-6z" /></>;
    case "clock":
      return <><circle {...pale} cx="24" cy="24" r="18" /><circle {...stroke} cx="24" cy="24" r="18" /><path {...stroke} d="M24 12v13l9 5" /><path {...accent} d="M22 22h4v4h-4z" /></>;
    case "animal":
    case "sheep":
    case "camel":
    case "cow":
      return <><path {...pale} d="M10 22a7 7 0 0 1 7-7 7 7 0 0 1 7-5 7 7 0 0 1 7 5 7 7 0 0 1 7 7v9a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" /><path {...stroke} d="M10 25a7 7 0 0 1 7-7 7 7 0 0 1 7-5 7 7 0 0 1 7 5 7 7 0 0 1 7 7v7a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8zM17 39v4m15-4v4m-12-14h.1m8-.1h.1m-6 7h4" /><path {...accent} d="M20 29h2v2h-2zm8 0h2v2h-2z" /></>;
    case "bird":
      return <><path {...pale} d="M8 28c8-13 18-17 30-13-2 6-6 10-12 12l9 9c-12 1-21-2-27-8z" /><path {...stroke} d="M8 28c8-13 18-17 30-13-2 6-6 10-12 12l9 9c-12 1-21-2-27-8zm0 0-4 8h13m8-9 5 2" /><circle {...accent} cx="31" cy="19" r="2" /></>;
    case "paw":
      return <><path {...pale} d="M13 28c-5 3-7 8-4 12 3 4 8 1 15-2 7 3 12 6 15 2 3-4 1-9-4-12-7-5-15-5-22 0z" /><ellipse {...accent} cx="10" cy="18" rx="4" ry="6" /><ellipse {...accent} cx="20" cy="13" rx="4" ry="6" /><ellipse {...accent} cx="30" cy="13" rx="4" ry="6" /><ellipse {...accent} cx="39" cy="18" rx="4" ry="6" /></>;
    case "shirt":
      return <><path {...pale} d="m15 9 9 5 9-5 10 7-6 8-5-3v20H16V21l-5 3-6-8z" /><path {...stroke} d="m15 9 9 5 9-5 10 7-6 8-5-3v20H16V21l-5 3-6-8zM19 11a5 5 0 0 0 10 0" /><path {...accent} d="M21 19h6v3h-6z" /></>;
    case "dress":
      return <><path {...pale} d="m18 8 6 4 6-4 4 7-5 5 7 20H12l7-20-5-5z" /><path {...stroke} d="m18 8 6 4 6-4 4 7-5 5 7 20H12l7-20-5-5zM19 20h10" /><path {...accent} d="M19 28h10l3 9H16z" /></>;
    case "toy":
      return <><circle {...pale} cx="24" cy="25" r="15" /><circle {...stroke} cx="24" cy="25" r="15" /><path {...stroke} d="M24 10v30M9 25h30M14 14l20 22m0-22L14 36" /><circle {...accent} cx="24" cy="25" r="5" /></>;
    case "shoe":
      return <><path {...pale} d="M7 27c7 0 11-4 13-12l8 3 4 9 10 3a5 5 0 0 1-2 10H8a5 5 0 0 1-1-13z" /><path {...stroke} d="M7 27c7 0 11-4 13-12l8 3 4 9 10 3a5 5 0 0 1-2 10H8a5 5 0 0 1-1-13zm13-12 5 8m-10 2 8 2m-2-9 4 2" /><path {...accent} d="M8 34h32v4H8z" /></>;
    case "jewel":
      return <><path {...pale} d="m7 17 8-9h18l8 9-17 24z" /><path {...stroke} d="m7 17 8-9h18l8 9-17 24zm0 0h34M15 8l8 9 9-9m-17 9 8 24m9-24-9 24" /><path {...accent} d="m24 18 7 5-7 10-7-10z" /></>;
    case "controller":
      return <><path {...stroke} d="M11 12h26a6 6 0 0 1 6 6v18a4 4 0 0 1-7 2l-5-7H17l-5 7a4 4 0 0 1-7-2V18a6 6 0 0 1 6-6zM14 19v10m-5-5h10" /><path {...pale} d="M23 17h7v5h-7z" /><circle {...accent} cx="34" cy="23" r="2" /><circle {...accent} cx="37" cy="29" r="2" /></>;
    case "palette":
      return <><path {...pale} d="M24 5a19 19 0 1 0 0 38h3a5 5 0 0 0 3-9 3 3 0 0 1 2-5h4a7 7 0 0 0 7-7C43 12 34 5 24 5z" /><path {...stroke} d="M24 5a19 19 0 1 0 0 38h3a5 5 0 0 0 3-9 3 3 0 0 1 2-5h4a7 7 0 0 0 7-7C43 12 34 5 24 5z" /><circle {...accent} cx="14" cy="22" r="2.5" /><circle {...accent} cx="20" cy="13" r="2.5" /><circle {...accent} cx="30" cy="13" r="2.5" /></>;
    case "wrench":
      return <><path {...pale} d="M29 7a13 13 0 0 0-15 17L6 32a5 5 0 0 0 7 7l8-8A13 13 0 0 0 38 16l-8 8-8-8z" /><path {...stroke} d="M29 7a13 13 0 0 0-15 17L6 32a5 5 0 0 0 7 7l8-8A13 13 0 0 0 38 16l-8 8-8-8z" /><circle {...accent} cx="10" cy="35" r="2" /></>;
    case "bolt":
      return <><path {...pale} d="m27 4-19 23h13l-2 17 21-25H27z" /><path {...stroke} d="m27 4-19 23h13l-2 17 21-25H27z" /><path {...accent} d="m27 4-6 17h8l-8 17 19-23H27z" /></>;
    case "factory":
      return <><path {...pale} d="M5 20 18 11v9l13-9v9l12-7v24H5z" /><path {...stroke} d="M5 20 18 11v9l13-9v9l12-7v24H5zM12 28h5v5h-5zm11 0h5v5h-5zm11 0h5v5h-5zM10 11V5h6v10" /><path {...accent} d="M12 29h5v4h-5z" /></>;
    case "plant":
      return <><path {...stroke} d="M24 42V22m0 10c-11 0-16-6-16-15 9 0 15 4 16 15zm0-7c0-10 6-16 16-16 0 9-5 15-16 16z" /><path {...pale} d="M11 41h26l-3 5H14z" /><path {...accent} d="M24 22c-7-4-7-11 0-16 7 5 7 12 0 16z" /></>;
    case "boat":
      return <><path {...pale} d="M6 29h36l-7 12H14z" /><path {...stroke} d="M6 29h36l-7 12H14zM24 6v23M24 8l13 18H24M6 29l-3-5m42 5 3-5M17 44l5-3 5 3 5-3 5 3" /><path {...accent} d="M20 10h3v15h-3z" /></>;
    case "tractor":
      return <><circle {...stroke} cx="14" cy="34" r="8" /><circle {...stroke} cx="36" cy="35" r="5" /><path {...pale} d="M11 18h17v12H11zM28 24h8v7h-8z" /><path {...stroke} d="M11 18h17v12H11zM28 24h8v7h-8zM15 18v-6h12l5 12m-18 6h13m-14 4h-5m32 1h4" /><path {...accent} d="M16 21h8v5h-8z" /></>;
    case "suitcase":
      return <><path {...pale} d="M8 14h32v27H8z" /><path {...stroke} d="M8 14h32v27H8zM17 14V8h14v6M8 23h32m-22-3v7h12v-7M14 41v3m20-3v3" /><path {...accent} d="M21 22h6v4h-6z" /></>;
    case "hotel":
      return <><path {...pale} d="M8 7h32v35H8z" /><path {...stroke} d="M8 7h32v35H8zM15 14h6v6h-6zm12 0h6v6h-6zm-12 12h6v6h-6zm12 0h6v6h-6zM21 42V34h7v8" /><path {...accent} d="M20 5h8v4h-8z" /></>;
    case "ticket":
      return <><path {...pale} d="M6 13h36v22a5 5 0 0 0 0 10H6a5 5 0 0 0 0-10z" /><path {...stroke} d="M6 13h36v10a5 5 0 0 0 0 10v12H6a5 5 0 0 0 0-10zM27 17v4m0 5v4m0 5v4" /><path {...accent} d="M13 19h8v3h-8zm0 13h8v3h-8z" /></>;
    case "festival":
      return <><path {...stroke} d="M6 41h36M10 38V23l14-12 14 12v15M17 38V27h14v11" /><path {...pale} d="M6 23 24 8l18 15z" /><path {...accent} d="M22 7h4v7h-4zM8 8l4 4m28-4-4 4M4 15l5 2m35-2-5 2" /></>;
    case "pen":
      return <><path {...pale} d="m11 34 22-25 7 6-22 25-9 3z" /><path {...stroke} d="m11 34 22-25 7 6-22 25-9 3zM29 13l7 6m-25 15 7 6" /><path {...accent} d="m33 9 3-3 7 7-3 3z" /></>;
    case "notebook":
      return <><path {...pale} d="M11 6h30v36H11z" /><path {...stroke} d="M11 6h30v36H11zM7 12h8m-8 8h8m-8 8h8m-8 8h8M20 15h15m-15 7h15m-15 7h12" /><path {...accent} d="M5 11h4v3H5zm0 8h4v3H5zm0 8h4v3H5zm0 8h4v3H5z" /></>;
    case "clip":
      return <><path {...pale} d="M11 11h27v32H11z" /><path {...stroke} d="M11 11h27v32H11zM18 11V7h13v4M17 20h15m-15 7h15m-15 7h10" /><path {...accent} d="M17 18h4v4h-4zm0 7h4v4h-4zm0 7h4v4h-4z" /></>;
    case "backpack":
    case "bag":
      return <><path {...pale} d="M12 18a12 12 0 0 1 24 0v23H12z" /><path {...stroke} d="M12 18a12 12 0 0 1 24 0v23H12zM18 18v-2a6 6 0 0 1 12 0v2M12 29h24M17 29v8h14v-8M9 21H6v14h6m24-14h3v14h-6" /><path {...accent} d="M20 32h8v3h-8z" /></>;
    case "sports":
    case "barbell":
      return <><path {...pale} d="M6 18h7v12H6zm29 0h7v12h-7z" /><path {...stroke} d="M6 18h7v12H6zm29 0h7v12h-7zM13 22h22v4H13M4 15v18m40-18v18" /><path {...accent} d="M18 21h12v6H18z" /></>;
    case "ball":
      return <><circle {...pale} cx="24" cy="24" r="18" /><circle {...stroke} cx="24" cy="24" r="18" /><path {...stroke} d="m24 6 5 12-5 12-5 12M6 18l13 0 10 6-5 12-12 0M42 18H29m-10 0 5-12M29 24l13-6" /><path {...accent} d="M21 21h6v6h-6z" /></>;
    case "jersey":
      return <><path {...pale} d="m16 8 8 5 8-5 12 9-6 8-6-4v20H16V21l-6 4-6-8z" /><path {...stroke} d="m16 8 8 5 8-5 12 9-6 8-6-4v20H16V21l-6 4-6-8zM20 10a4 4 0 0 0 8 0" /><path {...accent} d="M21 21h6v7h-6z" /></>;
    case "bottle":
      return <><path {...pale} d="M18 15h12l4 6v21H14V21z" /><path {...stroke} d="M18 15h12l4 6v21H14V21zM20 15V9h8v6m-6-6V5h4v4M14 28h20" /><path {...accent} d="M20 30h8v7h-8z" /></>;
    case "makeup":
      return <><path {...pale} d="m12 30 13-23 8 4-13 23zM11 31l9 5-6 8-8-4z" /><path {...stroke} d="m12 30 13-23 8 4-13 23zM11 31l9 5-6 8-8-4zM28 10l8 4m-24 19 8 4" /><path {...accent} d="m24 9 4-7 8 5-4 7z" /></>;
    case "comb":
      return <><path {...pale} d="M7 15h34v13H7z" /><path {...stroke} d="M7 15h34v13H7zM11 28v10m6-10v10m6-10v10m6-10v10m6-10v10m6-10v10" /><path {...accent} d="M12 18h23v4H12z" /></>;
    case "scissors":
      return <><circle {...stroke} cx="12" cy="34" r="6" /><circle {...stroke} cx="12" cy="14" r="6" /><path {...stroke} d="m17 18 25 22M17 30 42 8m-25 10 8 8" /><path {...accent} d="m27 18 4 4-4 4-4-4z" /></>;
    case "book":
      return <><path {...pale} d="M7 9h15a5 5 0 0 1 5 5v27a5 5 0 0 0-5-5H7zM41 9H26v32a5 5 0 0 1 5-5h10z" /><path {...stroke} d="M7 9h15a5 5 0 0 1 5 5v27a5 5 0 0 0-5-5H7zM41 9H26v32a5 5 0 0 1 5-5h10zM12 17h8m-8 7h8m13-7h4m-4 7h4" /><path {...accent} d="M22 11h4v26h-4z" /></>;
    case "scroll":
      return <><path {...pale} d="M11 8h28v27a7 7 0 0 1-7 7H13a6 6 0 0 1-6-6V13a5 5 0 0 1 5-5z" /><path {...stroke} d="M11 8h28v27a7 7 0 0 1-7 7H13a6 6 0 0 1-6-6V13a5 5 0 0 1 5-5zm0 0v28a5 5 0 0 0 5 5M18 17h14m-14 7h14m-14 7h9" /><path {...accent} d="M13 10h23v3H13z" /></>;
    case "magazine":
      return <><path {...pale} d="M9 6h31v36H9z" /><path {...stroke} d="M9 6h31v36H9zM5 10v32h31M14 13h21v14H14zM14 32h21m-21 5h15" /><path {...accent} d="M17 16h15v8H17z" /></>;
    case "guitar":
      return <><path {...pale} d="M28 13 40 5l4 4-8 12a10 10 0 0 1-2 14 10 10 0 0 1-14 2 10 10 0 0 1 2-17z" /><path {...stroke} d="m28 13 12-8 4 4-8 12a10 10 0 0 1-2 14 10 10 0 0 1-14 2 10 10 0 0 1 2-17zM25 24l10 10M29 20l4-4" /><circle {...accent} cx="27" cy="29" r="3" /></>;
    case "flute":
      return <><path {...stroke} d="m8 33 27-27 6 6-27 27z" /><path {...pale} d="m8 33 27-27 6 6-27 27z" /><path {...stroke} d="m20 28 4 4m1-9 4 4m1-9 4 4m1-9 4 4" /><circle {...accent} cx="13" cy="34" r="2" /></>;
    case "drum":
      return <><ellipse {...pale} cx="24" cy="13" rx="16" ry="7" /><path {...stroke} d="M8 13v23c0 4 7 7 16 7s16-3 16-7V13M8 13c0 4 7 7 16 7s16-3 16-7m-32 9c0 4 7 7 16 7s16-3 16-7" /><path {...accent} d="M21 7h6v7h-6z" /></>;
    case "keyboard":
      return <><rect {...stroke} x="5" y="13" width="38" height="25" rx="3" /><path {...pale} d="M9 18h30v7H9z" /><path {...stroke} d="M9 18h30M12 27v7m6-7v7m6-7v7m6-7v7m6-7v7" /><path {...accent} d="M11 18h4v6h-4zm8 0h4v6h-4zm8 0h4v6h-4zm8 0h4v6h-4z" /></>;
    case "grain":
      return <><path {...stroke} d="M24 42V8m0 7c-9 0-13-5-13-11 8 0 13 4 13 11zm0 8c9 0 13-5 13-11-8 0-13 4-13 11zm0 4c-9 0-13-5-13-11 8 0 13 4 13 11zm0 8c9 0 13-5 13-11-8 0-13 4-13 11" /><path {...accent} d="M22 9h4v33h-4z" /></>;
    case "fruit":
      return <><path {...pale} d="M24 14c-13-9-22 2-17 16 4 12 13 15 17 11 4 4 13 1 17-11 5-14-4-25-17-16z" /><path {...stroke} d="M24 16c-13-9-22 2-17 14 4 12 13 15 17 11 4 4 13 1 17-11 5-12-4-23-17-14zM24 16c0-6 3-10 9-12" /><path {...accent} d="M25 12c2-7 9-9 15-6-2 6-7 9-15 8z" /></>;
    case "meat":
      return <><path {...pale} d="M10 29c-4-7 2-17 13-21 10-4 22 3 18 13-2 6-9 7-10 12-2 8-16 10-21-4z" /><path {...stroke} d="M10 29c-4-7 2-17 13-21 10-4 22 3 18 13-2 6-9 7-10 12-2 8-16 10-21-4z" /><circle {...accent} cx="30" cy="17" r="5" /><circle {...stroke} cx="30" cy="17" r="2" /></>;
    case "milk":
      return <><path {...pale} d="m14 12 4-7h12l4 7v30H14z" /><path {...stroke} d="m14 12 4-7h12l4 7v30H14zM14 12h20M20 5v7m-6 9h20" /><path {...accent} d="M20 25h8v11h-8z" /></>;
    case "box":
    case "basket":
      return <><path {...pale} d="M7 19h34l-4 23H11z" /><path {...stroke} d="M7 19h34l-4 23H11zM15 19l9-12 9 12M17 25v11m7-11v11m7-11v11" /><path {...accent} d="M20 27h8v6h-8z" /></>;
    case "fridge":
      return <><rect {...stroke} x="11" y="5" width="26" height="38" rx="3" /><path {...pale} d="M14 9h20v12H14zM14 24h20v15H14z" /><path {...stroke} d="M14 22h20m-15-9v5m0 10v7" /><path {...accent} d="M17 12h14v4H17z" /></>;
    case "washer":
      return <><rect {...stroke} x="9" y="5" width="30" height="38" rx="4" /><path {...pale} d="M12 17h24v22H12z" /><circle {...stroke} cx="24" cy="28" r="9" /><path {...accent} d="M19 28a5 5 0 0 1 10 0c0 4-3 6-5 6s-5-2-5-6z" /><circle {...stroke} cx="16" cy="11" r="1.5" /><circle {...stroke} cx="23" cy="11" r="1.5" /></>;
    case "airConditioner":
      return <><rect {...stroke} x="6" y="8" width="36" height="19" rx="4" /><path {...pale} d="M10 12h28v5H10z" /><path {...stroke} d="M12 22h24m-21 8-4 8m14-8v9m11-9 4 8" /><path {...accent} d="M15 14h18v2H15z" /></>;
    case "oven":
      return <><rect {...stroke} x="8" y="5" width="32" height="38" rx="3" /><path {...pale} d="M12 18h24v19H12z" /><path {...stroke} d="M12 18h24v19H12zM15 11h3m6 0h3m6 0h3" /><path {...accent} d="M16 22h16v11H16z" /></>;
    case "plug":
      return <><path {...pale} d="M15 20h18v10a9 9 0 0 1-18 0z" /><path {...stroke} d="M15 20h18v10a9 9 0 0 1-18 0zm5 0V9m8 11V9m-4 21v12m-8-29h16" /><path {...accent} d="M19 6h3v7h-3zm7 0h3v7h-3z" /></>;
    case "vacuum":
      return <><path {...pale} d="M12 20h17v14H12z" /><path {...stroke} d="M12 20h17v14H12zM18 20 11 7l4-2 9 15m5 8h7v8m-23-2-4 7m11-7v7" /><path {...accent} d="M15 24h11v6H15z" /></>;
    case "heater":
      return <><rect {...stroke} x="11" y="7" width="26" height="35" rx="4" /><path {...pale} d="M15 12h18v25H15z" /><path {...stroke} d="M15 12h18v25H15zM20 18v13m5-13v13m5-13v13M18 5h12" /><path {...accent} d="M19 17h2v15h-2zm8 0h2v15h-2z" /></>;
    case "solar":
      return <><path {...pale} d="M8 9h32l5 25H3z" /><path {...stroke} d="M8 9h32l5 25H3zM9 17h33M6 26h37M19 10l-3 24m13-24 3 24M24 34v8m-9 0h18" /><path {...accent} d="M12 12h8v4h-8zm13 0h8v4h-8z" /></>;
    case "battery":
      return <><rect {...stroke} x="8" y="12" width="32" height="27" rx="4" /><path {...pale} d="M12 16h24v19H12z" /><path {...stroke} d="M17 8v4m14-4v4m-7 9v13m-6-7h12" /><path {...accent} d="M22 21h4v11h-4z" /></>;
    case "inverter":
      return <><rect {...stroke} x="8" y="6" width="32" height="36" rx="4" /><path {...pale} d="M13 11h22v11H13z" /><path {...stroke} d="M13 11h22v11H13zM16 30h4m4 0h4m4 0h4M15 36h18" /><path {...accent} d="m25 12-5 7h5l-2 3 7-8h-5l2-2z" /></>;
    case "chargeController":
      return <><rect {...stroke} x="8" y="6" width="32" height="36" rx="4" /><path {...pale} d="M13 11h22v14H13z" /><path {...stroke} d="M13 11h22v14H13zM17 31h14m-11 6h8" /><path {...accent} d="M21 15h6v6h-6z" /></>;
    case "ruler":
      return <><path {...pale} d="M8 34 34 8l8 8-26 26z" /><path {...stroke} d="M8 34 34 8l8 8-26 26zM27 15l4 4m-9 0 4 4m-9 0 4 4m-9 0 4 4" /><path {...accent} d="m34 8 4-4 8 8-4 4z" /></>;
    case "cap":
      return <><path {...pale} d="m4 19 20-12 20 12-20 12z" /><path {...stroke} d="m4 19 20-12 20 12-20 12zM12 24v10c7 7 17 7 24 0V24m8-5v14m0 0-3 5h6z" /><path {...accent} d="M17 20h14v3H17z" /></>;
    case "palm":
      return <><path {...stroke} d="M24 42V20m0 0C14 20 9 15 7 8c8 0 15 3 17 12m0 0c2-9 9-12 17-12-2 7-7 12-17 12M24 21C21 12 24 6 30 3c3 7 1 13-6 18M9 42h30" /><path {...pale} d="M24 20C17 7 23 2 30 3c3 7 1 13-6 18z" /><path {...accent} d="M22 20h4v22h-4z" /></>;
    case "perfume":
      return <><path {...pale} d="M16 17h16l4 7v18H12V24z" /><path {...stroke} d="M16 17h16l4 7v18H12V24zM20 17v-6h8v6m-6-6V7h4v4M12 29h24" /><path {...accent} d="M19 31h10v7H19z" /></>;
    case "order":
      return <><circle {...stroke} cx="21" cy="21" r="13" /><path {...stroke} d="m31 31 12 12M16 21h10m-5-5v10" /><circle {...accent} cx="21" cy="21" r="5" /></>;
    case "other":
    default:
      return <><rect {...pale} x="7" y="7" width="34" height="34" rx="10" /><path {...stroke} d="M15 17h18M15 24h18M15 31h12" /><circle {...accent} cx="34" cy="34" r="4" /></>;
  }
}

export default function CategoryIcon({ category, size = 48, className = "" }) {
  const kind = getCategoryIconKey(category);
  const dimension = typeof size === "number" ? `${size}px` : size;

  if (!kind && typeof category?.image === "string" && category.image.trim()) {
    return (
      <img
        src={uploadsUrl(category.image, "thumb")}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={className}
        style={{ width: dimension, height: dimension, objectFit: "contain" }}
      />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={dimension}
      height={dimension}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <Artwork kind={kind || "other"} />
    </svg>
  );
}
