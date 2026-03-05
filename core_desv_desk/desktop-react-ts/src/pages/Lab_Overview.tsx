// src/pages/LivingLabPage.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Pencil,
  Table2,
  FileUp,
  FileText,
  FolderPlus,
  Trash2,
  X,
  Database,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/livinglab.css";

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

// ============================================================================
// TYPES
// ============================================================================

interface TeamMember {
  fullName: string;
  role: string;
}

interface SelectedTable {
  schema: string;
  tableName: string;
  displayName: string;
}

type PreviewRow = Record<string, unknown>;

interface TablePreviewData {
  rows: PreviewRow[];
  columns: string[];
  totalRows: number;
  loading: boolean;
}

// Available schemas / tables for the Add Tables modal
const AVAILABLE_SCHEMAS: { value: string; label: string }[] = [
  { value: "public", label: "public" },
  { value: "chat", label: "chat" },
  { value: "lab", label: "lab" },
];

// ============================================================================
// GOOGLE DRIVE ICON
// ============================================================================

function GoogleIcon() {
  return (
    <svg className="ll_googleIcon" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ============================================================================
// CHANGE DESCRIPTION MODAL
// ============================================================================

interface DescriptionModalProps {
  currentDescription: string;
  onSave: (desc: string) => void;
  onClose: () => void;
  saving: boolean;
}

function ChangeDescriptionModal({ currentDescription, onSave, onClose, saving }: DescriptionModalProps) {
  const [text, setText] = useState(currentDescription);

  return (
    <div className="ll_modalOverlay" onClick={onClose}>
      <div className="ll_modal" onClick={(e) => e.stopPropagation()}>
        <div className="ll_modalHeader">
          <h2 className="ll_modalTitle">Change Team Description</h2>
          <button type="button" className="ll_modalClose" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="ll_modalContent">
          <textarea
            className="ll_modalTextarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your team..."
            rows={5}
          />
        </div>
        <div className="ll_modalFooter">
          <button type="button" className="ll_btnSecondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ll_btnPrimary"
            onClick={() => onSave(text)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADD TABLES MODAL
// ============================================================================

interface AddTablesModalProps {
  onAdd: (schema: string, tableName: string) => void;
  onClose: () => void;
  existingTables: string[];
}

function AddTablesModal({ onAdd, onClose, existingTables }: AddTablesModalProps) {
  const [selectedSchema, setSelectedSchema] = useState("public");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load tables for selected schema
  useEffect(() => {
    const loadTables = async () => {
      setLoadingTables(true);
      setSelectedTable("");
      setPreviewRows([]);

      try {
        if (selectedSchema === "public") {
          const { data, error } = await supabase.rpc("list_public_tables");
          if (!error && data) {
            setTables((data as { table_name: string }[]).map((t) => t.table_name));
          }
        } else {
          // For other schemas, use known table names
          const knownTables: Record<string, string[]> = {
            chat: ["sessions", "messages"],
            lab: ["stations", "equipment", "equipment_status"],
          };
          setTables(knownTables[selectedSchema] || []);
        }
      } catch (err) {
        console.error("Error loading tables:", err);
      } finally {
        setLoadingTables(false);
      }
    };
    loadTables();
  }, [selectedSchema]);

  // Load preview when table is selected
  useEffect(() => {
    if (!selectedTable) {
      setPreviewRows([]);
      return;
    }

    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const query = selectedSchema === "public"
          ? supabase.from(selectedTable).select("*").limit(5)
          : supabase.schema(selectedSchema).from(selectedTable).select("*").limit(5);

        const { data, error } = await query;
        if (!error && data) setPreviewRows(data as PreviewRow[]);
      } catch (err) {
        console.error("Error loading preview:", err);
      } finally {
        setLoadingPreview(false);
      }
    };
    loadPreview();
  }, [selectedSchema, selectedTable]);

  const displayName = selectedSchema === "public"
    ? selectedTable
    : `${selectedSchema}.${selectedTable}`;

  const isAlreadyAdded = existingTables.includes(
    selectedSchema === "public" ? selectedTable : `${selectedSchema}_${selectedTable}`
  );

  return (
    <div className="ll_modalOverlay" onClick={onClose}>
      <div className="ll_modal ll_modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="ll_modalHeader">
          <h2 className="ll_modalTitle">Add Table</h2>
          <button type="button" className="ll_modalClose" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ll_modalContent">
          <div className="ll_formGroup">
            <label className="ll_label">Schema</label>
            <select
              className="ll_select"
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
            >
              {AVAILABLE_SCHEMAS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="ll_formGroup">
            <label className="ll_label">Table</label>
            <select
              className="ll_select"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              disabled={loadingTables}
            >
              <option value="">{loadingTables ? "Loading tables..." : "Select a table..."}</option>
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {selectedTable && (
            <div className="ll_previewSection">
              <label className="ll_label">Preview — {displayName}</label>
              <div className="ll_tablePreviewBox">
                {loadingPreview ? (
                  <p className="ll_muted" style={{ padding: 16 }}>Loading preview...</p>
                ) : previewRows.length === 0 ? (
                  <p className="ll_muted" style={{ padding: 16 }}>No rows found.</p>
                ) : (
                  <table className="ll_miniTable">
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
                              {val === null || val === undefined ? "—" : String(val).slice(0, 60)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ll_modalFooter">
          <button type="button" className="ll_btnSecondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ll_btnPrimary"
            onClick={() => { onAdd(selectedSchema, selectedTable); onClose(); }}
            disabled={!selectedTable || isAlreadyAdded}
          >
            {isAlreadyAdded ? "Already added" : "Add Table"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABLE PREVIEW CARD (dark card)
// ============================================================================

interface TableCardProps {
  table: SelectedTable;
  preview: TablePreviewData;
  onRemove: () => void;
}

function TableCard({ table, preview, onRemove }: TableCardProps) {
  return (
    <div className="ll_tableCard">
      <div className="ll_tableCardHeader">
        <div className="ll_tableCardTitle">
          <Table2 size={14} />
          <span>{table.displayName}</span>
        </div>
        <button type="button" className="ll_tableCardRemove" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="ll_tableCardBody">
        {preview.loading ? (
          <div className="ll_tableCardLoading">Loading...</div>
        ) : preview.columns.length === 0 ? (
          <div className="ll_tableCardEmpty">No data</div>
        ) : (
          <div className="ll_tableCardScroll">
            <table className="ll_previewTable">
              <thead>
                <tr>
                  {preview.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, idx) => (
                  <tr key={idx}>
                    {preview.columns.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col}>
                          {val === null || val === undefined ? "—" : String(val).slice(0, 60)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ll_tableCardFooter">
        <span className="ll_tableCardMeta">
          {preview.totalRows} rows &middot; {preview.columns.length} columns
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function LivingLabPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Sidebar toggle (same pattern as Dashboard)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });

  // User profile data
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);

  // Team description
  const [teamDescription, setTeamDescription] = useState("");
  const [descLoading, setDescLoading] = useState(true);

  // Team members
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // Modals
  const [showDescModal, setShowDescModal] = useState(false);
  const [descSaving, setDescSaving] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);

  // Knowledge base tables
  const [selectedTables, setSelectedTables] = useState<SelectedTable[]>([]);
  const [tablePreviews, setTablePreviews] = useState<Record<string, TablePreviewData>>({});

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sidebar toggle ──
  useEffect(() => {
    if (sidebarCollapsed) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
    else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch {}
      if (next) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
      else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
      window.dispatchEvent(new CustomEvent("cora:sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  }, []);

  // ── Load user profile + team data ──
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, active_team_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) return;

      const parts = (profile.full_name || "").trim().split(/\s+/);
      setUserName(parts[0] || user.email?.split("@")[0] || "User");
      setTeamId(profile.active_team_id);

      if (profile.active_team_id) {
        const { data: membership } = await supabase
          .from("team_memberships")
          .select("role")
          .eq("auth_user_id", user.id)
          .eq("team_id", profile.active_team_id)
          .maybeSingle();

        if (membership?.role) setUserRole(membership.role);
      }
    };
    loadProfile();
  }, [user]);

  // ── Load team description ──
  useEffect(() => {
    if (!teamId) {
      setDescLoading(false);
      return;
    }

    const loadDescription = async () => {
      setDescLoading(true);
      const { data } = await supabase
        .from("teams")
        .select("description")
        .eq("id", teamId)
        .maybeSingle();

      setTeamDescription(data?.description || "");
      setDescLoading(false);
    };
    loadDescription();
  }, [teamId]);

  // ── Load team members ──
  useEffect(() => {
    if (!teamId) {
      setMembersLoading(false);
      return;
    }

    const loadMembers = async () => {
      setMembersLoading(true);

      const { data, error } = await supabase
        .from("team_memberships")
        .select("role, auth_user_id")
        .eq("team_id", teamId);

      if (error || !data || data.length === 0) {
        setMembers([]);
        setMembersLoading(false);
        return;
      }

      const userIds = data.map((m: any) => m.auth_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("auth_user_id, full_name")
        .in("auth_user_id", userIds);

      const nameMap: Record<string, string> = {};
      for (const p of profiles || []) {
        nameMap[p.auth_user_id] = p.full_name || "";
      }

      const result: TeamMember[] = data.map((m: any) => ({
        fullName: nameMap[m.auth_user_id] || "Unknown",
        role: m.role || "member",
      }));

      setMembers(result);
      setMembersLoading(false);
    };
    loadMembers();
  }, [teamId]);

  // ── Save description ──
  const handleSaveDescription = async (newDesc: string) => {
    if (!teamId) return;
    setDescSaving(true);

    const { error } = await supabase
      .from("teams")
      .update({ description: newDesc })
      .eq("id", teamId);

    if (!error) setTeamDescription(newDesc);
    setDescSaving(false);
    setShowDescModal(false);
  };

  // ── Add table to knowledge base ──
  const handleAddTable = async (schema: string, tableName: string) => {
    const key = schema === "public" ? tableName : `${schema}_${tableName}`;
    const displayName = schema === "public" ? tableName : `${schema}.${tableName}`;

    const newTable: SelectedTable = { schema, tableName, displayName };
    setSelectedTables((prev) => [...prev, newTable]);

    // Load preview data
    setTablePreviews((prev) => ({
      ...prev,
      [key]: { rows: [], columns: [], totalRows: 0, loading: true },
    }));

    try {
      const query = schema === "public"
        ? supabase.from(tableName).select("*").limit(10)
        : supabase.schema(schema).from(tableName).select("*").limit(10);

      const { data, error, count } = await query;

      if (!error && data && data.length > 0) {
        const columns = Object.keys(data[0]);
        setTablePreviews((prev) => ({
          ...prev,
          [key]: {
            rows: data as PreviewRow[],
            columns,
            totalRows: count || data.length,
            loading: false,
          },
        }));
      } else {
        setTablePreviews((prev) => ({
          ...prev,
          [key]: { rows: [], columns: [], totalRows: 0, loading: false },
        }));
      }
    } catch {
      setTablePreviews((prev) => ({
        ...prev,
        [key]: { rows: [], columns: [], totalRows: 0, loading: false },
      }));
    }
  };

  // ── Remove table from knowledge base ──
  const handleRemoveTable = (index: number) => {
    const table = selectedTables[index];
    const key = table.schema === "public" ? table.tableName : `${table.schema}_${table.tableName}`;

    setSelectedTables((prev) => prev.filter((_, i) => i !== index));
    setTablePreviews((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // ── File upload ──
  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log("Files selected:", Array.from(files).map((f) => f.name));
      // TODO: Upload to Supabase storage
    }
    e.target.value = "";
  };

  // ── Grid class for tables ──
  const gridClass = selectedTables.length <= 1
    ? "ll_tablesGrid ll_tablesGrid--1"
    : selectedTables.length === 2
      ? "ll_tablesGrid ll_tablesGrid--2"
      : "ll_tablesGrid ll_tablesGrid--3";

  const existingTableKeys = selectedTables.map((t) =>
    t.schema === "public" ? t.tableName : `${t.schema}_${t.tableName}`
  );

  return (
    <div className="dash_root">
      {/* Header — same structure as Dashboard */}
      <header className="dash_header">
        <div className="dash_headerLeft">
          <button
            type="button"
            onClick={toggleSidebar}
            className="dash_menuBtn"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={18} />
          </button>

          <div className="dash_headerDivider" />

          <div className="dash_userInfo">
            <span className="dash_pageName">Living Lab</span>
            <span className="dash_pathSeparator">/</span>
            <span className="dash_userName">{userName || "User"}</span>
            {userRole && (
              <>
                <span className="dash_userSeparator">/</span>
                <span className="dash_userRole">{userRole}</span>
              </>
            )}
          </div>
        </div>

        <div className="dash_headerRight">
          <button type="button" className="dash_headerBtn">Feedback</button>
          <button type="button" className="dash_headerBtn" onClick={() => navigate("/notebook")}>Notebook</button>
        </div>
      </header>

      {/* Content */}
      <div className="ll_content">
        {/* Top Row — Team Description + Members + Output Connection */}
        <div className="ll_topRow">
          {/* Team Description */}
          <div className="ll_description">
            <h2 className="ll_sectionTitle">Team Description</h2>
            {descLoading ? (
              <>
                <div className="ll_skeleton ll_skeleton--mb8" style={{ width: "100%", height: 14 }} />
                <div className="ll_skeleton ll_skeleton--mb8" style={{ width: "80%", height: 14 }} />
                <div className="ll_skeleton" style={{ width: "60%", height: 14 }} />
              </>
            ) : (
              <p className="ll_descriptionText">
                {teamDescription || "No description set. Click below to add one."}
              </p>
            )}
            <button
              type="button"
              className="ll_btnPrimary"
              onClick={() => setShowDescModal(true)}
              disabled={!teamId}
            >
              <Pencil size={14} />
              Change Description
            </button>
          </div>

          {/* Team Members */}
          <div className="ll_members">
            <h2 className="ll_sectionTitle">Team Members</h2>
            <div className="ll_membersList">
              {membersLoading ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="ll_memberRow ll_memberRow--skeleton">
                      <div className="ll_skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                      <div className="ll_memberInfo">
                        <div className="ll_skeleton" style={{ width: 80, height: 14 }} />
                        <div className="ll_skeleton" style={{ width: 50, height: 11 }} />
                      </div>
                    </div>
                  ))}
                </>
              ) : members.length === 0 ? (
                <p className="ll_muted">No members found.</p>
              ) : (
                members.map((member, idx) => (
                  <div key={idx} className="ll_memberRow">
                    <div className="ll_memberAvatar">
                      <span>{member.fullName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="ll_memberInfo">
                      <span className="ll_memberName">{member.fullName}</span>
                      <span className="ll_memberRole">{member.role}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Personal Output Connection */}
          <div className="ll_outputConnection">
            <h2 className="ll_sectionTitle">Personal Output Connection</h2>
            <div className="ll_connectionBox">
              <span className="ll_connectionStatus">Connect to Google Drive</span>
              <button type="button" className="ll_btnGoogle">
                <GoogleIcon />
                <span>Connect Google Drive</span>
              </button>
            </div>
          </div>
        </div>

        {/* Knowledge Base */}
        <div className="ll_knowledge">
          <h2 className="ll_sectionTitle">Knowledge Base</h2>

          <div className="ll_knowledgeActions">
            <button
              type="button"
              className="ll_actionBtn"
              onClick={() => setShowAddTableModal(true)}
              disabled={!teamId}
            >
              <Table2 size={16} />
              Add Tables
            </button>
            <button
              type="button"
              className="ll_actionBtn"
              onClick={handleFileClick}
              disabled={!teamId}
            >
              <FileUp size={16} />
              Add Files
            </button>
            <button type="button" className="ll_actionBtn" disabled={!teamId}>
              <FileText size={16} />
              Create Text
            </button>
            <button type="button" className="ll_actionBtn" disabled={!teamId}>
              <FolderPlus size={16} />
              Create Folder
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div className="ll_knowledgeContent">
            {selectedTables.length === 0 ? (
              <div className="ll_emptyState">
                <div className="ll_emptyIcon">
                  <Database size={48} strokeWidth={1} />
                </div>
                <p className="ll_emptyTitle">No tables added yet</p>
                <p className="ll_emptyText">
                  Add tables from your Supabase database to use as knowledge for the agent.
                </p>
              </div>
            ) : (
              <div className={gridClass}>
                {selectedTables.map((table, idx) => {
                  const key = table.schema === "public"
                    ? table.tableName
                    : `${table.schema}_${table.tableName}`;
                  const preview = tablePreviews[key] || {
                    rows: [],
                    columns: [],
                    totalRows: 0,
                    loading: true,
                  };
                  return (
                    <TableCard
                      key={key}
                      table={table}
                      preview={preview}
                      onRemove={() => handleRemoveTable(idx)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDescModal && (
        <ChangeDescriptionModal
          currentDescription={teamDescription}
          onSave={handleSaveDescription}
          onClose={() => setShowDescModal(false)}
          saving={descSaving}
        />
      )}

      {showAddTableModal && (
        <AddTablesModal
          onAdd={handleAddTable}
          onClose={() => setShowAddTableModal(false)}
          existingTables={existingTableKeys}
        />
      )}
    </div>
  );
}

export default LivingLabPage;
