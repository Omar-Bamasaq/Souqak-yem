import React, { createContext, useContext } from "react";

const SsgDataContext = createContext(null);

export function SsgDataProvider({ value, children }) {
  return <SsgDataContext.Provider value={value}>{children}</SsgDataContext.Provider>;
}

export function useSsgData() {
  return useContext(SsgDataContext);
}
