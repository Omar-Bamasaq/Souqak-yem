import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BrokerageStatusContext = createContext({ enabled: false, loading: true, refresh: () => {} });

const getBaseUrl = () => {
  let base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  base = base.replace(/\/$/, "");
  if (!base.endsWith("/api")) base = `${base}/api`;
  return `${base}/`;
};

export const BrokerageStatusProvider = ({ children }) => {
  const [status, setStatus] = useState({ enabled: false, loading: true });

  const load = async () => {
    try {
      const res = await axios.get(getBaseUrl() + "admin/settings/public");
      setStatus({ enabled: res.data.brokerageEnabled === true, loading: false });
    } catch {
      setStatus({ enabled: false, loading: false });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <BrokerageStatusContext.Provider value={{ ...status, refresh: load }}>
      {children}
    </BrokerageStatusContext.Provider>
  );
};

export const useBrokerageStatus = () => useContext(BrokerageStatusContext);
