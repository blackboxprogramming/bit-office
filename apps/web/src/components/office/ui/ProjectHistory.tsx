"use client";
import { useEffect, useState } from "react";
import { useOfficeStore, type ProjectSummary } from "@/store/office-store";
import { sendCommand } from "@/lib/connection";
import type { GatewayEvent } from "@office/shared";

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(start: number, end: number) {
  const ms = end - start;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Replay PROJECT_DATA events into a readable chat log */
function ProjectViewer({ events, name, preview, onBack, onPreview }: {
  events: GatewayEvent[];
  name: string;
  preview?: ProjectSummary["preview"];
  onBack: () => void;
  onPreview?: (preview: NonNullable<ProjectSummary["preview"]>) => void;
}) {
  // Extract meaningful messages from events
  const messages: { id: string; agent: string; text: string; timestamp: number; type: string }[] = [];

  for (const event of events) {
    switch (event.type) {
      case "TEAM_CHAT":
        messages.push({
          id: `tc-${event.timestamp}-${event.fromAgentId}`,
          agent: event.fromAgentId,
          text: event.message,
          timestamp: event.timestamp,
          type: event.messageType,
        });
        break;
      case "TASK_DONE":
        if (event.result?.summary) {
          messages.push({
            id: `done-${event.taskId}`,
            agent: event.agentId,
            text: event.result.summary,
            timestamp: (event as Record<string, unknown>).timestamp as number ?? 0,
            type: "result",
          });
        }
        break;
      case "TASK_DELEGATED":
        messages.push({
          id: `del-${event.taskId}`,
          agent: event.fromAgentId,
          text: `Delegated to ${event.toAgentId}: ${event.prompt.slice(0, 200)}`,
          timestamp: (event as Record<string, unknown>).timestamp as number ?? 0,
          type: "delegation",
        });
        break;
      case "TEAM_PHASE":
        messages.push({
          id: `phase-${event.teamId}-${event.phase}`,
          agent: event.leadAgentId,
          text: `Phase: ${event.phase}`,
          timestamp: (event as Record<string, unknown>).timestamp as number ?? 0,
          type: "status",
        });
        break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #3d2e54",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "1px solid #3d2e54", color: "#9a8a68",
            padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
          }}
        >
          &lt; Back
        </button>
        <span style={{ color: "#eddcb8", fontSize: 13, fontWeight: 700, flex: 1 }}>{name}</span>
        {preview && onPreview && (
          <button
            onClick={() => onPreview(preview)}
            style={{
              background: "rgba(90, 172, 255, 0.15)", border: "1px solid #5aacff60",
              color: "#5aacff", padding: "4px 12px", cursor: "pointer",
              fontSize: 11, fontFamily: "monospace", borderRadius: 0,
            }}
          >
            Preview
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ color: "#5a4a38", fontSize: 12, textAlign: "center", padding: 40 }}>
            No messages in this project
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{
                color: msg.type === "delegation" ? "#5aacff" : msg.type === "status" ? "#9a8a68" : "#48cc6a",
                fontSize: 11, fontWeight: 700, fontFamily: "monospace",
              }}>
                {msg.agent.replace(/^agent-/, "").slice(0, 8)}
              </span>
              <span style={{ color: "#5a4a38", fontSize: 10 }}>
                {msg.type}
              </span>
            </div>
            <div style={{
              color: "#c8b898", fontSize: 12, lineHeight: 1.6,
              fontFamily: "monospace", marginTop: 2,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.text.slice(0, 1000)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectHistory({ isOpen, onClose, onPreview }: {
  isOpen: boolean;
  onClose: () => void;
  onPreview?: (preview: NonNullable<ProjectSummary["preview"]>) => void;
}) {
  const { projectList, viewingProjectId, viewingProjectEvents, viewingProjectName, clearViewingProject } = useOfficeStore();
  const [loaded, setLoaded] = useState(false);

  // Find the preview info for the currently viewed project
  const viewingProject = viewingProjectId ? projectList.find(p => p.id === viewingProjectId) : null;

  useEffect(() => {
    if (isOpen && !loaded) {
      sendCommand({ type: "LIST_PROJECTS" });
      setLoaded(true);
    }
    if (!isOpen) {
      setLoaded(false);
      clearViewingProject();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handlePreview = (preview: NonNullable<ProjectSummary["preview"]>) => {
    // Send SERVE_PREVIEW to gateway, then close modal and open preview overlay
    if (preview.entryFile && preview.projectDir) {
      const fullPath = preview.projectDir + "/" + preview.entryFile;
      sendCommand({ type: "SERVE_PREVIEW", filePath: fullPath });
    } else if (preview.previewCmd) {
      sendCommand({
        type: "SERVE_PREVIEW",
        previewCmd: preview.previewCmd,
        previewPort: preview.previewPort,
        cwd: preview.projectDir,
      });
    }
    onPreview?.(preview);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1e1a30", border: "1px solid #3d2e54",
          width: "90%", maxWidth: 600, height: "70vh",
          display: "flex", flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid #3d2e54",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span className="px-font" style={{ color: "#e8b040", fontSize: 13, letterSpacing: "0.05em" }}>
            Project History
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#5a4a38",
              fontSize: 18, cursor: "pointer", lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {viewingProjectId && viewingProjectEvents.length > 0 ? (
            <ProjectViewer
              events={viewingProjectEvents}
              name={viewingProjectName ?? "Project"}
              preview={viewingProject?.preview}
              onBack={clearViewingProject}
              onPreview={handlePreview}
            />
          ) : (
            <div style={{ padding: "12px 0" }}>
              {projectList.length === 0 ? (
                <div style={{ color: "#5a4a38", fontSize: 12, textAlign: "center", padding: 40, fontFamily: "monospace" }}>
                  No archived projects yet.
                  <br />
                  Projects are saved when you click End Project.
                </div>
              ) : (
                projectList.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: "1px solid #2a2240",
                      fontFamily: "monospace",
                    }}
                  >
                    <button
                      onClick={() => sendCommand({ type: "LOAD_PROJECT", projectId: p.id })}
                      style={{
                        flex: 1, textAlign: "left",
                        backgroundColor: "transparent",
                        border: "none", cursor: "pointer", color: "#c8b898",
                        fontFamily: "monospace", padding: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.parentElement!.style.backgroundColor = "#2a2240"; }}
                      onMouseLeave={(e) => { e.currentTarget.parentElement!.style.backgroundColor = "transparent"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#eddcb8" }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, color: "#5a4a38" }}>
                          {formatDuration(p.startedAt, p.endedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#7a6858", marginTop: 4 }}>
                        {formatDate(p.startedAt)} &middot; {p.agentNames.join(", ")} &middot; {p.eventCount} events
                      </div>
                    </button>
                    {p.preview && (p.preview.entryFile || p.preview.previewCmd) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreview(p.preview!); }}
                        style={{
                          background: "rgba(90, 172, 255, 0.12)", border: "1px solid #5aacff40",
                          color: "#5aacff", padding: "6px 12px", cursor: "pointer",
                          fontSize: 10, fontFamily: "monospace", borderRadius: 0,
                          marginLeft: 10, whiteSpace: "nowrap", flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(90, 172, 255, 0.25)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(90, 172, 255, 0.12)"; }}
                        title={p.preview.entryFile ?? p.preview.previewCmd}
                      >
                        Preview
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
