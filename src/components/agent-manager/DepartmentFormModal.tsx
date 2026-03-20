import { useEffect, useRef, useState } from "react";
import type { Department, WorkflowPackKey } from "../../types";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import { DEPT_BLANK, DEPT_COLORS } from "./constants";
import EmojiPicker from "./EmojiPicker";
import type { DeptForm, Translator } from "./types";

export default function DepartmentFormModal({
  locale,
  tr,
  department,
  departments,
  onSave,
  onClose,
  onSaveDepartment,
  onDeleteDepartment,
  workflowPackKey,
}: {
  locale: string;
  tr: Translator;
  department: Department | null;
  departments: Department[];
  onSave: () => void;
  onClose: () => void;
  onSaveDepartment?: (input: {
    mode: "create" | "update";
    id: string;
    payload: {
      name: string;
      name_ko: string;
      name_ja: string | null;
      name_zh: string | null;
      icon: string;
      color: string;
      description: string | null;
      prompt: string | null;
      sort_order: number;
    };
  }) => Promise<void>;
  onDeleteDepartment?: (departmentId: string) => Promise<void>;
  workflowPackKey?: WorkflowPackKey;
}) {
  const { t } = useI18n();
  const isEdit = !!department;
  const [form, setForm] = useState<DeptForm>(() => {
    if (department) {
      return {
        id: department.id,
        name: department.name,
        name_ko: department.name_ko || "",
        name_ja: department.name_ja || "",
        name_zh: department.name_zh || "",
        icon: department.icon,
        color: department.color,
        description: department.description || "",
        prompt: department.prompt || "",
      };
    }
    return { ...DEPT_BLANK };
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate next sort_order based on existing values
  const nextSortOrder = (() => {
    const orders = departments.map((d) => d.sort_order).filter((n) => typeof n === "number" && !isNaN(n));
    return Math.max(0, ...orders) + 1;
  })();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_ko: form.name_ko.trim(),
        name_ja: form.name_ja.trim() || null,
        name_zh: form.name_zh.trim() || null,
        icon: form.icon,
        color: form.color,
        description: form.description.trim() || null,
        prompt: form.prompt.trim() || null,
        sort_order: department?.sort_order ?? nextSortOrder,
      };
      if (isEdit) {
        if (onSaveDepartment) {
          await onSaveDepartment({
            mode: "update",
            id: department!.id,
            payload: { ...payload, sort_order: department!.sort_order },
          });
        } else {
          await api.updateDepartment(department!.id, {
            name: payload.name,
            name_ko: payload.name_ko,
            name_ja: payload.name_ja,
            name_zh: payload.name_zh,
            icon: payload.icon,
            color: payload.color,
            description: payload.description,
            prompt: payload.prompt,
            workflow_pack_key: workflowPackKey,
          });
        }
      } else {
        // Generate slug from name; fall back to dept-N if only non-latin characters
        const slug = form.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        let deptId = slug || `dept-${nextSortOrder}`;
        // Add numeric suffix if the generated ID conflicts with an existing one
        const existingIds = new Set(departments.map((d) => d.id));
        let suffix = 2;
        while (existingIds.has(deptId)) {
          deptId = `${slug || "dept"}-${suffix++}`;
        }
        if (onSaveDepartment) {
          await onSaveDepartment({
            mode: "create",
            id: deptId,
            payload: { ...payload, sort_order: nextSortOrder },
          });
        } else {
          await api.createDepartment({
            id: deptId,
            name: payload.name,
            name_ko: payload.name_ko,
            name_ja: payload.name_ja ?? "",
            name_zh: payload.name_zh ?? "",
            icon: payload.icon,
            color: payload.color,
            description: payload.description ?? undefined,
            prompt: payload.prompt ?? undefined,
            workflow_pack_key: workflowPackKey,
          });
        }
      }
      onSave();
      onClose();
    } catch (e: any) {
      console.error("Dept save failed:", e);
      if (api.isApiRequestError(e) && e.code === "department_id_exists") {
        alert(tr("ID.", "Department ID already exists."));
      } else if (api.isApiRequestError(e) && e.code === "sort_order_conflict") {
        alert(
          tr(
            ".    .",
            "Department sort order conflict. Please retry.",
          ),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      if (onDeleteDepartment) {
        await onDeleteDepartment(department!.id);
      } else {
        await api.deleteDepartment(department!.id, { workflowPackKey });
      }
      onSave();
      onClose();
    } catch (e: any) {
      console.error("Dept delete failed:", e);
      if (api.isApiRequestError(e) && e.code === "department_has_agents") {
        alert(tr(".", "Cannot delete: department has agents."));
      } else if (api.isApiRequestError(e) && e.code === "department_has_tasks") {
        alert(tr("(Task)    .", "Cannot delete: department has tasks."));
      } else if (api.isApiRequestError(e) && e.code === "department_protected") {
        alert(tr(".", "Cannot delete: protected system department."));
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors";
  const inputStyle = {
    background: "var(--th-input-bg)",
    borderColor: "var(--th-input-border)",
    color: "var(--th-text-primary)",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--th-modal-overlay)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
        style={{
          background: "var(--th-card-bg)",
          border: "1px solid var(--th-card-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--th-text-heading)" }}>
            <span className="text-lg">{form.icon}</span>
            {isEdit ? tr("", "Edit Department") : tr("", "Add Department")}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--th-bg-surface-hover)] transition-colors"
            style={{ color: "var(--th-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Icon + English name */}
          <div className="flex items-start gap-3">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("", "Icon")}
              </label>
              <EmojiPicker tr={tr} value={form.icon} onChange={(emoji) => setForm({ ...form, icon: emoji })} />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {tr("", "Name")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Development"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("", "Theme Color")}
            </label>
            <div className="flex gap-2">
              {DEPT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full transition-all hover:scale-110"
                  style={{
                    background: c,
                    outline: form.color === c ? `2px solid ${c}` : "2px solid transparent",
                    outlineOffset: "3px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("", "Description")}
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={tr("", "Brief description of the department")}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {tr("", "Department Prompt")}
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={4}
              placeholder={tr(
                "...",
                "Shared system prompt for agents in this department...",
              )}
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--th-text-muted)" }}>
              {tr(
                "",
                "Applied as shared system prompt when agents in this department execute tasks",
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--th-card-border)" }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white disabled:opacity-40 shadow-sm shadow-blue-600/20"
          >
            {saving
              ? tr("...", "Saving...")
              : isEdit
                ? tr("", "Save Changes")
                : tr("", "Add Department")}
          </button>
          {isEdit &&
            (confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-2.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors"
                >
                  {tr("", "Confirm")}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-2.5 rounded-lg text-xs transition-colors"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  {tr("", "No")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-red-500/15 hover:text-red-400"
                style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-muted)" }}
              >
                {tr("", "Delete")}
              </button>
            ))}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[var(--th-bg-surface-hover)]"
            style={{ border: "1px solid var(--th-input-border)", color: "var(--th-text-secondary)" }}
          >
            {tr("", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
