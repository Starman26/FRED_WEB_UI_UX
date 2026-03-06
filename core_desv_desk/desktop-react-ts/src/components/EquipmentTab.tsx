// src/components/EquipmentTab.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Box, Cpu, Activity, Move, Eye, Bot,
  FileText, Wrench, Loader2, X, Info, ChevronDown,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

// ── Types ──

export interface EquipmentProfile {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  ip_address: string | null;
  description: string | null;
  connected_robot_id: string | null;
  manuals: { id: string; title: string; pages_total: number }[];
  created_at: string;
}

export const EQUIPMENT_TYPES = [
  { value: "cobot", label: "Cobot / Robot Arm" },
  { value: "plc", label: "PLC / Controller" },
  { value: "sensor", label: "Sensor" },
  { value: "conveyor", label: "Conveyor / Actuator" },
  { value: "camera", label: "Camera / Vision" },
  { value: "generic", label: "Other Equipment" },
] as const;

// ── Icon helper ──

export const equipmentTypeIcon = (type: string, size = 18) => {
  const props = { size, strokeWidth: 1.5 };
  switch (type) {
    case "cobot":    return <Bot {...props} />;
    case "plc":      return <Cpu {...props} />;
    case "sensor":   return <Activity {...props} />;
    case "conveyor": return <Move {...props} />;
    case "camera":   return <Eye {...props} />;
    default:         return <Box {...props} />;
  }
};

// ── Props ──

interface EquipmentTabProps {
  userId: string;
  teamId: string;
  onStartTroubleshoot: (equipment: EquipmentProfile) => void;
}

export default function EquipmentTab({ userId, teamId, onStartTroubleshoot }: EquipmentTabProps) {
  const [equipment, setEquipment] = useState<EquipmentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [troubleshootPopup, setTroubleshootPopup] = useState<EquipmentProfile | null>(null);

  const fetchEquipment = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .schema("lab")
        .from("equipment_profiles")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: EquipmentProfile[] = [];
      for (const item of data || []) {
        // Fetch linked document IDs from junction table
        const { data: links } = await supabase
          .schema("lab")
          .from("equipment_documents")
          .select("document_id")
          .eq("equipment_id", item.id);

        const docIds = (links || []).map((l: { document_id: string }) => l.document_id);
        let manuals: { id: string; title: string; pages_total: number }[] = [];

        if (docIds.length > 0) {
          const { data: docs } = await supabase
            .from("documents")
            .select("id, title, pages_total")
            .in("id", docIds);
          manuals = (docs || []).map((d: { id: string; title: string; pages_total: number }) => ({
            id: d.id,
            title: d.title,
            pages_total: d.pages_total,
          }));
        }

        enriched.push({ ...item, manuals });
      }

      setEquipment(enriched);
    } catch (err) {
      console.error("[Equipment] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const handleCreate = async (form: Record<string, any>) => {
    try {
      const { document_ids, ...profileFields } = form;
      const { data: inserted, error } = await supabase
        .schema("lab")
        .from("equipment_profiles")
        .insert({
          ...profileFields,
          created_by: userId,
          team_id: teamId,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Insert document links
      const ids = document_ids as string[] | undefined;
      if (ids && ids.length > 0 && inserted) {
        const links = ids.map((docId: string) => ({
          equipment_id: inserted.id,
          document_id: docId,
        }));
        const { error: linkError } = await supabase
          .schema("lab")
          .from("equipment_documents")
          .insert(links);
        if (linkError) console.error("[Equipment] link error:", linkError);
      }

      setShowCreateModal(false);
      fetchEquipment();
    } catch (err) {
      console.error("[Equipment] create error:", err);
    }
  };

  if (loading) {
    return (
      <div className="studio__equipmentLoading">
        <Loader2 size={24} className="animate-spin" />
        <span>Loading equipment...</span>
      </div>
    );
  }

  return (
    <div className="studio__equipmentTab">
      {/* Header */}
      <div className="studio__equipmentHeader">
        <h3 className="studio__equipmentTitle">Equipment Profiles</h3>
        <button
          type="button"
          className="studio__equipmentAddBtn"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={14} />
          Add Equipment
        </button>
      </div>

      {/* Empty state */}
      {equipment.length === 0 && (
        <div className="studio__equipmentEmpty">
          <Box size={40} strokeWidth={1} style={{ color: "#9ca3af" }} />
          <p className="studio__equipmentEmptyTitle">No equipment profiles yet</p>
          <p className="studio__equipmentEmptyDesc">
            Add your lab equipment to enable AI-powered troubleshooting with manual-based diagnostics.
          </p>
          <button
            type="button"
            className="studio__equipmentAddBtn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} />
            Add your first equipment
          </button>
        </div>
      )}

      {/* Equipment grid */}
      {equipment.length > 0 && (
        <div className="studio__equipmentGrid">
          {equipment.map((eq) => (
            <div key={eq.id} className="studio__equipmentCard">
              <div className="studio__equipmentCardIcon">
                {equipmentTypeIcon(eq.type)}
              </div>
              <div className="studio__equipmentCardInfo">
                <span className="studio__equipmentCardName">{eq.name}</span>
                <span className="studio__equipmentCardMeta">
                  {[eq.brand, eq.model].filter(Boolean).join(" ") || eq.type}
                </span>
              </div>
              <div className="studio__equipmentCardBadges">
                {eq.connected_robot_id && (
                  <span className="studio__equipmentBadge studio__equipmentBadge--connected">
                    Connected
                  </span>
                )}
                {eq.manuals.length > 0 && (
                  <span className="studio__equipmentBadge studio__equipmentBadge--docs">
                    <FileText size={10} />
                    {eq.manuals.length} {eq.manuals.length === 1 ? "manual" : "manuals"}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="studio__equipmentInfoBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  setTroubleshootPopup(eq);
                }}
                aria-label={`Troubleshoot ${eq.name}`}
              >
                <Info size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Troubleshoot popup */}
      {troubleshootPopup && (
        <div className="studio__equipmentPopupOverlay" onClick={() => setTroubleshootPopup(null)}>
          <div className="studio__equipmentPopupCard" onClick={(e) => e.stopPropagation()}>
            <div className="studio__equipmentPopupIcon">
              {equipmentTypeIcon(troubleshootPopup.type, 28)}
            </div>
            <h4 className="studio__equipmentPopupTitle">
              Having troubles with {troubleshootPopup.name}?
            </h4>
            <p className="studio__equipmentPopupDesc">
              The AI agent will diagnose the issue step by step
              {troubleshootPopup.manuals.length > 0
                ? `, using manuals: ${troubleshootPopup.manuals.map((m) => m.title).join(", ")} as reference.`
                : ". Link a manual for better diagnostics."}
            </p>
            <div className="studio__equipmentPopupActions">
              <button
                type="button"
                className="studio__equipmentPopupPrimary"
                onClick={() => {
                  setTroubleshootPopup(null);
                  onStartTroubleshoot(troubleshootPopup);
                }}
              >
                <Wrench size={14} />
                Do Troubleshooting
              </button>
              <button
                type="button"
                className="studio__equipmentPopupSecondary"
                onClick={() => setTroubleshootPopup(null)}
              >
                No, thanks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateEquipmentModal
          onSubmit={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════
// Custom Select Dropdown
// ═══════════════════════════════════

interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
}: {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="studio__customSelect" ref={ref}>
      <button
        type="button"
        className={`studio__customSelectBtn ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className="studio__customSelectValue">
          {selected?.icon && <span className="studio__customSelectIcon">{selected.icon}</span>}
          <span className="studio__customSelectLabel">
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown size={14} className={`studio__customSelectChevron ${open ? "is-open" : ""}`} />
      </button>

      {open && (
        <div className="studio__customSelectDropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`studio__customSelectOption ${opt.value === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.icon && <span className="studio__customSelectIcon">{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════
// Multi-Select Checkbox Dropdown
// ═══════════════════════════════════

interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

function MultiSelectCheckbox({
  options,
  values,
  onChange,
  placeholder = "Select...",
}: {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);

  return (
    <div className="studio__customSelect" ref={ref}>
      <button
        type="button"
        className={`studio__customSelectBtn ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className="studio__customSelectValue">
          <span className="studio__customSelectLabel">
            {selectedLabels.length > 0
              ? `${selectedLabels.length} manual${selectedLabels.length > 1 ? "s" : ""} selected`
              : placeholder}
          </span>
        </span>
        <ChevronDown size={14} className={`studio__customSelectChevron ${open ? "is-open" : ""}`} />
      </button>

      {open && (
        <div className="studio__customSelectDropdown">
          {options.length === 0 && (
            <div className="studio__multiSelectEmpty">No manuals available</div>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`studio__multiSelectRow ${values.includes(opt.value) ? "is-checked" : ""}`}
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="studio__multiSelectCheckbox"
              />
              {opt.icon && <span className="studio__customSelectIcon">{opt.icon}</span>}
              <span className="studio__multiSelectLabel">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════
// Create Equipment Modal
// ═══════════════════════════════════

function CreateEquipmentModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (form: Record<string, any>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "generic",
    brand: "",
    model: "",
    ip_address: "",
    description: "",
    connected_robot_id: "",
    document_ids: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [manuals, setManuals] = useState<{ id: string; title: string; pages_total: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("documents")
          .select("id, title, pages_total")
          .eq("doc_type", "manual")
          .eq("status", "ready")
          .order("created_at", { ascending: false });
        setManuals(data || []);
      } catch (err) {
        console.error("[Equipment] manuals error:", err);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    const payload: Record<string, any> = { name: form.name, type: form.type };
    if (form.brand) payload.brand = form.brand;
    if (form.model) payload.model = form.model;
    if (form.ip_address) payload.ip_address = form.ip_address;
    if (form.description) payload.description = form.description;
    if (form.connected_robot_id) payload.connected_robot_id = form.connected_robot_id;
    if (form.document_ids.length > 0) payload.document_ids = form.document_ids;
    await onSubmit(payload);
    setSubmitting(false);
  };

  return (
    <div className="studio__modalOverlay" onClick={onClose}>
      <div className="studio__modalCard studio__modalCard--wide" onClick={(e) => e.stopPropagation()}>
        <div className="studio__modalHeader">
          <h2>Add Equipment</h2>
          <button type="button" className="studio__modalClose" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="studio__modalBody">
          <div className="studio__modalField">
            <label>Name *</label>
            <input
              type="text"
              placeholder="e.g. xArm6 Lab Principal"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="studio__modalFormRow">
            <div className="studio__modalField">
              <label>Type</label>
              <CustomSelect
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={EQUIPMENT_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                  icon: equipmentTypeIcon(t.value, 14),
                }))}
              />
            </div>
            <div className="studio__modalField">
              <label>Manuals (for AI troubleshooting)</label>
              <MultiSelectCheckbox
                values={form.document_ids}
                onChange={(ids) => setForm({ ...form, document_ids: ids })}
                placeholder="No manuals selected"
                options={manuals.map((m) => ({
                  value: m.id,
                  label: `${m.title} (${m.pages_total} pages)`,
                  icon: <FileText size={14} strokeWidth={1.5} />,
                }))}
              />
            </div>
          </div>

          <div className="studio__modalFormRow">
            <div className="studio__modalField">
              <label>Brand</label>
              <input type="text" placeholder="e.g. UFactory"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="studio__modalField">
              <label>Model</label>
              <input type="text" placeholder="e.g. xArm6"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>

          {form.type === "cobot" ? (
            <div className="studio__modalFormRow">
              <div className="studio__modalField">
                <label>IP Address</label>
                <input type="text" placeholder="e.g. 192.168.1.100"
                  value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
              </div>
              <div className="studio__modalField">
                <label>Connected Robot ID</label>
                <input type="text" placeholder="e.g. xarm-200 (from bridge)"
                  value={form.connected_robot_id} onChange={(e) => setForm({ ...form, connected_robot_id: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="studio__modalField">
              <label>IP Address</label>
              <input type="text" placeholder="e.g. 192.168.1.100"
                value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
            </div>
          )}

          <div className="studio__modalField">
            <label>Description</label>
            <textarea placeholder="Notes about this equipment..." rows={3}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <div className="studio__modalFooter">
          <button type="button" className="studio__modalCancel" onClick={onClose}>Cancel</button>
          <button type="button" className="studio__modalSubmit"
            onClick={handleSubmit} disabled={!form.name.trim() || submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Equipment
          </button>
        </div>
      </div>
    </div>
  );
}
