import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const HEARTBEAT_LABEL = "org.openlyuseful.operations-pulse";

export interface HeartbeatSchedule {
  workspace: string;
  database: string;
  intervalMinutes: number;
  logPaths: string[];
  connectionIds: string[];
  createTickets: boolean;
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function array(values: string[]): string {
  return values.map((value) => `    <string>${xml(value)}</string>`).join("\n");
}

function assertSchedule(schedule: HeartbeatSchedule): void {
  if (!Number.isInteger(schedule.intervalMinutes) || schedule.intervalMinutes < 5 || schedule.intervalMinutes > 1440) {
    throw new Error("Heartbeat interval must be a whole number from 5 to 1440 minutes.");
  }
  if (!schedule.workspace || !schedule.database) throw new Error("Heartbeat workspace and database paths are required.");
}

export function launchAgentPath(home = homedir()): string {
  return resolve(home, "Library", "LaunchAgents", `${HEARTBEAT_LABEL}.plist`);
}

export function heartbeatCommand(schedule: HeartbeatSchedule, nodePath = process.execPath, cliPath = process.argv[1]): string[] {
  assertSchedule(schedule);
  const args = [cliPath, "pulse", "run", "--root", resolve(schedule.workspace)];
  if (schedule.logPaths.length) args.push("--logs", schedule.logPaths.join(","));
  if (schedule.connectionIds.length) args.push("--connections", schedule.connectionIds.join(","));
  if (schedule.createTickets) args.push("--create-tickets");
  return [nodePath, ...args];
}

export function launchAgentPlist(schedule: HeartbeatSchedule, nodePath = process.execPath, cliPath = process.argv[1]): string {
  const command = heartbeatCommand(schedule, nodePath, cliPath);
  const intervalSeconds = schedule.intervalMinutes * 60;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${HEARTBEAT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${array(command)}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OPERATIONS_PULSE_DB</key>
    <string>${xml(resolve(schedule.database))}</string>
  </dict>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(resolve(dirname(schedule.database), "operations-pulse-heartbeat.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(resolve(dirname(schedule.database), "operations-pulse-heartbeat.error.log"))}</string>
</dict>
</plist>
`;
}

export function heartbeatPlan(schedule: HeartbeatSchedule, home = homedir()): Record<string, unknown> {
  assertSchedule(schedule);
  return {
    platform: process.platform,
    supported: process.platform === "darwin",
    label: HEARTBEAT_LABEL,
    launchAgentPath: launchAgentPath(home),
    intervalMinutes: schedule.intervalMinutes,
    command: heartbeatCommand(schedule),
    writes: [launchAgentPath(home), resolve(dirname(schedule.database), "operations-pulse-heartbeat.log"), resolve(dirname(schedule.database), "operations-pulse-heartbeat.error.log")],
    ticketCreation: schedule.createTickets,
    connectionIds: schedule.connectionIds,
    approval: "Run schedule install with --confirm-install after reviewing this plan.",
  };
}

export function heartbeatStatus(home = homedir()): Record<string, unknown> {
  const path = launchAgentPath(home);
  if (!existsSync(path)) return { installed: false, label: HEARTBEAT_LABEL, launchAgentPath: path };
  const contents = readFileSync(path, "utf8");
  return {
    installed: contents.includes(`<string>${HEARTBEAT_LABEL}</string>`),
    label: HEARTBEAT_LABEL,
    launchAgentPath: path,
    configurationReadable: true,
  };
}

export function installHeartbeat(schedule: HeartbeatSchedule, home = homedir()): Record<string, unknown> {
  if (process.platform !== "darwin") throw new Error("Persistent schedule installation currently supports macOS launchd only. Use heartbeat serve on other platforms.");
  assertSchedule(schedule);
  const path = launchAgentPath(home);
  mkdirSync(dirname(path), { recursive: true });
  mkdirSync(dirname(resolve(schedule.database)), { recursive: true });
  const user = String(process.getuid?.() ?? "");
  spawnSync("launchctl", ["bootout", `gui/${user}`, path], { encoding: "utf8" });
  writeFileSync(path, launchAgentPlist(schedule), { encoding: "utf8", mode: 0o600 });
  const result = spawnSync("launchctl", ["bootstrap", `gui/${user}`, path], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`launchctl bootstrap failed: ${(result.stderr || result.stdout || "unknown error").trim().slice(0, 500)}`);
  }
  return { ...heartbeatPlan(schedule, home), installed: true };
}

export function uninstallHeartbeat(home = homedir()): Record<string, unknown> {
  if (process.platform !== "darwin") throw new Error("Persistent schedule removal currently supports macOS launchd only.");
  const path = launchAgentPath(home);
  if (!existsSync(path)) return { removed: false, label: HEARTBEAT_LABEL, launchAgentPath: path };
  const contents = readFileSync(path, "utf8");
  if (!contents.includes(`<string>${HEARTBEAT_LABEL}</string>`)) {
    throw new Error("Refusing to remove a LaunchAgent whose label does not match Operations Pulse.");
  }
  const user = String(process.getuid?.() ?? "");
  spawnSync("launchctl", ["bootout", `gui/${user}`, path], { encoding: "utf8" });
  rmSync(path);
  return { removed: true, label: HEARTBEAT_LABEL, launchAgentPath: path };
}
