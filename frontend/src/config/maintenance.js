const maintenanceValue = String(import.meta.env.VITE_MAINTENANCE_MODE ?? "false").trim().toLowerCase();

export const IS_MAINTENANCE = maintenanceValue === "true" || maintenanceValue === "1" || maintenanceValue === "yes";
