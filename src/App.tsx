import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import Onboarding from "./components/Onboarding";
import Layout from "./components/Layout";
import CommandPalette from "./components/CommandPalette";
import Dashboard from "./views/Dashboard";
import Learn from "./views/Learn";
import Review from "./views/Review";
import Dictionary from "./views/Dictionary";
import Conversation from "./views/Conversation";
import Chat from "./views/Chat";
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
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/conversation" element={<Conversation />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </Onboarding>
    </AppProvider>
  );
}
