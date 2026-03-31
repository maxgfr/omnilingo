import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import Onboarding from "./components/Onboarding";
import Layout from "./components/Layout";
import CommandPalette from "./components/CommandPalette";
import Dashboard from "./views/Dashboard";
import Learn from "./views/Learn";
import Review from "./views/Review";
import Grammar from "./views/Grammar";
import Conjugation from "./views/Conjugation";
import Dictionary from "./views/Dictionary";
import Quiz from "./views/Quiz";
import Flashcards from "./views/Flashcards";
import Conversation from "./views/Conversation";
import Chat from "./views/Chat";
import Stats from "./views/Stats";
import Tools from "./views/Tools";
import Settings from "./views/Settings";

export default function App() {
  return (
    <AppProvider>
      <Onboarding>
        <HashRouter>
          <CommandPalette />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/review" element={<Review />} />
              <Route path="/grammar" element={<Grammar />} />
              <Route path="/conjugation" element={<Conjugation />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/conversation" element={<Conversation />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </Onboarding>
    </AppProvider>
  );
}
