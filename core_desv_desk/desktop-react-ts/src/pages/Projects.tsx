import{
  useEffect,
  useState,
  FormEvent,
  useRef,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  FileText,
  Code,
  Play,
  X,
  ChevronDown,
  SlidersHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import labLogo from "@/assets/projects-icon.png";

type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
  chat_mode?: string | null;
  due_date?: string | null;
};

type AssignableUser = {
  id: string;
  full_name: string | null;
  auth_user_id: string | null;
};

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>(""); // fecha límite (YYYY-MM-DD)
  const [status, setStatus] = useState<string>("active");
  const [chatMode, setChatMode] = useState<"group" | "individual">("group");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // miembros & usuarios asignables
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // archivo inicial
  const [initialFile, setInitialFile] = useState<File | null>(null);

  // Estado para LaTeX
  const [showLatexEditor, setShowLatexEditor] = useState(false);
  const [latexCode, setLatexCode] = useState("");
  const [latexPreview, setLatexPreview] = useState("");

  // Sidebar redimensionable
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isResizing, setIsResizing] = useState(false);

  // =============================
  //  Cargar proyectos del usuario
  // =============================
  useEffect(() => {
    if (!user) return;

    const loadProjects = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando proyectos:", error);
      } else {
        setProjects((data as Project[]) || []);
      }

      setLoading(false);
    };

    loadProjects();
  }, [user]);

  // =============================
  //  Cargar usuarios desde students
  // =============================
  useEffect(() => {
    const loadAssignableUsers = async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, auth_user_id")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Error cargando students:", error);
        return;
      }

      setAssignableUsers((data || []) as AssignableUser[]);
    };

    loadAssignableUsers();
  }, []);

  // =============================
  //  Toggle de miembros (checklist)
  // =============================
  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // =============================
  //  Abrir formulario para crear
  // =============================
  const openCreateForm = () => {
    setEditingProject(null);
    setNewName("");
    setNewDescription("");
    setDueDate("");
    setStatus("active");
    setChatMode("group");
    setSelectedMemberIds([]);
    setInitialFile(null);
    setError(null);
    setShowForm(true);
  };

  // =============================
  //  Abrir formulario para editar
  // =============================
  const openEditForm = (project: Project) => {
    setEditingProject(project);
    setNewName(project.name);
    setNewDescription(project.description || "");
    setStatus(project.status || "active");
    setChatMode(
      project.chat_mode === "individual" ? "individual" : "group"
    );
    setDueDate(project.due_date ? project.due_date.slice(0, 10) : "");
    // Miembros: podríamos cargarlos, pero por ahora solo editamos campos básicos.
    setSelectedMemberIds([]);
    setInitialFile(null);
    setError(null);
    setShowForm(true);
  };

  // =============================
  //  Guardar (crear o actualizar) proyecto
  // =============================
  async function handleSaveProject(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!newName.trim()) {
      setError("El nombre del proyecto es obligatorio.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let projectId: string;
      let projectResult: Project;

      if (editingProject) {
        // --------- UPDATE ----------
        const { data, error: updateError } = await supabase
          .from("projects")
          .update({
            name: newName.trim(),
            description: newDescription.trim() || null,
            status,
            chat_mode: chatMode,
            due_date: dueDate || null,
          })
          .eq("id", editingProject.id)
          .select()
          .single();

        if (updateError || !data) {
          console.error("Error actualizando proyecto:", updateError);
          setError("No se pudo actualizar el proyecto.");
          setSaving(false);
          return;
        }

        projectId = data.id as string;
        projectResult = data as Project;

        // actualizamos en estado
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? projectResult : p))
        );
      } else {
        // --------- INSERT ----------
        const { data, error: projectError } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name: newName.trim(),
            description: newDescription.trim() || null,
            status,
            chat_mode: chatMode,
            due_date: dueDate || null,
          })
          .select()
          .single();

        if (projectError || !data) {
          console.error("Error creando proyecto:", projectError);
          setError("No se pudo crear el proyecto.");
          setSaving(false);
          return;
        }

        projectId = data.id as string;
        projectResult = data as Project;

        // 2) Asignar miembros (owner + seleccionados)
        const memberIds = Array.from(
          new Set([user.id, ...selectedMemberIds.filter((id) => !!id)])
        );

        if (memberIds.length > 0) {
          const rows = memberIds.map((uid) => ({
            project_id: projectId,
            user_id: uid,
            role: uid === user.id ? "owner" : "member",
          }));

          const { error: membersError } = await supabase
            .from("project_members")
            .insert(rows);

          if (membersError) {
            console.error("Error creando project_members:", membersError);
          }
        }

        // 3) Subir archivo inicial (opcional)
        if (initialFile) {
          const filePath = `${projectId}/${Date.now()}_${initialFile.name}`;

          const { error: uploadError } = await supabase.storage
            .from("project_files")       
            .upload(filePath, initialFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("Error subiendo archivo:", uploadError);
          } else {
            const { error: metaError } = await supabase
              .from("project_files")
              .insert({
                project_id: projectId,
                uploader_id: user.id,      // 👈 coincide con la tabla
                name: initialFile.name,
                storage_path: filePath,    // 👈 ruta dentro del bucket
              });

            if (metaError) {
              console.error("Error guardando metadata de archivo:", metaError);
            }
          }
        }


        // agregar a la lista
        setProjects((prev) => [projectResult, ...prev]);
      }

      // limpiar formulario
      setNewName("");
      setNewDescription("");
      setDueDate("");
      setStatus("active");
      setChatMode("group");
      setSelectedMemberIds([]);
      setInitialFile(null);
      setEditingProject(null);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  // =============================
  //  Eliminar proyecto
  // =============================
  const handleDeleteProject = async (project: Project) => {
    const confirmDelete = window.confirm(
      `¿Seguro que quieres eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      // Borra miembros
      const { error: membersError } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", project.id);
      if (membersError) {
        console.error("Error eliminando project_members:", membersError);
      }

      // Borra metadata de archivos (no borramos del storage para no complicar)
      const { error: filesError } = await supabase
        .from("project_files")
        .delete()
        .eq("project_id", project.id);
      if (filesError) {
        console.error("Error eliminando project_files:", filesError);
      }

      // Borra proyecto
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (projectError) {
        console.error("Error eliminando proyecto:", projectError);
        alert("No se pudo eliminar el proyecto en la base de datos.");
        return;
      }

      // Actualizar UI
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err) {
      console.error("Excepción eliminando proyecto:", err);
      alert("Ocurrió un error eliminando el proyecto.");
    }
  };

  // =============================
  //  Funciones LaTeX (simuladas)
  // =============================
  const handlePreviewLatex = () => {
    setLatexPreview(latexCode);
  };

  const handleRunLatex = () => {
    alert(
      "Compilación LaTeX iniciada. En una implementación real, esto generaría un PDF."
    );
  };

  // =============================
  //  Resizing sidebar
  // =============================
  const startResizing = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const min = 200;
      const max = 420;
      const newWidth = Math.min(max, Math.max(min, x));

      setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      if (isResizing) {
        setIsResizing(false);
      }
    }

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // =============================
  //  UI
  // =============================
  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-gray-50 flex overflow-hidden"
    >
      {/* ================ SIDEBAR ================ */}
      <aside
        className="bg-white border-r border-gray-200 flex flex-col"
        style={{ width: sidebarWidth }}
      >
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          {/* Icono + textos a la izquierda */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center">
              <img
                src={labLogo}          // tu PNG
                alt="Proyectos"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Proyectos
              </h1>
              <p className="text-sm text-gray-600">
                Gestión de proyectos de investigación
              </p>
            </div>
          </div>

          {/* Botón + a la derecha */}
          <button
            onClick={openCreateForm}
            className="w-8 h-8 bg-gray-800 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>


        {/* Herramientas */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Herramientas
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowLatexEditor((prev) => !prev)}
              className={`p-3 rounded-lg text-left transition-colors ${
                showLatexEditor
                  ? "bg-emerald-50 border border-emerald-600"
                  : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Code className="w-4 h-4 text-emerald-700" />
                <div className="text-sm font-medium text-gray-900">
                  Editor LaTeX
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Crear documentos científicos
              </div>
            </button>
            <button className="p-3 bg-gray-50 rounded-lg text-left hover:bg-gray-100 transition-colors border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-emerald-700" />
                <div className="text-sm font-medium text-gray-900">
                  Plantillas
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Formatos predefinidos
              </div>
            </button>
          </div>
        </div>

        {/* Resumen + recientes */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Resumen</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-900 px-3 py-2">
                  <span className="text-sm text-gray-800">
                    Proyectos activos
                  </span>
                  <span className="text-sm font-semibold text-emerald-900">
                    {projects.filter((p) => p.status === "active").length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2">
                  <span className="text-sm text-gray-800">Total proyectos</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {projects.length}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Recientes
              </h3>
              <div className="space-y-2">
                {projects.slice(0, 3).map((project) => (
                  <div
                    key={project.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {project.description || "Sin descripción"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Handle de resize */}
      <div
        onMouseDown={startResizing}
        className={`w-[3px] cursor-col-resize bg-gray-200 hover:bg-gray-300 transition-colors ${
          isResizing ? "bg-gray-400" : ""
        }`}
      />

      {/* ================ MAIN CONTENT ================ */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Gestión de Proyectos
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {user?.email} • {projects.length} proyectos
              </p>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-1.5 rounded-md hover:bg-gray-50 transition text-sm">
                <SlidersHorizontal className="w-3 h-3" />
                Filtros
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {showLatexEditor ? (
            /* ======== VISTA EDITOR LATEX ======== */
            <div className="max-w-6xl mx-auto py-6 px-4 flex flex-col gap-6 h-full">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Herramienta
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-700" />
                    Editor LaTeX
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Escribe tu documento y visualiza la salida en paralelo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={handlePreviewLatex}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Vista previa
                  </button>
                  <button
                    onClick={handleRunLatex}
                    className="px-4 py-2 bg-emerald-900 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Compilar PDF
                  </button>
                  <button
                    onClick={() => setShowLatexEditor(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Volver a proyectos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[420px]">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">
                    Código LaTeX
                  </label>
                  <textarea
                    value={latexCode}
                    onChange={(e) => setLatexCode(e.target.value)}
                    placeholder={`\\documentclass{article}
\\begin{document}
Tu ecuación: $E = mc^2$
\\end{document}`}
                    className="w-full flex-1 border border-gray-300 rounded-lg p-4 font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">
                    Vista previa
                  </label>
                  <div className="w-full flex-1 border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-auto">
                    {latexPreview ? (
                      <div className="text-sm">
                        <pre className="whitespace-pre-wrap">
                          {latexPreview}
                        </pre>
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <strong>Nota:</strong> En una implementación real,
                            aquí se renderizaría el LaTeX como PDF o ecuaciones
                            usando MathJax o KaTeX.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm h-full flex items-center justify-center">
                        La vista previa aparecerá aquí
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ======== VISTA NORMAL DE PROYECTOS ======== */
            <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
              {showForm && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingProject ? "Editar proyecto" : "Nuevo Proyecto"}
                  </h3>
                  <form onSubmit={handleSaveProject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del proyecto *
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ej. Monitoreo FrEDie – Línea 1"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Descripción corta del proyecto..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                      />
                    </div>

                    {/* Estado (solo tiene sentido al editar, pero lo dejamos también para crear) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estado
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="active">Activo</option>
                        <option value="paused">En pausa</option>
                        <option value="completed">Completado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </div>

                    {/* Fecha límite */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha límite
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Opcional, se usará para mostrar el deadline en
                        pendientes.
                      </p>
                    </div>

                    {/* Miembros (checklist) – solo al crear */}
                    {!editingProject && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Miembros del proyecto
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Marca quiénes estarán en el proyecto. El creador se
                          añadirá automáticamente como propietario.
                        </p>

                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                          {assignableUsers.length === 0 && (
                            <p className="text-xs text-gray-400">
                              No hay estudiantes registrados todavía.
                            </p>
                          )}

                          {assignableUsers.map((u) => {
                            const disabled = !u.auth_user_id;
                            const checked =
                              !!u.auth_user_id &&
                              selectedMemberIds.includes(u.auth_user_id);

                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-2 text-sm ${
                                  disabled
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-500"
                                  disabled={disabled}
                                  checked={checked}
                                  onChange={() => {
                                    if (!u.auth_user_id) return;
                                    toggleMember(u.auth_user_id);
                                  }}
                                />
                                <span>
                                  {u.full_name || "Sin nombre"}
                                  {disabled && " (sin usuario auth vinculado)"}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tipo de chat */}
                    <div>
                      <span className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de chat del proyecto
                      </span>
                      <div className="flex flex-col gap-1 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="chatMode"
                            value="group"
                            checked={chatMode === "group"}
                            onChange={() => setChatMode("group")}
                          />
                          <span>Chat grupal (todos los miembros)</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="chatMode"
                            value="individual"
                            checked={chatMode === "individual"}
                            onChange={() => setChatMode("individual")}
                          />
                          <span>Chats individuales (por tarea / usuario)</span>
                        </label>
                      </div>
                    </div>

                    {/* Archivo inicial – solo cuando creas */}
                    {!editingProject && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Archivo inicial (opcional)
                        </label>
                        <input
                          type="file"
                          onChange={(e) =>
                            setInitialFile(e.target.files?.[0] ?? null)
                          }
                          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-900 hover:file:bg-emerald-100"
                        />
                        {initialFile && (
                          <p className="text-xs text-gray-500 mt-1">
                            Seleccionado: {initialFile.name}
                          </p>
                        )}
                      </div>
                    )}

                    {error && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                        {error}
                      </p>
                    )}

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setError(null);
                          setNewName("");
                          setNewDescription("");
                          setDueDate("");
                          setStatus("active");
                          setSelectedMemberIds([]);
                          setInitialFile(null);
                          setChatMode("group");
                          setEditingProject(null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-900 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {saving
                          ? editingProject
                            ? "Guardando..."
                            : "Creando..."
                          : editingProject
                          ? "Guardar cambios"
                          : "Crear proyecto"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Lista de proyectos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Todos los proyectos ({projects.length})
                  </h3>
                </div>

                {loading && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900 mx-auto"></div>
                    <p className="text-gray-500 mt-2">
                      Cargando proyectos...
                    </p>
                  </div>
                )}

                {!loading && projects.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      No tienes proyectos creados aún.
                    </p>
                    <button
                      onClick={openCreateForm}
                      className="mt-4 px-4 py-2 bg-emerald-900 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                    >
                      Crear primer proyecto
                    </button>
                  </div>
                )}

                {!loading && projects.length > 0 && (
                  <div className="grid gap-4">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              {project.name}
                            </h4>
                            <p className="text-gray-600 mb-3">
                              {project.description || "Sin descripción"}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <span>
                                Estado:{" "}
                                <span
                                  className={`font-medium ${
                                    project.status === "active"
                                      ? "text-emerald-700"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {project.status || "active"}
                                </span>
                              </span>
                              <span>
                                Creado:{" "}
                                {new Date(
                                  project.created_at
                                ).toLocaleDateString()}
                              </span>
                              {project.due_date && (
                                <span>
                                  Entrega:{" "}
                                  {new Date(
                                    project.due_date
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              {project.chat_mode && (
                                <span>
                                  Chat:{" "}
                                  {project.chat_mode === "individual"
                                    ? "Individual"
                                    : "Grupal"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex gap-2">
                              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowLatexEditor(true)}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Code className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => openEditForm(project)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
