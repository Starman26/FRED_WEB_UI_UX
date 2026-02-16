// src/main.tsx
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import "./styles.css";

import { AuthProvider } from "./context/AuthContext";
import { ThinkingProvider } from "./context/Thinkingcontext";
import ProtectedRoute from "./context/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
// Pages
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Projects from "./pages/Projects";
import Config from "./pages/Config";
import ProfilePage from "./pages/Profile";
import LivingLabPage from "./pages/LivingLabPage";

function AppRoutes() {
  return (
    <AuthProvider>
      <ThinkingProvider>
        
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Protected onboarding (no layout) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Protected main routes (with layout) */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/config" element={<Config />} />
            <Route path="/living" element={<LivingLabPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThinkingProvider>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);