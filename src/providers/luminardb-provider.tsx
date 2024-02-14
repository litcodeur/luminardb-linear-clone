import { getDatabaseParams, type LuminarDB } from "@/lib/luminardb";
import { isServer } from "@tanstack/react-query";
import { Database } from "luminardb";
import React from "react";

type LuminarDBContextType = {
  db: LuminarDB;
};

const LuminarDBContext = React.createContext<LuminarDBContextType | null>(null);

export function LuminarDBProvider(
  props: React.PropsWithChildren<{ workspaceId: string }>,
) {
  const [db] = React.useState<LuminarDB>(
    new Database(getDatabaseParams(props.workspaceId)),
  );

  return (
    <LuminarDBContext.Provider value={{ db }}>
      {props.children}
    </LuminarDBContext.Provider>
  );
}

export function useLuminarDB() {
  const context = React.useContext(LuminarDBContext);

  if (!context) {
    throw new Error("useLuminarDB must be used within a LuminarDBProvider");
  }

  return context.db;
}
