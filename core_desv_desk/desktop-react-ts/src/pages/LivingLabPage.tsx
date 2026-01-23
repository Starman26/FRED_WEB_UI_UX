// src/pages/LivingLabPage.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Activity,
  Bot,
  HardDrive,
  AlertTriangle,
  Waves,
  RadioTower,
  Trash2,
  Edit2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import labLogo from "@/assets/living-lab-icon.png";

import "../styles/living-lab.css";

type Device = {
  id: string;
  name: string;
  type: "camera" | "plc" | "robot" | "sensor";
  status: "online" | "offline";
  description: string;
};

type ConnectionFlow = {
  id: string;
  name: string;
  status: "activa" | "pausada";
  source: string;
  target: string;
  description: string;
};

// --- TIPOS PARA DATA SOURCES DEL AGENTE ---
type PublicTable = {
  table_name: string;
};

type AgentTable = {
  id: string;
  team_id: string;
  project_id?: string | null;
  table_name: string;
  display_name?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type TablePreviewRow = Record<string, any>;

type LabTeam = {
  id: string;
  name: string;
  code: string;
};

// Archivos reales en Supabase
type ProjectFile = {
  id: string;
  project_id: string | null;
  uploader_id: string | null;
  name: string;
  storage_path: string;
  created_at: string | null;
};

// --- MOCKS PARA DISPOSITIVOS / FLUJOS ---
const mockDevices: Device[] = [
  {
    id: "cam-1",
    name: "Cámara Línea 1",
    type: "camera",
    status: "online",
    description: "Célula de extrusión · RTSP – 192.168.10.21",
  },
  {
    id: "plc-1",
    name: "PLC Siemens S7-1200",
    type: "plc",
    status: "online",
    description: "Panel principal · OPC-UA – 192.168.10.5:4840",
  },
];

const mockFlows: ConnectionFlow[] = [
  {
    id: "flow-1",
    name: "Inspección visual extrusión",
    status: "activa",
    source: "Cámara Línea 1",
    target: "FrEDIE Vision Agent",
    description: "Usar modelo CLIP para clasificación de defectos.",
  },
  {
    id: "flow-2",
    name: "Estado de línea a dashboard",
    status: "activa",
    source: "PLC Siemens S7-1200",
    target: "Qlik / Snowflake",
    description: "Stream de variables de proceso cada 5 s.",
  },
];

const panelOptions = [
  {
    id: "camaras",
    title: "Cámaras",
    description: "Ver video en tiempo real.",
    icon: Camera,
    badge: "En vivo",
  },
  {
    id: "alarmas",
    title: "Alarmas",
    description: "E-Stop, puertas, PLC.",
    icon: AlertTriangle,
    badge: "Crítico",
  },
  {
    id: "sensores",
    title: "Sensores",
    description: "Temp · CO₂ · humedad.",
    icon: Waves,
    badge: "Estable",
  },
  {
    id: "trafico",
    title: "Tráfico",
    description: "PLC · SCADA · nube.",
    icon: RadioTower,
    badge: "Streaming",
  },
] as const;

// =============== MODAL PARA AÑADIR DATA SOURCE =================

type AddDataModalProps = {
  teamId: string;
  existingTables: string[];
  onClose: () => void;
  onSaved: () => void;
};

function AddDataModal({ teamId, existingTables, onClose, onSaved }: AddDataModalProps) {
  const [tables, setTables] = useState<PublicTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<TablePreviewRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTables = async () => {
      setLoadingTables(true);
      const { data, error } = await supabase.rpc("list_public_tables");
      setLoadingTables(false);
      if (!error && data) setTables(data as PublicTable[]);
      else console.error("Error cargando tablas públicas:", error);
    };
    loadTables();
  }, []);

  const availableTables = tables.filter((t) => !existingTables.includes(t.table_name));

  const handleSelectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setPreviewRows([]);
    if (!tableName) return;

    setLoadingPreview(true);
    const { data, error } = await supabase.from(tableName).select("*").limit(10);
    setLoadingPreview(false);

    if (!error && data) {
      setPreviewRows(data as TablePreviewRow[]);
      if (!displayName) setDisplayName(tableName);
    } else {
      console.error("Error cargando preview de tabla:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedTable) return;
    setSaving(true);

    const { error } = await supabase.from("agent_tables").insert({
      team_id: teamId,
      project_id: null,
      table_name: selectedTable,
      display_name: displayName || selectedTable,
      description,
    });

    setSaving(false);
    if (error) {
      console.error("Error guardando agent_table:", error);
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="ll_modalOverlay" role="dialog" aria-modal="true">
      <div className="ll_modal ll_modal--wide">
        <div className="ll_modalHeader">
          <div>
            <h2 className="ll_modalTitle">Añadir data source para el agente</h2>
            <p className="ll_muted">
              Selecciona una tabla de Supabase, revisa un preview y define el contexto que FrEDie usará.
            </p>
          </div>
          <button onClick={onClose} className="ll_iconBtn" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="ll_modalGrid">
          <div className="ll_modalCol">
            <label className="ll_label">Tabla de Supabase</label>
            <select
              value={selectedTable}
              onChange={(e) => handleSelectTable(e.target.value)}
              className="ll_input"
            >
              <option value="">
                {loadingTables ? "Cargando tablas..." : "Selecciona una tabla..."}
              </option>
              {availableTables.map((t) => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name}
                </option>
              ))}
            </select>

            <div className="ll_formStack">
              <div>
                <label className="ll_label">Nombre amigable</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="ll_input"
                  placeholder="Ej. Tareas del proyecto, Logs del robot…"
                />
              </div>

              <div>
                <label className="ll_label">Descripción / contexto para el agente</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="ll_textarea"
                  placeholder="Ej. Contiene las tareas, progreso (0–100) y fechas límite del laboratorio."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="ll_modalCol ll_modalCol--preview">
            <div className="ll_previewTopRow">
              <p className="ll_label">Preview de datos (10 filas)</p>
              {selectedTable && (
                <span className="ll_monoTiny">
                  Tabla: <span className="ll_mono">{selectedTable}</span>
                </span>
              )}
            </div>

            <div className="ll_tableBox">
              {loadingPreview && <p className="ll_muted">Cargando preview…</p>}

              {!loadingPreview && previewRows.length === 0 && (
                <p className="ll_muted">Selecciona una tabla para ver un preview de sus datos.</p>
              )}

              {!loadingPreview && previewRows.length > 0 && (
                <table className="ll_table">
                  <thead>
                    <tr>
                      {Object.keys(previewRows[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([col, val]) => (
                          <td key={col}>
                            {val === null || val === undefined ? "-" : String(val).slice(0, 60)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="ll_modalFooter">
          <button onClick={onClose} className="ll_btn ll_btn--ghost">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedTable || saving}
            className="ll_btn ll_btn--primary"
          >
            {saving ? "Guardando…" : "Guardar como data source"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== MODAL PARA EDITAR / BORRAR TODAS LAS TABLAS ==============

type ManageDataSourcesModalProps = {
  teamId: string;
  onClose: () => void;
  onChanged: () => void;
};

function ManageDataSourcesModal({ teamId, onClose, onChanged }: ManageDataSourcesModalProps) {
  const [tables, setTables] = useState<AgentTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewById, setPreviewById] = useState<Record<string, TablePreviewRow[]>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!teamId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_tables")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });
      setLoading(false);
      if (!error && data) setTables(data as AgentTable[]);
      else console.error("Error cargando agent_tables:", error);
    };
    load();
  }, [teamId]);

  const handleFieldChange = (id: string, field: "display_name" | "description", value: string) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSaveRow = async (row: AgentTable) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from("agent_tables")
      .update({ display_name: row.display_name, description: row.description })
      .eq("id", row.id);
    setSavingId(null);

    if (error) console.error("Error actualizando agent_table:", error);
    else onChanged();
  };

  const handleDeleteRow = async (row: AgentTable) => {
    if (!window.confirm("¿Eliminar esta tabla del agente?")) return;

    setDeletingId(row.id);
    const { error } = await supabase.from("agent_tables").delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      console.error("Error eliminando agent_table:", error);
    } else {
      setTables((prev) => prev.filter((t) => t.id !== row.id));
      onChanged();
    }
  };

  const togglePreview = async (row: AgentTable) => {
    if (previewById[row.id]) {
      setPreviewById((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      return;
    }

    setPreviewLoadingId(row.id);
    const { data, error } = await supabase.from(row.table_name).select("*").limit(5);
    setPreviewLoadingId(null);

    if (!error && data) {
      setPreviewById((prev) => ({ ...prev, [row.id]: data as TablePreviewRow[] }));
    } else {
      console.error("Error cargando preview:", error);
    }
  };

  return (
    <div className="ll_modalOverlay" role="dialog" aria-modal="true">
      <div className="ll_modal ll_modal--wide">
        <div className="ll_modalHeader">
          <div>
            <h2 className="ll_modalTitle">Tablas asignadas al agente</h2>
            <p className="ll_muted">
              Edita el nombre, la descripción o elimina tablas que ya no quieras exponer al agente.
            </p>
          </div>
          <button onClick={onClose} className="ll_iconBtn" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {loading && <p className="ll_muted">Cargando tablas…</p>}

        {!loading && tables.length === 0 && (
          <p className="ll_muted">No hay tablas configuradas aún para este laboratorio.</p>
        )}

        {!loading && tables.length > 0 && (
          <div className="ll_modalList">
            {tables.map((t) => {
              const rows = previewById[t.id] || [];
              const isPreviewOpen = !!previewById[t.id];
              const isSaving = savingId === t.id;
              const isDeleting = deletingId === t.id;
              const isPreviewLoading = previewLoadingId === t.id;

              return (
                <div key={t.id} className="ll_rowCard">
                  <div className="ll_rowTop">
                    <div className="ll_rowMain">
                      <div className="ll_rowTitleLine">
                        <input
                          type="text"
                          value={t.display_name || ""}
                          onChange={(e) => handleFieldChange(t.id, "display_name", e.target.value)}
                          className="ll_input ll_input--compact"
                          placeholder="Nombre amigable"
                        />
                        <span className="ll_monoTiny ll_mono">{t.table_name}</span>
                      </div>

                      <textarea
                        value={t.description || ""}
                        onChange={(e) => handleFieldChange(t.id, "description", e.target.value)}
                        className="ll_textarea ll_textarea--compact"
                        placeholder="Descripción / contexto para el agente…"
                        rows={2}
                      />
                    </div>

                    <div className="ll_rowActions">
                      <button
                        type="button"
                        onClick={() => handleSaveRow(t)}
                        disabled={isSaving}
                        className="ll_btn ll_btn--primary ll_btn--sm"
                      >
                        <Edit2 className="ll_i" />
                        {isSaving ? "Guardando…" : "Guardar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRow(t)}
                        disabled={isDeleting}
                        className="ll_btn ll_btn--danger ll_btn--sm"
                      >
                        <Trash2 className="ll_i" />
                        {isDeleting ? "Eliminando…" : "Eliminar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePreview(t)}
                        className="ll_btn ll_btn--ghost ll_btn--sm"
                      >
                        {isPreviewOpen ? "Ocultar preview" : "Ver preview"}
                      </button>
                    </div>
                  </div>

                  {isPreviewOpen && (
                    <div className="ll_previewPanel">
                      {isPreviewLoading && <p className="ll_muted">Cargando preview…</p>}

                      {!isPreviewLoading && rows.length === 0 && (
                        <p className="ll_muted">No se encontraron filas (o la tabla está vacía).</p>
                      )}

                      {!isPreviewLoading && rows.length > 0 && (
                        <div className="ll_tableBox ll_tableBox--small">
                          <table className="ll_table">
                            <thead>
                              <tr>
                                {Object.keys(rows[0]).map((col) => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => (
                                <tr key={idx}>
                                  {Object.entries(row).map(([col, val]) => (
                                    <td key={col}>
                                      {val === null || val === undefined ? "-" : String(val).slice(0, 50)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="ll_modalFooter">
          <button onClick={onClose} className="ll_btn ll_btn--ghost">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ================== PÁGINA PRINCIPAL =========================

export function LivingLabPage() {
  const { user } = useAuth();

  const [selectedPanel, setSelectedPanel] =
    useState<(typeof panelOptions)[number]["id"]>("camaras");

  // Labs (teams) del usuario
  const [labs, setLabs] = useState<LabTeam[]>([]);
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labMenuOpen, setLabMenuOpen] = useState(false);

  // Data sources (agent_tables) y preview
  const [agentTables, setAgentTables] = useState<AgentTable[]>([]);
  const [showAddDataModal, setShowAddDataModal] = useState(false);
  const [showManageTablesModal, setShowManageTablesModal] = useState(false);
  const [previewTableId, setPreviewTableId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<TablePreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [agentTablesVersion, setAgentTablesVersion] = useState(0);

  // Archivos reales
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [filesVersion, setFilesVersion] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar laboratorio(s) al que pertenece el usuario (via app_user.team_id)
  useEffect(() => {
    const fetchLabs = async () => {
      if (!user) return;
      setLabsLoading(true);

      const { data: appRow, error: appErr } = await supabase
        .from("app_user")
        .select("id, team_id")
        .eq("id", user.id)
        .maybeSingle();

      if (appErr) {
        console.error("Error leyendo app_user:", appErr);
        setLabsLoading(false);
        return;
      }

      if (!appRow?.team_id) {
        setLabs([]);
        setActiveLabId(null);
        setLabsLoading(false);
        return;
      }

      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("id, name, code")
        .eq("id", appRow.team_id);

      setLabsLoading(false);

      if (teamErr) {
        console.error("Error leyendo teams:", teamErr);
        return;
      }

      const labsData = (teamRows || []) as LabTeam[];
      setLabs(labsData);
      if (!activeLabId && labsData.length > 0) setActiveLabId(labsData[0].id);
    };

    fetchLabs();
  }, [user, activeLabId]);

  // Cargar agent_tables del laboratorio activo
  useEffect(() => {
    const fetchAgentTables = async () => {
      if (!activeLabId) {
        setAgentTables([]);
        return;
      }

      const { data, error } = await supabase
        .from("agent_tables")
        .select("*")
        .eq("team_id", activeLabId)
        .order("created_at", { ascending: true });

      if (!error && data) setAgentTables(data as AgentTable[]);
      else console.error("Error cargando agent_tables:", error);
    };

    fetchAgentTables();
  }, [activeLabId, showAddDataModal, agentTablesVersion]);

  // Cargar archivos reales de project_files para el lab activo
  useEffect(() => {
    const fetchFiles = async () => {
      if (!activeLabId) {
        setProjectFiles([]);
        return;
      }

      const { data, error } = await supabase
        .from("project_files")
        .select("id, project_id, uploader_id, name, storage_path, created_at")
        .eq("project_id", activeLabId)
        .order("created_at", { ascending: false });

      if (!error && data) setProjectFiles(data as ProjectFile[]);
      else console.error("Error cargando project_files:", error);
    };

    fetchFiles();
  }, [activeLabId, filesVersion]);

  const handlePreviewAgentTable = async (table: AgentTable) => {
    if (previewTableId === table.id) {
      setPreviewTableId(null);
      setPreviewRows([]);
      return;
    }

    setPreviewTableId(table.id);
    setPreviewRows([]);
    setLoadingPreview(true);

    const { data, error } = await supabase.from(table.table_name).select("*").limit(5);

    setLoadingPreview(false);

    if (!error && data) setPreviewRows(data as TablePreviewRow[]);
    else console.error("Error cargando preview de data source:", error);
  };

  const activeLab = labs.find((l) => l.id === activeLabId) || null;

  const notifyAgentTablesChanged = () => setAgentTablesVersion((v) => v + 1);

  const handleClickUpload = () => {
    if (!activeLabId) {
      alert("Primero selecciona un laboratorio activo.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user || !activeLabId) {
      alert("No hay usuario o laboratorio activo.");
      return;
    }

    setUploadingFile(true);

    try {
      const path = `${activeLabId}/${Date.now()}-${file.name}`;

      const { data, error } = await supabase.storage.from("project_files").upload(path, file);

      if (error || !data) {
        console.error("Error subiendo archivo a storage:", error);
        setUploadingFile(false);
        return;
      }

      const { error: insertErr } = await supabase.from("project_files").insert({
        project_id: activeLabId,
        uploader_id: user.id,
        name: file.name,
        storage_path: data.path,
      });

      if (insertErr) console.error("Error insertando en project_files:", insertErr);
      else setFilesVersion((v) => v + 1);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // última tabla agregada (para preview rápido)
  const lastAgentTable = agentTables.length > 0 ? agentTables[agentTables.length - 1] : null;

  const panelIndex = Math.max(
    0,
    panelOptions.findIndex((p) => p.id === selectedPanel)
  );
  const activePanelMeta = panelOptions[panelIndex];

  // ---------- helper para texto de la vista previa ----------
  const renderPreview = () => {
    switch (selectedPanel) {
      case "camaras":
        return (
          <>
            <div className="ll_cardHead">
              <h2 className="ll_h2">Cámaras del laboratorio</h2>
              <span className="ll_badge ll_badge--ok">
                <span className="ll_badgeDot" />
                Streaming RTSP
              </span>
            </div>

            <div className="ll_videoBox">
              <p className="ll_muted">Aquí se mostrará el video en vivo de la cámara seleccionada.</p>
            </div>

            <p className="ll_muted">
              Fuente actual: <span className="ll_em">Cámara Línea 1</span> – Célula de extrusión · RTSP – 192.168.10.21
            </p>
            <p className="ll_muted">Puedes cambiar la cámara o la resolución desde la configuración del dispositivo.</p>
          </>
        );

      case "alarmas":
        return (
          <>
            <div className="ll_cardHead">
              <h2 className="ll_h2">Alarmas y eventos</h2>
              <span className="ll_badge ll_badge--danger">
                <span className="ll_badgeDot" />
                Monitoreo crítico
              </span>
            </div>

            <div className="ll_alertBox">
              <p className="ll_alertTitle">Últimas alarmas (demo)</p>
              <ul className="ll_alertList">
                <li>• 12:05 – E-Stop Línea A activado (simulado)</li>
                <li>• 11:58 – Puerta de celda abierta con PLC en RUN</li>
                <li>• 11:43 – Pérdida de comunicación con PLC extrusión</li>
              </ul>
            </div>

            <p className="ll_muted">
              Aquí se listarán en tiempo real los eventos de seguridad, alarmas del PLC y cambios de estado críticos.
            </p>
          </>
        );

      case "sensores":
        return (
          <>
            <div className="ll_cardHead">
              <h2 className="ll_h2">Sensores ambientales</h2>
              <span className="ll_badge ll_badge--ok">
                <span className="ll_badgeDot" />
                Lecturas estables
              </span>
            </div>

            <div className="ll_kpiGrid">
              <div className="ll_kpi">
                <p className="ll_kpiLabel">Temperatura</p>
                <p className="ll_kpiValue">23.4 °C</p>
                <p className="ll_kpiHint">Rango objetivo 22–25 °C</p>
              </div>
              <div className="ll_kpi">
                <p className="ll_kpiLabel">CO₂</p>
                <p className="ll_kpiValue">640 ppm</p>
                <p className="ll_kpiHint">OK para trabajo en sala</p>
              </div>
              <div className="ll_kpi">
                <p className="ll_kpiLabel">Humedad</p>
                <p className="ll_kpiValue">45 %</p>
                <p className="ll_kpiHint">Controlada</p>
              </div>
            </div>

            <p className="ll_muted">En esta vista se desplegarán gráficas y tendencias en tiempo real de sensores conectados.</p>
          </>
        );

      case "trafico":
      default:
        return (
          <>
            <div className="ll_cardHead">
              <h2 className="ll_h2">Tráfico de datos</h2>
              <span className="ll_badge ll_badge--ok">
                <span className="ll_badgeDot" />
                Streaming de tags
              </span>
            </div>

            <div className="ll_summaryBox">
              <p className="ll_summaryTitle">Resumen de flujo (demo)</p>
              <div className="ll_summaryGrid">
                <div>
                  <p className="ll_kpiLabel">Tags activos</p>
                  <p className="ll_kpiValue">128</p>
                </div>
                <div>
                  <p className="ll_kpiLabel">Muestras / min</p>
                  <p className="ll_kpiValue">3,240</p>
                </div>
                <div>
                  <p className="ll_kpiLabel">Latencia media</p>
                  <p className="ll_kpiValue">120 ms</p>
                </div>
              </div>
            </div>

            <p className="ll_muted">
              Esta vista mostrará gráficas y métricas del tráfico entre PLC, SCADA y nube.
            </p>
          </>
        );
    }
  };

  return (
    <div className="ll_root">
      {/* HEADER (sin highlight azul) */}
      <div className="ll_header">
        <div className="ll_headerInner">
          <div className="ll_brand">
            <div className="ll_logo">
              <img src={labLogo} alt="Living Lab" className="ll_logoImg" />
            </div>
            <div>
              <h1 className="ll_h1">Living Lab</h1>
              <p className="ll_subtitle">Settings y conexiones físicas/digitales del laboratorio</p>
            </div>
          </div>

          <div className="ll_labPicker">
            <span className="ll_pickerLabel">Laboratorio activo</span>

            <div className="ll_dropdownWrap">
              <button
                type="button"
                onClick={() => setLabMenuOpen((v) => !v)}
                className="ll_dropdownBtn"
              >
                {activeLab ? `${activeLab.name}` : labsLoading ? "Cargando labs…" : "Sin laboratorio"}
                <span className="ll_caret">▾</span>
              </button>

              {labMenuOpen && labs.length > 0 && (
                <div className="ll_dropdownMenu">
                  {labs.map((lab) => (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => {
                        setActiveLabId(lab.id);
                        setLabMenuOpen(false);
                      }}
                      className={`ll_dropdownItem ${lab.id === activeLabId ? "isActive" : ""}`}
                    >
                      <div className="ll_dropdownItemTitle">{lab.name}</div>
                      <div className="ll_dropdownItemMeta">{lab.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="ll_main">
        {/* Scroll content (dejamos padding abajo para que no lo tape la barra) */}
        <div className="ll_scroll">
          {/* HERO / PREVIEW */}
          <section className="ll_card ll_card--hero">{renderPreview()}</section>

          {/* KPIs */}
          <section className="ll_statRow">
            <div className="ll_statCard">
              <div className="ll_statIcon">
                <HardDrive className="ll_icon" />
              </div>
              <div>
                <p className="ll_statLabel">DATA SOURCES</p>
                <p className="ll_statValue">{agentTables.length}</p>
                <p className="ll_muted">Tablas configuradas para este laboratorio.</p>
              </div>
            </div>

            <div className="ll_statCard">
              <div className="ll_statIcon">
                <Camera className="ll_icon" />
              </div>
              <div>
                <p className="ll_statLabel">CÁMARAS / VISIÓN</p>
                <p className="ll_statValue">1</p>
                <p className="ll_muted">Para inspección visual y monitoreo.</p>
              </div>
            </div>

            <div className="ll_statCard">
              <div className="ll_statIcon">
                <Bot className="ll_icon" />
              </div>
              <div>
                <p className="ll_statLabel">ROBOTS / CONTROL</p>
                <p className="ll_statValue">1</p>
                <p className="ll_muted">Integración con celdas de manufactura.</p>
              </div>
            </div>
          </section>

          {/* Dispositivos + Flujos */}
          <section className="ll_twoCol">
            <div className="ll_card">
              <div className="ll_sectionHead">
                <div>
                  <h3 className="ll_h3">Dispositivos</h3>
                  <p className="ll_muted">Cámaras, PLCs, robots y sensores.</p>
                </div>
                <button className="ll_btn ll_btn--ghost">
                  <span className="ll_plus">＋</span> Añadir
                </button>
              </div>

              <div className="ll_list">
                {mockDevices.map((d) => (
                  <div key={d.id} className="ll_listItem">
                    <div className="ll_listLeft">
                      <div className="ll_listIcon">
                        {d.type === "camera" && <Camera className="ll_icon" />}
                        {d.type === "plc" && <Activity className="ll_icon" />}
                        {d.type === "robot" && <Bot className="ll_icon" />}
                        {d.type === "sensor" && <Waves className="ll_icon" />}
                      </div>

                      <div>
                        <p className="ll_itemTitle">{d.name}</p>
                        <p className="ll_muted">{d.description}</p>
                        <button className="ll_linkBtn" type="button">
                          Cambiar estado
                        </button>
                      </div>
                    </div>

                    <span className={`ll_status ${d.status === "online" ? "isOnline" : "isOffline"}`}>
                      <span className="ll_statusDot" />
                      {d.status === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ll_card">
              <div className="ll_sectionHead">
                <div>
                  <h3 className="ll_h3">Flujos</h3>
                  <p className="ll_muted">Conecta dispositivos con FrEDIE, Qlik, Snowflake, etc.</p>
                </div>
              </div>

              <div className="ll_list">
                {mockFlows.map((flow) => (
                  <div key={flow.id} className="ll_listItem ll_listItem--stack">
                    <div className="ll_listTopRow">
                      <p className="ll_itemTitle">{flow.name}</p>
                      <span className={`ll_status ${flow.status === "activa" ? "isOnline" : "isOffline"}`}>
                        <span className="ll_statusDot" />
                        {flow.status === "activa" ? "Activa" : "Pausada"}
                      </span>
                    </div>
                    <p className="ll_muted">
                      Origen: <span className="ll_em">{flow.source}</span> → Destino:{" "}
                      <span className="ll_em">{flow.target}</span>
                    </p>
                    <p className="ll_muted">{flow.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Archivos */}
          <section className="ll_card">
            <div className="ll_sectionHead">
              <div>
                <h3 className="ll_h3">Archivos e instrucciones compartidas</h3>
                <p className="ll_muted">Documentación y configuraciones visibles para tu equipo.</p>
              </div>

              <button
                onClick={handleClickUpload}
                className="ll_btn ll_btn--ghost"
                disabled={!activeLabId || uploadingFile}
              >
                {uploadingFile ? "Subiendo…" : "Subir archivo"}
              </button>

              <input ref={fileInputRef} type="file" className="ll_hidden" onChange={handleFileChange} />
            </div>

            {projectFiles.length === 0 ? (
              <div className="ll_empty">
                Aún no hay archivos para este laboratorio. Sube el primero para compartir instrucciones, layouts o configs.
              </div>
            ) : (
              <div className="ll_tableBox">
                <table className="ll_table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Ruta</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectFiles.map((file) => (
                      <tr key={file.id}>
                        <td className="ll_tableStrong">{file.name}</td>
                        <td className="ll_mono">{file.storage_path}</td>
                        <td>{formatDate(file.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Fuentes de datos del agente */}
          <section className="ll_card">
            <div className="ll_sectionHead">
              <div>
                <h3 className="ll_h3">Fuentes de datos del agente</h3>
                <p className="ll_muted">
                  Tablas de Supabase que FrEDie puede usar como contexto estructurado
                  {activeLab ? ` para ${activeLab.name}.` : "."}
                </p>
                {agentTables.length > 1 && (
                  <p className="ll_muted ll_tiny">
                    Tienes {agentTables.length} tablas configuradas. Aquí se muestra solo la última que agregaste.
                  </p>
                )}
              </div>

              <div className="ll_btnRow">
                <button
                  onClick={() => setShowManageTablesModal(true)}
                  disabled={!activeLabId}
                  className="ll_btn ll_btn--ghost"
                >
                  Ver todas
                </button>
                <button
                  onClick={() => setShowAddDataModal(true)}
                  disabled={!activeLabId}
                  className="ll_btn ll_btn--primary"
                >
                  <span className="ll_plus">＋</span> Añadir data source
                </button>
              </div>
            </div>

            {!activeLabId && (
              <p className="ll_muted">
                No hay laboratorio activo. Asocia tu usuario a un team en Supabase (app_user.team_id).
              </p>
            )}

            {activeLabId && agentTables.length === 0 && (
              <p className="ll_muted">
                Aún no has configurado tablas como data source. Usa “Añadir data source”.
              </p>
            )}

            {activeLabId && lastAgentTable && (
              <div className="ll_rowCard">
                <div className="ll_rowTop">
                  <div className="ll_rowMain">
                    <p className="ll_itemTitle">
                      {lastAgentTable.display_name || lastAgentTable.table_name}
                    </p>
                    <p className="ll_monoTiny ll_mono">{lastAgentTable.table_name}</p>
                    {lastAgentTable.description && <p className="ll_muted">{lastAgentTable.description}</p>}
                  </div>

                  <button
                    onClick={() => handlePreviewAgentTable(lastAgentTable)}
                    className="ll_btn ll_btn--ghost ll_btn--sm"
                  >
                    {previewTableId === lastAgentTable.id ? "Ocultar preview" : "Ver preview"}
                  </button>
                </div>

                {previewTableId === lastAgentTable.id && (
                  <div className="ll_previewPanel">
                    {loadingPreview && <p className="ll_muted">Cargando preview…</p>}

                    {!loadingPreview && previewRows.length === 0 && (
                      <p className="ll_muted">No se encontraron filas (o la tabla está vacía).</p>
                    )}

                    {!loadingPreview && previewRows.length > 0 && (
                      <div className="ll_tableBox ll_tableBox--small">
                        <table className="ll_table">
                          <thead>
                            <tr>
                              {Object.keys(previewRows[0]).map((col) => (
                                <th key={col}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, idx) => (
                              <tr key={idx}>
                                {Object.entries(row).map(([col, val]) => (
                                  <td key={col}>
                                    {val === null || val === undefined ? "-" : String(val).slice(0, 50)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Bottom view switcher (reemplaza panel derecho) */}
        <div
          className="ll_switcher"
          style={
            {
              ["--ll-count" as any]: panelOptions.length,
              ["--ll-index" as any]: panelIndex,
            } as React.CSSProperties
          }
          aria-label="Cambiar vista del panel"
        >
          <div className="ll_switcherLeft">
            <p className="ll_switcherKicker">VISTA</p>
            <p className="ll_switcherTitle">{activePanelMeta.title}</p>
          </div>

          <div className="ll_switcherTrack" role="tablist" aria-label="Vistas">
            <div className="ll_switcherThumb" aria-hidden="true" />
            {panelOptions.map((opt) => {
              const isActive = opt.id === selectedPanel;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`ll_switcherDotBtn ${isActive ? "isActive" : ""}`}
                  onClick={() => setSelectedPanel(opt.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={opt.title}
                >
                  <span className="ll_switcherDot" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modales */}
      {showAddDataModal && activeLabId && (
        <AddDataModal
          teamId={activeLabId}
          existingTables={agentTables.map((t) => t.table_name)}
          onClose={() => setShowAddDataModal(false)}
          onSaved={notifyAgentTablesChanged}
        />
      )}

      {showManageTablesModal && activeLabId && (
        <ManageDataSourcesModal
          teamId={activeLabId}
          onClose={() => setShowManageTablesModal(false)}
          onChanged={notifyAgentTablesChanged}
        />
      )}
    </div>
  );
}

export default LivingLabPage;
