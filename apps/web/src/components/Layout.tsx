import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
}

export function Layout({ children, favorites, setFavorites }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <Sidebar favorites={favorites} setFavorites={setFavorites} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
