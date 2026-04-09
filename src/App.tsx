import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import Layout from "./components/Layout";
import CommandPalette from "./components/CommandPalette";
import Dictionary from "./views/Dictionary";
import Favorites from "./views/Favorites";
import Grammar from "./views/Grammar";
import Conjugation from "./views/Conjugation";

import Conversation from "./views/Conversation";
import Rephrase from "./views/Rephrase";
import Corrector from "./views/Corrector";
import Synonyms from "./views/Synonyms";
import TextAnalysis from "./views/TextAnalysis";
import Settings from "./views/Settings";

export default function App() {
  return (
    <AppProvider>
        <HashRouter>
          <CommandPalette />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dictionary" replace />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/grammar" element={<Grammar />} />
              <Route path="/conjugation" element={<Conjugation />} />

              <Route path="/conversation" element={<Conversation />} />
              <Route path="/rephrase" element={<Rephrase />} />
              <Route path="/corrector" element={<Corrector />} />
              <Route path="/synonyms" element={<Synonyms />} />
              <Route path="/text-analysis" element={<TextAnalysis />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
    </AppProvider>
  );
}
