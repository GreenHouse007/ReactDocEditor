import { createContext, useContext, type ReactNode } from "react";

interface IndexContextValue {
  selectedIndexId: string | null;
  setSelectedIndexId: (indexId: string | null) => void;
}

const IndexContext = createContext<IndexContextValue | undefined>(undefined);

export function useIndexContext(): IndexContextValue {
  const context = useContext(IndexContext);

  if (!context) {
    throw new Error("useIndexContext must be used within an IndexProvider");
  }

  return context;
}

interface IndexProviderProps {
  value: IndexContextValue;
  children: ReactNode;
}

export function IndexProvider({ value, children }: IndexProviderProps) {
  return <IndexContext.Provider value={value}>{children}</IndexContext.Provider>;
}
