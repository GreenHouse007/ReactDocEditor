import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { DocumentEdit } from "./pages/DocumentEdit";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/document/:id" element={<DocumentEdit />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
