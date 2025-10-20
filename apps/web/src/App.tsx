import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { DocumentEdit } from "./pages/DocumentEdit";
import { useState } from "react";

function App() {
  const [favorites, setFavorites] = useState<string[]>([]);

  return (
    <BrowserRouter>
      <Layout favorites={favorites} setFavorites={setFavorites}>
        <Routes>
          <Route path="/" element={<Home favorites={favorites} />} />
          <Route path="/document/:id" element={<DocumentEdit />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
