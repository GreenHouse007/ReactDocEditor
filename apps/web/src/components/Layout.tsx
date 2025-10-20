import { Sidebar } from "./Sidebar";
import { useState, type ReactNode } from "react";
import { IndexProvider } from "../contexts/IndexContext";

interface LayoutProps {
  children: ReactNode;
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
}

export function Layout({ children, favorites, setFavorites }: LayoutProps) {
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);

  return (
    <IndexProvider value={{ selectedIndexId, setSelectedIndexId }}>
      <div className="flex h-screen overflow-hidden bg-gray-900">
        <Sidebar favorites={favorites} setFavorites={setFavorites} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </IndexProvider>
  );
}
