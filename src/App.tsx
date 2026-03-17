import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import Layout from "./components/Layout";
import Dashboard from "./views/Dashboard";
import Learn from "./views/Learn";
import Review from "./views/Review";
import Grammar from "./views/Grammar";
import Conjugation from "./views/Conjugation";
import Dictionary from "./views/Dictionary";
import Chat from "./views/Chat";
import Settings from "./views/Settings";

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/review" element={<Review />} />
            <Route path="/grammar" element={<Grammar />} />
            <Route path="/conjugation" element={<Conjugation />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
