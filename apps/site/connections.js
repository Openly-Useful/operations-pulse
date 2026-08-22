const services = {
  "imap-email": {
    env: "OPERATIONS_PULSE_IMAP_CREDENTIALS",
    modes: ["host-oauth", "env-token"],
    settings: "--setting host=imap.example.com --setting user=you@example.com --setting mailbox=INBOX",
    note: "For IMAP, the named environment variable holds JSON with either password or accessToken. The pulse reads unread-count metadata only; it does not store message bodies.",
  },
  github: {
    env: "OPERATIONS_PULSE_GITHUB_TOKEN",
    modes: ["github-cli", "host-oauth", "env-token"],
    settings: "",
    note: "Use an existing local GitHub CLI sign-in, or a fine-grained read-only token. The test endpoint verifies the account and granted scopes without recording a token.",
  },
  linear: {
    env: "OPERATIONS_PULSE_LINEAR_API_KEY",
    modes: ["host-oauth", "env-token"],
    settings: "",
    note: "Use a personal API key with only the read access needed for the selected workspace.",
  },
  sentry: {
    env: "OPERATIONS_PULSE_SENTRY_TOKEN",
    modes: ["host-oauth", "env-token", "self-hosted"],
    settings: "--setting organization=your-organization",
    note: "Use an organization token limited to org:read and project:read. A self-hosted setup may additionally specify --endpoint https://sentry.example.com.",
  },
  posthog: {
    env: "OPERATIONS_PULSE_POSTHOG_TOKEN",
    modes: ["host-oauth", "env-token", "self-hosted"],
    settings: "--setting organization=your-organization --setting project=your-project-id",
    note: "Use a read-only personal API key. A self-hosted setup may additionally specify --endpoint https://posthog.example.com.",
  },
};

const form = document.querySelector("#connection-form");
const serviceSelect = document.querySelector("#connection-service");
const modeSelect = document.querySelector("#connection-mode");
const result = document.querySelector(".setup-result");
const title = document.querySelector(".setup-title");
const command = document.querySelector(".setup-command");
const note = document.querySelector(".setup-note");
const copy = document.querySelector(".copy-command");

function syncModes() {
  const available = services[serviceSelect.value].modes;
  for (const option of modeSelect.options) {
    const enabled = available.includes(option.value);
    option.disabled = !enabled;
    option.hidden = !enabled;
  }
  if (!available.includes(modeSelect.value)) modeSelect.value = available[0];
}

function setupFor(service, mode) {
  const definition = services[service];
  if (mode === "github-cli") {
    return {
      title: "Configure GitHub with your existing local CLI session",
      command: "gh auth login\noperations-pulse connections configure --id github --mode github-cli\noperations-pulse connections test --id github",
      note: "Operations Pulse asks the locally signed-in GitHub CLI for a token only while it runs a read-only identity and scope check. It never records or displays that token.",
    };
  }
  if (mode === "host-oauth") {
    return {
      title: `Configure ${service} through your host`,
      command: `operations-pulse connections configure --id ${service} --mode host-oauth`,
      note: "Run the command after approving the provider's native OAuth picker in your host. Operations Pulse deliberately cannot accept an OAuth token in chat or an MCP argument.",
    };
  }
  const endpoint = mode === "self-hosted" ? " --endpoint https://service.example.com" : "";
  return {
    title: `Configure ${service} with a credential reference`,
    command: `export ${definition.env}='…held in your secret manager…'\noperations-pulse connections configure --id ${service} --mode ${mode} --credential-env ${definition.env}${endpoint}${definition.settings ? ` ${definition.settings}` : ""}\noperations-pulse connections test --id ${service}`,
    note: definition.note,
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const setup = setupFor(serviceSelect.value, modeSelect.value);
  title.textContent = setup.title;
  command.textContent = setup.command;
  note.textContent = setup.note;
  result.hidden = false;
});

serviceSelect.addEventListener("change", syncModes);
syncModes();

copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(command.textContent);
    copy.textContent = "Copied";
    setTimeout(() => { copy.textContent = "Copy command"; }, 1800);
  } catch {
    copy.textContent = "Select and copy";
  }
});
