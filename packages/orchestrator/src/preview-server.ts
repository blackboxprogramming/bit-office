import { spawn, type ChildProcess } from "child_process";
import path from "path";

const STATIC_PORT = 9100;

/**
 * Global preview server — one at a time.
 * Supports two modes:
 *   1. Static file serving (npx serve) for HTML/CSS/JS and framework build output
 *   2. Command execution (python app.py, node server.js) for dynamic apps
 */
class PreviewServer {
  private process: ChildProcess | null = null;
  private currentDir: string | null = null;

  /**
   * Mode 1: Serve a static file directory on a fixed port.
   * Returns the preview URL for the given file.
   */
  serve(filePath: string): string | undefined {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    this.stop();

    try {
      this.process = spawn("npx", ["serve", dir, "-l", String(STATIC_PORT), "--no-clipboard"], {
        stdio: "ignore",
        detached: true,
      });
      this.process.unref();
      this.currentDir = dir;
      const url = `http://localhost:${STATIC_PORT}/${fileName}`;
      console.log(`[PreviewServer] Serving ${dir} on port ${STATIC_PORT}`);
      return url;
    } catch (e) {
      console.log(`[PreviewServer] Failed to start static serve: ${e}`);
      return undefined;
    }
  }

  /**
   * Mode 2: Run a command (e.g. "python app.py") and use the specified port.
   * The command is expected to start a server on the given port.
   * Returns the preview URL.
   */
  runCommand(cmd: string, cwd: string, port: number): string | undefined {
    this.stop();

    try {
      this.process = spawn(cmd, {
        shell: true,
        cwd,
        stdio: "ignore",
        detached: true,
      });
      this.process.unref();
      this.currentDir = cwd;
      const url = `http://localhost:${port}`;
      console.log(`[PreviewServer] Running "${cmd}" in ${cwd}, preview at port ${port}`);
      return url;
    } catch (e) {
      console.log(`[PreviewServer] Failed to run command: ${e}`);
      return undefined;
    }
  }

  /** Kill the current process */
  stop() {
    if (this.process) {
      try {
        // Kill the process group to clean up child processes (e.g. node_modules/.bin/*)
        if (this.process.pid) process.kill(-this.process.pid, "SIGTERM");
      } catch {
        try { this.process.kill("SIGTERM"); } catch { /* already dead */ }
      }
      this.process = null;
      this.currentDir = null;
      console.log(`[PreviewServer] Stopped`);
    }
  }
}

/** Singleton instance */
export const previewServer = new PreviewServer();
