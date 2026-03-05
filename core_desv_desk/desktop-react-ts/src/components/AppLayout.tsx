// src/components/AppLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname.replace(/^\/+/, "");

  const isWidget = path.startsWith("widget");
  if (isWidget) {
    return (
      <div className="w-full h-full bg-transparent">
        <Outlet />
      </div>
    );
  }

  const current =
    path.startsWith("projects") ? "proyectos" :
    path.startsWith("chat") ? "chat" :
    path.startsWith("config") ? "widget" :
    path.startsWith("notebook") ? "notebook" :
    path.startsWith("living") ? "living" :
    path.startsWith("profile") ? "perfil" :
    "inicio";

  const isChat = path.startsWith("chat");

  const isFullPage =
    isChat ||
    path.startsWith("dashboard") ||
    path.startsWith("projects") ||
    path.startsWith("config") ||
    path.startsWith("notebook") ||
    path.startsWith("living") ||
    path.startsWith("profile") ||
    path === "" ||
    path === "/";

  return (
    <div
      className="
        h-screen w-full overflow-hidden
        bg-[#343437]
        flex
      "
    >
      <Sidebar
        current={current}
        onNavigate={(k) => {
          if (k === "inicio") navigate("/dashboard");
          else if (k === "proyectos") navigate("/projects");
          else if (k === "living") navigate("/living");
          else if (k === "chat") navigate("/chat");
          else if (k === "widget") navigate("/config");
          else if (k === "notebook") navigate("/notebook");
          else if (k === "perfil") navigate("/profile");
        }}
      />

      <main
        className="
          flex-1 h-screen flex flex-col overflow-hidden
          bg-transparent
        "
      >
        {isFullPage ? (
          <div className="flex-1 overflow-hidden">
            <div
              className="
                h-full
                bg-white
                shadow-sm
                overflow-hidden
              "
            >
              <Outlet />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-10 py-8 bg-white rounded-tl-3xl shadow-sm">
              <Outlet />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}