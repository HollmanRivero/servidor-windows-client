(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ui/js/api.js
  var TOKEN_KEY = "servidor.token";
  var THEME_KEY = "servidor.theme";
  var SERVER_KEY = "servidor.serverUrl";
  var DEFAULT_SERVER = "";
  var cachedWorkspace = "";
  var memoryStore = /* @__PURE__ */ new Map();
  function storeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      memoryStore.set(key, String(value));
    }
  }
  function storeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  }
  var ApiError = class extends Error {
    constructor(message, status = 0, data = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  };
  var AuthError = class extends ApiError {
    constructor(message, status = 401, data = null) {
      super(message, status, data);
      this.name = "AuthError";
    }
  };
  function getToken() {
    return storeGet(TOKEN_KEY) || "";
  }
  function setToken(value) {
    storeSet(TOKEN_KEY, String(value || "").trim());
  }
  function clearToken() {
    storeRemove(TOKEN_KEY);
  }
  function getTheme() {
    return storeGet(THEME_KEY) || "system";
  }
  function setTheme(value) {
    storeSet(THEME_KEY, value);
  }
  function getServerUrl() {
    const value = (storeGet(SERVER_KEY) || DEFAULT_SERVER).trim();
    return value.replace(/\/+$/, "");
  }
  function setServerUrl(value) {
    const clean = String(value || "").trim().replace(/\/+$/, "");
    if (clean) storeSet(SERVER_KEY, clean);
    else storeRemove(SERVER_KEY);
  }
  function serverOrigin() {
    return getServerUrl();
  }
  function baseHeaders() {
    const token = getToken();
    return token ? { "X-API-Token": token } : {};
  }
  function endpoint(path) {
    return getServerUrl() + (String(path).startsWith("/") ? path : `/${path}`);
  }
  async function raw(path, { method = "GET", body, timeout = 0 } = {}) {
    const headers = baseHeaders();
    if (body !== void 0) headers["Content-Type"] = "application/json";
    const controller = timeout ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    let response;
    try {
      response = await fetch(endpoint(path), {
        method,
        headers,
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal: controller ? controller.signal : void 0
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new ApiError("Serveren brukte for lang tid.", 504);
      }
      throw new ApiError(
        "F\xE5r ikke kontakt med Ubuntu-serveren. Sjekk Tailscale og at tjenesten kj\xF8rer.",
        0
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (response.status === 401) {
      throw new AuthError(
        data && (data.detail || data.error) || "Ugyldig eller manglende API-token.",
        401,
        data
      );
    }
    if (!response.ok) {
      const message = data && (data.detail || data.error) || `Serveren svarte HTTP ${response.status}`;
      throw new ApiError(message, response.status, data);
    }
    return data;
  }
  function extOf(path) {
    const base = String(path || "").split("/").pop() || "";
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  }
  function baseName(path) {
    return String(path || "").split("/").pop() || String(path || "");
  }
  function parentOf(path) {
    const parts = String(path || "").split("/");
    parts.pop();
    return parts.join("/");
  }
  function languageOf(path) {
    const names = {
      js: "JavaScript",
      mjs: "JavaScript",
      ts: "TypeScript",
      tsx: "TypeScript",
      jsx: "JavaScript",
      json: "JSON",
      css: "CSS",
      scss: "SCSS",
      html: "HTML",
      htm: "HTML",
      md: "Markdown",
      py: "Python",
      sh: "Shell",
      bash: "Shell",
      yml: "YAML",
      yaml: "YAML",
      toml: "TOML",
      xml: "XML",
      svg: "SVG",
      sql: "SQL",
      txt: "Tekst",
      php: "PHP",
      rb: "Ruby",
      go: "Go",
      rs: "Rust",
      java: "Java",
      kt: "Kotlin",
      c: "C",
      h: "C",
      cpp: "C++"
    };
    return names[extOf(path)] || (extOf(path) ? extOf(path).toUpperCase() : "Tekst");
  }
  function parseProviders(data) {
    return (data.providers || []).map((provider) => ({
      key: provider.key,
      label: provider.label,
      configured: Boolean(provider.configured),
      model: ""
    }));
  }
  function pickDefault(providers) {
    const order = ["deepseek", "gemini", "techai"];
    for (const key of order) {
      const found = providers.find((provider) => provider.key === key && provider.configured);
      if (found) return key;
    }
    return "deepseek";
  }
  async function readProviders() {
    const data = await raw("/chat/providers");
    return parseProviders(data);
  }
  function workspaceFromHealth(health) {
    const projectsDir = String(health.projects_dir || "").trim();
    if (projectsDir && health.projects_dir_exists !== false) return projectsDir;
    return String(health.repo_root || projectsDir || "/").trim();
  }
  async function buildStatus() {
    const health = await raw("/health");
    cachedWorkspace = workspaceFromHealth(health) || cachedWorkspace;
    const providers = await readProviders();
    return {
      app: {
        name: "Servidor",
        version: health.version || "2.0",
        mode: "remote",
        platform: "linux",
        hostname: (() => {
          try {
            return new URL(getServerUrl()).hostname;
          } catch {
            return "ubuntu";
          }
        })(),
        user: "",
        node: "Python",
        pid: 0,
        startedAt: 0
      },
      workspace: workspaceFromHealth(health),
      configFile: "",
      theme: getTheme(),
      shell: { enabled: Boolean(health.agent_shell_enabled), timeout: 120 },
      ai: { default: pickDefault(providers), providers },
      remote: {
        enabled: true,
        online: health.status === "ok",
        version: health.version,
        os: health.os,
        providers: health.ai_providers || [],
        shell: Boolean(health.agent_shell_enabled)
      }
    };
  }
  function mapProjects(data) {
    const workspace = data.workspace || "";
    const projects = (data.items || []).filter((item) => item && item.is_dir && item.name !== "servidor").map((item) => ({
      name: item.name,
      path: item.path || item.name,
      fileCount: 0,
      size: 0,
      modified: 0,
      git: false,
      description: "",
      remote: true
    })).sort((a, b) => a.name.localeCompare(b.name, "nb"));
    return { workspace, projects };
  }
  function mapTree(data, requestedPath) {
    const rel = requestedPath || "";
    const entries = (data.items || []).map((item) => {
      const path = item.path || (rel ? `${rel}/${item.name}` : item.name);
      return {
        name: item.name,
        path,
        type: item.is_dir ? "dir" : "file",
        size: 0,
        mtime: 0,
        ext: item.is_dir ? "" : extOf(item.name),
        image: false
      };
    }).sort(
      (a, b) => a.type === b.type ? a.name.localeCompare(b.name, "nb") : a.type === "dir" ? -1 : 1
    );
    return {
      path: rel,
      name: rel ? baseName(rel) : "Arbeidsomr\xE5det",
      parent: rel ? parentOf(rel) : null,
      entries,
      mtime: 0
    };
  }
  function mapRelatedStatus(status) {
    return {
      ...status,
      ai: status.ai,
      remote: status.remote
    };
  }
  function mapRecent(data) {
    const recent = (data.recent || []).map((file) => {
      const path = file.path || "";
      return {
        path,
        project: path.split("/")[0] || "",
        name: baseName(path),
        mtime: Number(file.mtime || 0) * 1e3,
        size: Number(file.size || 0),
        ext: extOf(path)
      };
    });
    return { recent };
  }
  function mapShell(data, fallbackCwd) {
    return {
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      code: typeof data.exit_code === "number" ? data.exit_code : 0,
      cwd: data.cwd || fallbackCwd || "",
      duration: Number(data.duration_ms || 0),
      timedOut: Boolean(data.timed_out),
      truncated: false,
      remote: true
    };
  }
  function transcript(messages) {
    return (messages || []).filter((message) => message && message.content).map((message) => `${message.role === "assistant" ? "Assistent" : "Bruker"}: ${message.content}`).join("\n\n");
  }
  function cleanRel(value) {
    const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!clean || clean.split("/").includes("..")) {
      throw new ApiError("Ugyldig sti", 400);
    }
    return clean;
  }
  function shQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }
  async function shellCommand(command, timeout = 60) {
    const data = await raw("/shell", {
      method: "POST",
      body: { command, cwd: "", timeout },
      timeout: (timeout + 30) * 1e3
    });
    if (data.exit_code !== 0) {
      throw new ApiError(String(data.stderr || data.stdout || "Kommandoen feilet"), 400, data);
    }
    return data;
  }
  function templateFiles(name, template) {
    const slug = String(name).toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
    if (template === "node") {
      return {
        "package.json": JSON.stringify(
          { name: slug, version: "1.0.0", private: true, type: "module", scripts: { start: "node index.js" } },
          null,
          2
        ) + "\n",
        "index.js": `console.log('Hei fra ${name}!');
`,
        ".gitignore": "node_modules/\n",
        "README.md": `# ${name}

Node-prosjekt laget med Servidor.

\`\`\`bash
npm start
\`\`\`
`
      };
    }
    if (template === "web") {
      return {
        "index.html": `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <h1>${name}</h1>
    <p>Laget med Servidor.</p>
  </main>
  <script src="script.js"><\/script>
</body>
</html>
`,
        "style.css": `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f3f3f3;
  font-family: "Segoe UI", system-ui, sans-serif;
}

main {
  padding: 48px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 32px rgb(0 0 0 / 8%);
}
`,
        "script.js": `console.log('Hei fra ${name}!');
`,
        "README.md": `# ${name}

Nettside laget med Servidor.
`
      };
    }
    if (template === "python") {
      return {
        "main.py": `def main():
    print("Hei fra ${name}!")


if __name__ == "__main__":
    main()
`,
        "requirements.txt": "",
        "README.md": `# ${name}

Python-prosjekt laget med Servidor.
`
      };
    }
    return {};
  }
  async function applyTemplate(name, template) {
    const files = templateFiles(name, template);
    for (const [file, content] of Object.entries(files)) {
      await raw("/file?path=" + encodeURIComponent(`${name}/${file}`), {
        method: "POST",
        body: { content }
      });
    }
  }
  function mapAgent(data, provider) {
    const steps = (data.steps || []).map((step) => ({
      name: step.action || "steg",
      args: {
        path: step.target || "",
        command: step.command || ""
      },
      result: {
        ok: step.ok !== false,
        stdout: step.stdout || step.result || "",
        stderr: step.stderr || "",
        error: step.ok === false ? step.result || "Steget feilet" : null
      },
      ok: step.ok !== false,
      thought: step.thought || ""
    }));
    let reply = data.summary || data.answer || "Agenten fullf\xF8rte.";
    if (data.awaiting_input) {
      reply += `

\u2753 ${data.question || "Hvilken vei vil du g\xE5?"}`;
      if (Array.isArray(data.options) && data.options.length) {
        reply += "\n\n" + data.options.map((option) => `- ${option}`).join("\n");
      }
    }
    return {
      reply,
      steps,
      model: data.model || provider,
      done: Boolean(data.done),
      project: data.project || "",
      awaiting: Boolean(data.awaiting_input),
      options: data.options || []
    };
  }
  async function settingsResponse() {
    const status = await buildStatus();
    return {
      settings: {
        theme: getTheme(),
        workspace: status.workspace,
        ai: {
          defaultProvider: status.ai.default,
          providers: status.ai.providers
        },
        remote: {
          enabled: true,
          baseUrl: getServerUrl(),
          token: getToken() ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : ""
        },
        shell: status.shell
      },
      status
    };
  }
  async function request(path, { method = "GET", body, timeout = 0 } = {}) {
    const url = new URL(path, getServerUrl());
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const params = url.searchParams;
    if (pathname === "/api/settings") {
      if (method === "PUT") {
        if (body && body.theme) setTheme(body.theme);
        if (body && body.remote && typeof body.remote.token === "string" && body.remote.token && body.remote.token !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
          setToken(body.remote.token);
        }
      }
      return settingsResponse();
    }
    if (pathname === "/api/status") {
      return mapRelatedStatus(await buildStatus());
    }
    if (pathname === "/api/stats") {
      const data = await raw("/stats");
      const totalMb = Number(data.ram_total_mb) || 0;
      const usedMb = Number(data.ram_used_mb) || 0;
      return {
        cpu: {
          percent: Math.round(Number(data.cpu_percent) || 0),
          cores: 0,
          model: "Ubuntu-server",
          speedMhz: 0
        },
        memory: {
          total: totalMb * 1024 * 1024,
          used: usedMb * 1024 * 1024,
          free: Math.max(0, totalMb - usedMb) * 1024 * 1024,
          percent: Math.round(Number(data.ram_percent) || 0)
        },
        disks: [],
        disk: {
          mount: "/",
          name: "Server",
          total: Number(data.disk_total_gb || 0) * 1024 ** 3,
          used: Number(data.disk_used_gb || 0) * 1024 ** 3,
          free: Math.max(0, (Number(data.disk_total_gb) || 0) - (Number(data.disk_used_gb) || 0)) * 1024 ** 3,
          percent: Math.round(Number(data.disk_percent) || 0)
        },
        uptime: { system: 0, process: 0 },
        host: { hostname: (() => {
          try {
            return new URL(getServerUrl()).hostname;
          } catch {
            return "ubuntu";
          }
        })(), platform: "linux", release: "", arch: "", user: "" },
        node: "Python",
        temp_c: Number(data.temp_c) || 0,
        remote: true,
        now: Date.now()
      };
    }
    if (pathname === "/api/projects") {
      if (method === "POST") {
        const created = await raw("/projects/create", {
          method: "POST",
          body: {
            name: body && body.name || "",
            git: !body || body.git !== false,
            readme: !body || body.readme !== false
          }
        });
        if (body && body.template) {
          await applyTemplate(created.name || body.name, body.template);
        }
        return created;
      }
      return mapProjects(await raw("/projects"));
    }
    if (pathname.startsWith("/api/projects/")) {
      const name = decodeURIComponent(pathname.slice("/api/projects/".length));
      const data = await raw("/projects?path=" + encodeURIComponent(name));
      const items = data.items || [];
      return {
        name,
        fileCount: items.length,
        size: 0,
        modified: 0,
        git: false,
        description: "",
        remote: true
      };
    }
    if (pathname === "/api/tree") {
      const rel = params.get("path") || "";
      const data = await raw("/projects?path=" + encodeURIComponent(rel));
      return mapTree(data, rel);
    }
    if (pathname === "/api/file") {
      const rel = params.get("path") || "";
      if (method === "PUT") {
        await raw("/file?path=" + encodeURIComponent(rel), {
          method: "POST",
          body: { content: body && body.content || "" }
        });
        return {
          path: rel,
          size: String(body && body.content || "").length,
          mtime: Date.now(),
          language: languageOf(rel)
        };
      }
      const data = await raw("/file?path=" + encodeURIComponent(rel));
      const content = String(data.content || "");
      return {
        path: rel,
        name: baseName(rel),
        content,
        language: languageOf(rel),
        size: content.length,
        mtime: Date.now(),
        binary: false,
        image: false
      };
    }
    if (pathname === "/api/entry") {
      if (method === "POST") {
        const rel = cleanRel(body && body.path || "");
        const type = body && body.type || "file";
        if (type === "dir") {
          await shellCommand(`mkdir -p -- ${shQuote(rel)}`, 30);
        } else {
          await raw("/file?path=" + encodeURIComponent(rel), {
            method: "POST",
            body: { content: "" }
          });
        }
        return { path: rel, type };
      }
      if (method === "DELETE") {
        const rel = cleanRel(params.get("path") || "");
        await shellCommand(`rm -rf -- ${shQuote(rel)}`, 120);
        return { path: rel };
      }
    }
    if (pathname === "/api/rename") {
      const from = cleanRel(body && body.from || "");
      const to = cleanRel(body && body.to || "");
      await shellCommand(`mv -- ${shQuote(from)} ${shQuote(to)}`, 60);
      return { from, to };
    }
    if (pathname === "/api/recent") {
      return mapRecent(await raw("/recent_changes"));
    }
    if (pathname === "/api/shell") {
      const command = String(body && body.command || "").trim();
      if (!cachedWorkspace) {
        try {
          const health = await raw("/health");
          cachedWorkspace = workspaceFromHealth(health);
        } catch {
          cachedWorkspace = "";
        }
      }
      const start = body && body.cwd || cachedWorkspace || "";
      const cdMatch = command.match(/^cd\s+(.+)$/i);
      if (cdMatch && !/[;&|]/.test(cdMatch[1])) {
        const target = cdMatch[1].trim().replace(/^['"]|['"]$/g, "");
        const targetExpr = target.startsWith("~") ? target : shQuote(target);
        const prefix2 = start ? `cd -- ${shQuote(start)} && ` : "";
        const result = await raw("/shell", {
          method: "POST",
          body: { command: `${prefix2}cd -- ${targetExpr} && pwd`, cwd: "", timeout: 15 }
        });
        const lines = String(result.stdout || "").trim().split("\n").filter(Boolean);
        const newCwd = lines.length ? lines[lines.length - 1] : start;
        if (result.exit_code === 0) {
          return { stdout: "", stderr: "", code: 0, cwd: newCwd, duration: 0, cd: true, remote: true };
        }
        return mapShell(result, start);
      }
      const prefix = start ? `cd -- ${shQuote(start)} && ` : "";
      const data = await raw("/shell", {
        method: "POST",
        body: {
          command: `${prefix}${command}`,
          cwd: "",
          timeout: Math.min(Number(body && body.timeout || 120), 600)
        },
        timeout: 6e5
      });
      return mapShell(data, start);
    }
    if (pathname === "/api/shell/cancel") {
      return { cancelled: false };
    }
    if (pathname === "/api/chat") {
      const provider = body && body.provider || "deepseek";
      const path2 = ["gemini", "deepseek", "techai"].includes(provider) ? `/chat/${provider}` : `/chat/provider/${encodeURIComponent(provider)}`;
      const data = await raw(path2, {
        method: "POST",
        body: { message: transcript(body && body.messages || []) },
        timeout: 18e4
      });
      return {
        reply: data.reply || "(Tomt svar)",
        model: data.model || provider,
        provider,
        remote: true
      };
    }
    if (pathname === "/api/agent") {
      const provider = body && body.provider || "deepseek";
      const project = body && body.project || "";
      const data = await raw("/chat/agent", {
        method: "POST",
        body: {
          goal: body && body.goal || "",
          project,
          primary: provider,
          review_with_other: false,
          max_steps: Math.min(Number(body && body.maxSteps || 20), 40)
        },
        timeout: 9e5
      });
      return mapAgent(data, provider);
    }
    if (pathname === "/api/ai/status") {
      const providers = await readProviders();
      return { default: pickDefault(providers), providers };
    }
    if (pathname === "/api/ai/test") {
      const provider = body && body.provider || "deepseek";
      const started = Date.now();
      const path2 = ["gemini", "deepseek", "techai"].includes(provider) ? `/chat/${provider}` : `/chat/provider/${encodeURIComponent(provider)}`;
      const data = await raw(path2, {
        method: "POST",
        body: { message: "Svar kun med ordet OK" },
        timeout: 6e4
      });
      return {
        ok: true,
        reply: String(data.reply || "").slice(0, 120),
        model: data.model || provider,
        ms: Date.now() - started
      };
    }
    if (pathname === "/api/open" || pathname === "/api/open-config") {
      throw new ApiError("\xC5pne i Utforsker st\xF8ttes ikke mot en ekstern server.", 400);
    }
    if (pathname === "/api/raw") {
      throw new ApiError("Bildevisning er ikke st\xF8ttet mot serveren enn\xE5.", 400);
    }
    return raw(path, { method, body, timeout });
  }
  var api = {
    get: (path, options) => request(path, options),
    post: (path, body, options) => request(path, { ...options, method: "POST", body }),
    put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
    del: (path, options) => request(path, { ...options, method: "DELETE" }),
    image: () => "",
    getToken,
    setToken,
    clearToken,
    getTheme,
    setTheme,
    getServerUrl,
    setServerUrl,
    origin: serverOrigin
  };

  // ui/js/icons.js
  var ICONS = {
    home: '<path d="M3.5 10.7 12 3.6l8.5 7.1"/><path d="M5.6 9.2V20h12.8V9.2"/><path d="M9.6 20v-5.4h4.8V20"/>',
    folder: '<path d="M3.2 6.6A1.6 1.6 0 0 1 4.8 5h4l2 2.2h7.4a1.6 1.6 0 0 1 1.6 1.6v8.7a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z"/>',
    "folder-open": '<path d="M3.2 8V6.6A1.6 1.6 0 0 1 4.8 5h4l2 2.2h6.6A1.6 1.6 0 0 1 19 8.8V10"/><path d="M3.4 10h17.2l-1.7 8.2a1.6 1.6 0 0 1-1.6 1.3H5.6a1.6 1.6 0 0 1-1.6-1.3z"/>',
    chat: '<path d="M20.2 11.6a7.6 7.6 0 0 1-11.1 6.7L4 19.7l1.5-4.4a7.6 7.6 0 1 1 14.7-3.7z"/>',
    terminal: '<rect x="3.2" y="4.8" width="17.6" height="14.4" rx="1.6"/><path d="M7 9.4l3 2.8-3 2.8M12.6 15h4.4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    maximize: '<rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.4"/>',
    restore: '<rect x="8.4" y="8.4" width="10.4" height="10.4" rx="1.2"/><path d="M5.2 15.6V6.6a1.4 1.4 0 0 1 1.4-1.4h9"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.2v5h-5"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M20 20l-4.2-4.2"/>',
    send: '<path d="M4.2 12 20.3 4l-6.1 16.2-3.1-6.4z"/><path d="M11.1 13.8 20.3 4"/>',
    copy: '<rect x="8.6" y="8.6" width="11" height="11" rx="1.4"/><path d="M15.4 5.4H5.8A1.4 1.4 0 0 0 4.4 6.8v9.6"/>',
    check: '<path d="M5 12.6l4.3 4.3L19 7.3"/>',
    close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
    "chevron-right": '<path d="M9.5 5.8 15.7 12l-6.2 6.2"/>',
    "chevron-down": '<path d="M5.8 9.5 12 15.7l6.2-6.2"/>',
    "chevron-left": '<path d="M14.5 5.8 8.3 12l6.2 6.2"/>',
    "chevron-up": '<path d="M5.8 14.5 12 8.3l6.2 6.2"/>',
    file: '<path d="M6.6 3.4h7.2l4.2 4.2v13H6.6z"/><path d="M13.8 3.4v4.2h4.2"/>',
    "file-plus": '<path d="M6.6 3.4h7.2l4.2 4.2v13H6.6z"/><path d="M13.8 3.4v4.2h4.2M12 12v6M9 15h6"/>',
    code: '<path d="M8.2 8.2 4.4 12l3.8 3.8M15.8 8.2 19.6 12l-3.8 3.8M13.4 5.2l-2.8 13.6"/>',
    image: '<rect x="3.4" y="4.8" width="17.2" height="14.4" rx="1.6"/><path d="M3.8 16.4l4.8-4.8 4 4 2.8-2.8 4.8 4.8"/><circle cx="9" cy="9.2" r="1.2"/>',
    trash: '<path d="M4.8 7h14.4M9.2 7V4.8h5.6V7M6.6 7l1 13.2h8.8l1-13.2M10 10.8v5.6M14 10.8v5.6"/>',
    edit: '<path d="M4 20l4.2-1L19 8.2l-3.2-3.2L5 15.8z"/><path d="M14.4 6.4l3.2 3.2"/>',
    more: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
    external: '<path d="M14 4.2h5.8V10"/><path d="M19.8 4.2 10.6 13.4"/><path d="M18.6 14.4v4.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4V7a1.4 1.4 0 0 1 1.4-1.4h4.2"/>',
    cpu: '<rect x="7.8" y="7.8" width="8.4" height="8.4" rx="1.2"/><path d="M9.4 2.8v3M14.6 2.8v3M9.4 18.2v3M14.6 18.2v3M2.8 9.4h3M2.8 14.6h3M18.2 9.4h3M18.2 14.6h3"/>',
    memory: '<rect x="2.8" y="7.4" width="18.4" height="9.2" rx="1.4"/><path d="M7 10v4M11 10v4M15 10v4"/>',
    disk: '<rect x="3.4" y="5.2" width="17.2" height="13.6" rx="1.6"/><path d="M6.4 8.6h.1M6.4 11.4h.1M9.4 8.6h7.2M9.4 11.4h7.2"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
    sparkles: '<path d="M12 3.2l1.7 4.9 4.9 1.7-4.9 1.7L12 16.4l-1.7-4.9L5.4 9.8l4.9-1.7z"/><path d="M18.4 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    play: '<path d="M7.4 4.6 19 12 7.4 19.4z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.4"/>',
    alert: '<path d="M12 3.8 21 20H3z"/><path d="M12 9.4v4.4M12 16.9h.01"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.8h.01"/>',
    sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    moon: '<path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z"/>',
    monitor: '<rect x="2.8" y="4.4" width="18.4" height="11.6" rx="1.4"/><path d="M8.6 20h6.8M12 16v4"/>',
    git: '<circle cx="6" cy="5.4" r="2"/><circle cx="18" cy="18.6" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7.4v8.2a4 4 0 0 0 4 4h6"/><path d="M16 7v5a4 4 0 0 1-4 4H9.4"/>',
    server: '<rect x="3.4" y="4.2" width="17.2" height="6.2" rx="1.4"/><rect x="3.4" y="13.6" width="17.2" height="6.2" rx="1.4"/><path d="M6.8 7.3h.01M6.8 16.7h.01"/><path d="M10.4 7.3h6.4M10.4 16.7h6.4"/>',
    link: '<path d="M9.6 14.4l4.8-4.8"/><path d="M10.6 6.4l1.8-1.8a3.7 3.7 0 0 1 5.2 5.2l-1.8 1.8"/><path d="M13.4 17.6l-1.8 1.8a3.7 3.7 0 0 1-5.2-5.2l1.8-1.8"/>',
    eraser: '<path d="M4.4 16.2 15.8 4.8l4 4L8.4 20.2H4.4z"/><path d="M12.4 20.2h7.2"/>',
    keyboard: '<rect x="2.8" y="6.2" width="18.4" height="11.6" rx="1.6"/><path d="M6.4 9.6h.01M9.6 9.6h.01M12.8 9.6h.01M16 9.6h.01M7 13.6h10"/>',
    pin: '<path d="M9 3.8h6M12 3.8v6.4M12 10.2c-3 0-5.4 2.2-5.4 5h10.8c0-2.8-2.4-5-5.4-5zM12 15.2V21"/>',
    layers: '<path d="M12 3.4 21 8l-9 4.6L3 8z"/><path d="M3 12.4l9 4.6 9-4.6"/><path d="M3 16.8l9 4.6 9-4.6"/>',
    package: '<path d="M12 3 21 7.4v9.2L12 21 3 16.6V7.4z"/><path d="M3.4 7.6 12 12l8.6-4.4M12 12v9"/>',
    wifi: '<path d="M3.4 9.2a13 13 0 0 1 17.2 0M6.6 12.6a8.4 8.4 0 0 1 10.8 0M9.8 16a4 4 0 0 1 4.4 0M12 19.2h.01"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.2 3.6 8.6S14.4 18.2 12 20.6C9.6 18.2 8.4 15.4 8.4 12S9.6 5.8 12 3.4z"/>',
    history: '<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.6 4.2v4.6h4.6"/><path d="M12 7.6V12l3 1.8"/>',
    panel: '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="1.6"/><path d="M9.4 4.6v14.8"/>',
    shield: '<path d="M12 3.4 20 6v5.4c0 4.6-3.2 7.8-8 9.2-4.8-1.4-8-4.6-8-9.2V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
    sunDim: '<circle cx="12" cy="12" r="3.4"/><path d="M12 4.6v1.6M12 17.8v1.6M4.6 12h1.6M17.8 12h1.6M6.7 6.7l1.1 1.1M16.2 16.2l1.1 1.1M17.3 6.7l-1.1 1.1M7.8 16.2l-1.1 1.1"/>',
    dots: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'
  };
  function icon(name, size = 16, className = "") {
    const body = ICONS[name] || "";
    return `<svg class="ico ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  function logo(size = 20) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#lg)"/>
    <rect x="8" y="9.5" width="16" height="5" rx="1.6" fill="#fff" opacity=".92"/>
    <rect x="8" y="17.5" width="16" height="5" rx="1.6" fill="#fff" opacity=".6"/>
    <circle cx="11" cy="12" r="1" fill="#005FB8"/>
    <circle cx="11" cy="20" r="1" fill="#005FB8"/>
    <defs>
      <linearGradient id="lg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4CC2FF"/><stop offset="1" stop-color="#0A64C8"/>
      </linearGradient>
    </defs>
  </svg>`;
  }

  // ui/js/ui.js
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }
  function fmtBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = n / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    const rounded = value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "");
    return `${rounded} ${units[index]}`;
  }
  function fmtNumber(value) {
    return new Intl.NumberFormat("nb-NO").format(Number(value) || 0);
  }
  function timeAgo(timestamp) {
    if (!timestamp) return "";
    const diff = Date.now() - Number(timestamp);
    if (diff < 0) return "n\xE5";
    const seconds = Math.round(diff / 1e3);
    if (seconds < 45) return "n\xE5 nettopp";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min siden`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} t siden`;
    const days = Math.round(hours / 24);
    if (days === 1) return "i g\xE5r";
    if (days < 7) return `${days} dager siden`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks} uker siden`;
    return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(Number(timestamp))
    );
  }
  function fmtDuration(ms) {
    const value = Math.max(0, Math.round(Number(ms) || 0));
    if (value < 1e3) return `${value} ms`;
    const seconds = value / 1e3;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return `${minutes} min ${rest} s`;
  }
  function fmtUptime(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const days = Math.floor(total / 86400);
    const hours = Math.floor(total % 86400 / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    if (days > 0) return `${days} d ${hours} t`;
    if (hours > 0) return `${hours} t ${minutes} min`;
    return `${minutes} min`;
  }
  function greeting(date = /* @__PURE__ */ new Date()) {
    const hour = date.getHours();
    if (hour < 5) return "God natt";
    if (hour < 10) return "God morgen";
    if (hour < 17) return "God dag";
    if (hour < 23) return "God kveld";
    return "God natt";
  }
  function shortHost(hostname) {
    return String(hostname || "denne PC-en");
  }
  function platformLabel(platform) {
    if (platform === "win32") return "Windows 11";
    if (platform === "darwin") return "macOS";
    return "Linux";
  }
  function fileIconName(ext, isImage) {
    if (isImage) return "image";
    const code = [
      "js",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "jsx",
      "py",
      "rs",
      "go",
      "cs",
      "java",
      "kt",
      "c",
      "cpp",
      "h",
      "php",
      "rb",
      "vue",
      "svelte",
      "html",
      "htm",
      "css",
      "scss",
      "less",
      "json",
      "xml",
      "yml",
      "yaml",
      "toml",
      "sql",
      "sh",
      "ps1",
      "bat",
      "cmd"
    ];
    if (code.includes(ext)) return "code";
    return "file";
  }
  var TOAST_ICON = { success: "check", error: "alert", info: "info", warning: "alert" };
  function toast(message, kind = "info", duration = 3800) {
    const root = document.getElementById("toasts");
    if (!root) return;
    const node = document.createElement("div");
    node.className = `toast toast-${kind}`;
    node.innerHTML = `<span class="toast-icon">${icon(TOAST_ICON[kind] || "info", 16)}</span><span class="toast-text"></span>`;
    node.querySelector(".toast-text").textContent = message;
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add("in"));
    setTimeout(() => {
      node.classList.remove("in");
      setTimeout(() => node.remove(), 220);
    }, duration);
  }
  function trapFocus(container) {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const onKey = (event) => {
      if (event.key !== "Tab") return;
      const items = [...container.querySelectorAll(selector)].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKey);
    return () => container.removeEventListener("keydown", onKey);
  }
  function openDialog({
    title = "",
    subtitle = "",
    content = null,
    footer = [],
    width = 520,
    persistent = false,
    onClose = null
  } = {}) {
    const root = document.getElementById("overlayRoot");
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const dialog = document.createElement("div");
    dialog.className = "dialog";
    dialog.style.width = `min(${width}px, calc(100vw - 48px))`;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = `
    <div class="dialog-head">
      <div>
        <h2 class="dialog-title">${esc(title)}</h2>
        ${subtitle ? `<p class="dialog-subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      <button class="btn icon-btn subtle dialog-close" aria-label="Lukk">${icon("close", 16)}</button>
    </div>
    <div class="dialog-body"></div>
    <div class="dialog-foot"></div>
  `;
    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("in"));
    const body = dialog.querySelector(".dialog-body");
    if (content) {
      if (typeof content === "string") body.innerHTML = content;
      else body.appendChild(content);
    }
    const foot = dialog.querySelector(".dialog-foot");
    const close = () => {
      if (backdrop.classList.contains("out")) return;
      backdrop.classList.remove("in");
      backdrop.classList.add("out");
      removeTrap();
      document.removeEventListener("keydown", onKey);
      setTimeout(() => backdrop.remove(), 160);
      if (onClose) onClose();
    };
    const onKey = (event) => {
      if (event.key === "Escape" && !persistent) close();
    };
    document.addEventListener("keydown", onKey);
    const removeTrap = trapFocus(dialog);
    footer.forEach((action) => {
      if (!action) return;
      const button = document.createElement("button");
      button.className = `btn ${action.kind || ""}`.trim();
      button.innerHTML = `${action.icon ? icon(action.icon, 16) : ""}<span>${esc(action.label)}</span>`;
      if (action.id) button.dataset.action = action.id;
      button.addEventListener("click", async () => {
        if (!action.onClick) return close();
        button.disabled = true;
        try {
          const result = await action.onClick({ close, dialog, body });
          button.disabled = false;
          if (result !== false) close();
        } catch (err) {
          button.disabled = false;
          toast(err.message || "Noe gikk galt", "error");
        }
      });
      foot.appendChild(button);
    });
    dialog.querySelector(".dialog-close").addEventListener("click", close);
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop && !persistent) close();
    });
    const focusTarget = dialog.querySelector("input, textarea, select, .btn.primary");
    if (focusTarget) setTimeout(() => focusTarget.focus(), 40);
    return { close, dialog, body, footer: foot };
  }
  function confirmDialog({
    title = "Er du sikker?",
    message = "",
    confirm = "OK",
    cancel = "Avbryt",
    danger = false
  } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      openDialog({
        title,
        width: 440,
        content: `<p class="dialog-text">${esc(message)}</p>`,
        footer: [
          {
            label: cancel,
            onClick: () => {
              done(false);
            }
          },
          {
            label: confirm,
            kind: danger ? "danger-solid" : "primary",
            onClick: () => {
              done(true);
            }
          }
        ],
        onClose: () => done(false)
      });
    });
  }
  function promptDialog({
    title = "Nytt navn",
    label = "Navn",
    value = "",
    placeholder = "",
    hint = "",
    confirm = "Opprett",
    width = 460
  } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const form = document.createElement("form");
      form.className = "dialog-form";
      form.innerHTML = `
      <label class="field">
        <span class="field-label">${esc(label)}</span>
        <input class="input" name="value" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" />
      </label>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    `;
      form.querySelector("input").value = value;
      const dialog = openDialog({
        title,
        content: form,
        width,
        footer: [
          { label: "Avbryt", onClick: () => done(null) },
          {
            label: confirm,
            kind: "primary",
            onClick: () => {
              const input2 = form.querySelector("input");
              const text = input2.value.trim();
              if (!text) {
                input2.focus();
                input2.classList.add("invalid");
                setTimeout(() => input2.classList.remove("invalid"), 900);
                return false;
              }
              done(text);
            }
          }
        ],
        onClose: () => done(null)
      });
      const input = form.querySelector("input");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (text) done(text);
      });
      setTimeout(() => {
        input.focus();
        input.select();
      }, 60);
      return dialog;
    });
  }
  var activeMenu = null;
  function closeMenu() {
    if (!activeMenu) return;
    const { element, onClick, onKey } = activeMenu;
    document.removeEventListener("mousedown", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    element.remove();
    activeMenu = null;
  }
  function menu(anchor, items) {
    closeMenu();
    const element = document.createElement("div");
    element.className = "menu";
    element.setAttribute("role", "menu");
    items.forEach((item) => {
      if (!item) return;
      if (item.separator) {
        element.insertAdjacentHTML("beforeend", '<div class="menu-sep"></div>');
        return;
      }
      const button = document.createElement("button");
      button.className = `menu-item ${item.danger ? "danger" : ""}`.trim();
      button.innerHTML = `${item.icon ? icon(item.icon, 16) : '<span class="menu-ico"></span>'}<span>${esc(item.label)}</span>`;
      button.addEventListener("click", () => {
        closeMenu();
        item.onClick && item.onClick();
      });
      element.appendChild(button);
    });
    document.body.appendChild(element);
    const rect = anchor.getBoundingClientRect();
    const menuRect = element.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + menuRect.width > window.innerWidth - 12) left = window.innerWidth - menuRect.width - 12;
    if (top + menuRect.height > window.innerHeight - 12) top = rect.top - menuRect.height - 6;
    element.style.left = `${Math.max(8, left)}px`;
    element.style.top = `${Math.max(8, top)}px`;
    requestAnimationFrame(() => element.classList.add("in"));
    const onClick = (event) => {
      if (!element.contains(event.target)) {
        closeMenu();
        document.removeEventListener("mousedown", onClick, true);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        closeMenu();
        document.removeEventListener("keydown", onKey, true);
      }
    };
    document.addEventListener("mousedown", onClick, true);
    document.addEventListener("keydown", onKey, true);
    activeMenu = { element, onClick, onKey };
    return element;
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text));
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = String(text);
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }
  function inlineMarkdown(source) {
    const codes = [];
    let text = String(source).replace(/`([^`]+)`/g, (_, code) => {
      codes.push(code);
      return `${codes.length - 1}`;
    });
    text = esc(text);
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    text = text.replace(/\u0001(\d+)\u0001/g, (_, index) => `<code>${esc(codes[Number(index)])}</code>`);
    return text;
  }
  function markdown(source) {
    const blocks = [];
    let text = String(source || "").replace(/\r\n/g, "\n");
    text = text.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push({ lang: String(lang || "").toLowerCase(), code: code.replace(/\n$/, "") });
      return `\0CODE${blocks.length - 1}\0`;
    });
    const lines = text.split("\n");
    const out = [];
    let paragraph = [];
    let list = null;
    let quote = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list) return;
      out.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    };
    const flushQuote = () => {
      if (!quote) return;
      out.push(`<blockquote>${quote.map(inlineMarkdown).join("<br>")}</blockquote>`);
      quote = null;
    };
    const flushAll = () => {
      flushParagraph();
      flushList();
      flushQuote();
    };
    for (const line of lines) {
      const codeMatch = line.match(/^\u0000CODE(\d+)\u0000$/);
      if (codeMatch) {
        flushAll();
        const block = blocks[Number(codeMatch[1])];
        const lang = block.lang || "kode";
        out.push(
          `<div class="code-block"><div class="code-head"><span class="code-lang">${esc(lang)}</span><button class="code-copy" type="button">Kopier</button></div><pre><code>${esc(block.code)}</code></pre></div>`
        );
        continue;
      }
      if (!line.trim()) {
        flushAll();
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushAll();
        const level = Math.min(6, heading[1].length + 1);
        out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }
      if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
        flushAll();
        out.push("<hr>");
        continue;
      }
      const quoteMatch = line.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        flushParagraph();
        flushList();
        quote = quote || [];
        quote.push(quoteMatch[1]);
        continue;
      }
      const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      if (bullet) {
        flushParagraph();
        flushQuote();
        if (!list || list.type !== "ul") {
          flushList();
          list = { type: "ul", items: [] };
        }
        list.items.push(bullet[1]);
        continue;
      }
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (numbered) {
        flushParagraph();
        flushQuote();
        if (!list || list.type !== "ol") {
          flushList();
          list = { type: "ol", items: [] };
        }
        list.items.push(numbered[1]);
        continue;
      }
      if (list) flushList();
      if (quote) {
        quote.push(line);
        continue;
      }
      paragraph.push(line);
    }
    flushAll();
    return out.join("\n");
  }
  function wireCopyButtons(root) {
    root.addEventListener("click", async (event) => {
      const button = event.target.closest(".code-copy");
      if (!button) return;
      const block = button.closest(".code-block");
      const code = block ? block.querySelector("code") : null;
      if (!code) return;
      const ok = await copyText(code.textContent || "");
      if (ok) {
        button.textContent = "Kopiert";
        button.classList.add("copied");
        setTimeout(() => {
          button.textContent = "Kopier";
          button.classList.remove("copied");
        }, 1600);
      }
    });
  }
  function sparkline(values, width = 132, height = 36, color = "var(--accent)") {
    const list = (values || []).filter((value) => Number.isFinite(Number(value))).map(Number);
    if (list.length < 2) {
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><line x1="0" y1="${height - 2}" x2="${width}" y2="${height - 2}" stroke="var(--stroke-2)" stroke-width="1"/></svg>`;
    }
    const max = Math.max(...list, 1);
    const min = Math.min(...list, 0);
    const span = Math.max(1, max - min);
    const step = width / (list.length - 1);
    const points = list.map((value, index) => {
      const x = index * step;
      const y = height - 3 - (value - min) / span * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const area = `0,${height} ${points.join(" ")} ${width},${height}`;
    return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="${area}" fill="${color}" opacity=".12"></polygon>
    <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></polyline>
  </svg>`;
  }

  // ui/js/views/home.js
  var home_exports = {};
  __export(home_exports, {
    mount: () => mount
  });
  function providerMark(key, label) {
    const short = key === "techai" ? "T" : key === "deepseek" ? "D" : key === "custom" ? "+" : "G";
    return `<span class="provider-mark ${esc(key)}">${short}</span>`;
  }
  function skeletonStats() {
    return Array.from({ length: 4 }).map(
      () => `<div class="card stat-card">
        <div class="skeleton" style="width:66px;height:66px;border-radius:50%"></div>
        <div class="stat-info">
          <div class="skeleton" style="width:46px;height:10px;margin-bottom:8px"></div>
          <div class="skeleton" style="width:90px;height:16px;margin-bottom:8px"></div>
          <div class="skeleton" style="width:120px;height:10px"></div>
        </div>
      </div>`
    ).join("");
  }
  async function mount(root, ctx) {
    const { state: state2, navigate: navigate2 } = ctx;
    const status = state2.status || {};
    const app = status.app || {};
    const remote = status.remote || {};
    const isRemote = app.mode === "remote";
    const user = app.user || "";
    const hello = user ? `${greeting()}, ${user}` : greeting();
    root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>${esc(hello)}</h1>
            <p class="page-sub">
              <span>${esc(shortHost(app.hostname))}</span>
              <span class="sep"></span>
              <span>${esc(platformLabel(app.platform))}</span>
              <span class="sep"></span>
              <span>${isRemote ? "Ubuntu-server via Tailscale" : "Lokal"}</span>
              ${app.node ? `<span class="sep"></span><span>${esc(app.node)}</span>` : ""}
            </p>
          </div>
          <div class="actions">
            <button class="btn" id="homeNewChat" type="button">${icon("chat", 16)}<span>Ny samtale</span></button>
            <button class="btn primary" id="homeNewProject" type="button">${icon("plus", 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>

        <div class="stat-grid" id="homeStats">${skeletonStats()}</div>

        <div class="home-grid">
          <div class="home-stack">
            <div class="card" id="homeProjects">
              <div class="card-head">
                <div class="card-title">${icon("folder", 16)}<span>Prosjekter</span></div>
                <button class="card-link" data-goto="#/projects" type="button">Se alle ${icon("chevron-right", 12)}</button>
              </div>
              <div class="list" id="homeProjectList">
                <div style="padding:16px"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>
              </div>
            </div>

            <div class="card" id="homeRecent">
              <div class="card-head">
                <div class="card-title">${icon("history", 16)}<span>Siste endringer</span></div>
              </div>
              <div class="list" id="homeRecentList">
                <div style="padding:16px"><div class="skeleton" style="height:36px;margin-bottom:8px"></div><div class="skeleton" style="height:36px;margin-bottom:8px"></div><div class="skeleton" style="height:36px"></div></div>
              </div>
            </div>
          </div>

          <div class="home-stack">
            <div class="card" id="homeAi">
              <div class="card-head">
                <div class="card-title">${icon("sparkles", 16)}<span>AI-assistenter</span></div>
                <span class="badge" id="aiBadge">\u2026</span>
              </div>
              <div id="homeAiList"></div>
              <div class="card-foot">
                <span class="tiny">${isRemote && remote.online ? "Bruker serverens n\xF8kler" : "N\xF8kler lagres lokalt"}</span>
                <button class="card-link" data-goto="#/chat" type="button">\xC5pne chat ${icon("chevron-right", 12)}</button>
              </div>
            </div>

            <div class="card" id="homeQuick">
              <div class="card-head">
                <div class="card-title">${icon("layers", 16)}<span>Hurtighandlinger</span></div>
              </div>
              <div class="quick-grid">
                <button class="quick-action" data-goto="#/projects?new=1" type="button">
                  <span class="qa-icon">${icon("plus", 15)}</span>
                  <span><strong>Nytt prosjekt</strong><small>Start fra mal</small></span>
                </button>
                <button class="quick-action" data-goto="#/chat?new=1" type="button">
                  <span class="qa-icon">${icon("chat", 15)}</span>
                  <span><strong>Ny samtale</strong><small>Sp\xF8r en agent</small></span>
                </button>
                <button class="quick-action" data-goto="#/terminal" type="button">
                  <span class="qa-icon">${icon("terminal", 15)}</span>
                  <span><strong>Terminal</strong><small>Kj\xF8r kommandoer</small></span>
                </button>
                <button class="quick-action" data-goto="#/settings" type="button">
                  <span class="qa-icon">${icon("settings", 15)}</span>
                  <span><strong>Innstillinger</strong><small>N\xF8kler og tema</small></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    root.querySelectorAll("[data-goto]").forEach((button) => {
      button.addEventListener("click", () => navigate2(button.dataset.goto));
    });
    const newProject = root.querySelector("#homeNewProject");
    if (newProject) newProject.addEventListener("click", () => navigate2("#/projects?new=1"));
    const newChat = root.querySelector("#homeNewChat");
    if (newChat) newChat.addEventListener("click", () => navigate2("#/chat?new=1"));
    let history2 = [];
    let timer = null;
    let disposed = false;
    function renderStats(stats) {
      const host = root.querySelector("#homeStats");
      if (!host) return;
      const cpu = stats.cpu || {};
      const memory = stats.memory || {};
      const disk = stats.disk || {};
      const uptime = stats.uptime || {};
      const cores = cpu.cores || 1;
      const cpuPercent = Math.round(Number(cpu.percent) || 0);
      const ramPercent = Math.round(Number(memory.percent) || 0);
      const diskPercent = Math.round(Number(disk.percent) || 0);
      history2.push(cpuPercent);
      if (history2.length > 34) history2.shift();
      host.innerHTML = `
      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${cpuPercent};--ring-color:var(--accent)">
            <span class="ring-value">${cpuPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Prosessor</div>
          <div class="stat-main">${stats.remote ? "Server" : `${cores} <small>${cores === 1 ? "kjerne" : "kjerner"}</small>`}</div>
          <div class="stat-note" title="${esc(cpu.model || "")}">${esc(cpu.model || "Ukjent CPU")}</div>
          <div id="cpuSpark">${sparkline(history2, 128, 24)}</div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${ramPercent};--ring-color:var(--violet)">
            <span class="ring-value">${ramPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Minne</div>
          <div class="stat-main">${esc(fmtBytes(memory.used || 0))}</div>
          <div class="stat-note">av ${esc(fmtBytes(memory.total || 0))}</div>
          <div class="bar"><span style="width:${ramPercent}%;--bar-color:var(--violet)"></span></div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${diskPercent};--ring-color:var(--warning)">
            <span class="ring-value">${diskPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Disk ${esc(disk.name || "")}</div>
          <div class="stat-main">${esc(fmtBytes(disk.used || 0))}</div>
          <div class="stat-note">av ${esc(fmtBytes(disk.total || 0))}</div>
          <div class="bar"><span style="width:${diskPercent}%;--bar-color:var(--warning)"></span></div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="list-icon" style="width:66px;height:66px;border-radius:50%;background:var(--layer)">
            ${icon("clock", 26)}
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Oppetid</div>
          <div class="stat-main">${stats.remote ? "\u2014" : esc(fmtUptime(uptime.system))}</div>
          <div class="stat-note">${stats.remote ? "ekstern server" : "denne PC-en"}</div>
          <div class="tiny" style="margin-top:5px">${stats.remote ? "via Tailscale" : `Servidor ${esc(fmtUptime(uptime.process))}`}</div>
        </div>
      </div>`;
    }
    function renderProjects(projects) {
      const host = root.querySelector("#homeProjectList");
      if (!host) return;
      if (!projects.length) {
        host.innerHTML = `
        <div class="empty-state" style="padding:30px 20px">
          <div class="empty-glyph" style="width:48px;height:48px;border-radius:12px">${icon("folder", 24)}</div>
          <h3>Ingen prosjekter enn\xE5</h3>
          <p>Lag ditt f\xF8rste prosjekt \u2013 med git, README og startfiler.</p>
          <button class="btn primary" id="emptyNewProject" type="button">${icon("plus", 16)}<span>Nytt prosjekt</span></button>
        </div>`;
        const button = host.querySelector("#emptyNewProject");
        if (button) button.addEventListener("click", () => navigate2("#/projects?new=1"));
        return;
      }
      host.innerHTML = projects.slice(0, 5).map(
        (project) => `
        <button class="list-row" data-open-project="${esc(project.name)}" type="button">
          <span class="list-icon">${icon("folder", 16)}</span>
          <span class="list-main">
            <span class="list-name">${esc(project.name)}</span>
            <span class="list-meta">${project.remote ? "p\xE5 Ubuntu-serveren" : `${fmtNumber(project.fileCount)} filer \xB7 ${esc(fmtBytes(project.size))}`}</span>
          </span>
          <span class="list-side">
            ${project.git ? '<span class="badge">git</span>' : ""}
            <span>${esc(timeAgo(project.modified))}</span>
            ${icon("chevron-right", 14)}
          </span>
        </button>`
      ).join("");
      host.querySelectorAll("[data-open-project]").forEach((row) => {
        row.addEventListener(
          "click",
          () => navigate2(`#/editor?project=${encodeURIComponent(row.dataset.openProject)}`)
        );
      });
    }
    function renderAi() {
      const list = root.querySelector("#homeAiList");
      const badge = root.querySelector("#aiBadge");
      if (!list) return;
      const providers = status.ai && status.ai.providers || [];
      const configured = providers.filter((provider) => provider.configured).length;
      if (badge) {
        badge.textContent = configured ? `${configured} klar` : "ikke satt opp";
        badge.className = `badge ${configured ? "success" : ""}`.trim();
      }
      list.innerHTML = providers.map(
        (provider) => `
        <div class="provider-row">
          ${providerMark(provider.key, provider.label)}
          <span class="provider-name">${esc(provider.label)}</span>
          <span class="provider-state">${provider.key === "custom" ? provider.configured ? "egen" : "valgfri" : provider.configured ? "klar" : "mangler n\xF8kkel"}</span>
          <span class="dot ${provider.configured ? "" : "off"}"></span>
        </div>`
      ).join("");
    }
    function renderRecent(recent) {
      const host = root.querySelector("#homeRecentList");
      if (!host) return;
      if (!recent.length) {
        host.innerHTML = `<div class="empty-state" style="padding:24px 16px"><p style="margin:0">Ingen filer er endret enn\xE5.</p></div>`;
        return;
      }
      host.innerHTML = recent.slice(0, 5).map(
        (file) => `
        <button class="list-row" data-open-file="${esc(file.path)}" type="button">
          <span class="list-icon violet">${icon("file", 15)}</span>
          <span class="list-main">
            <span class="list-name">${esc(file.name)}</span>
            <span class="list-meta">${esc(file.project)}</span>
          </span>
          <span class="list-side"><span>${esc(timeAgo(file.mtime))}</span></span>
        </button>`
      ).join("");
      host.querySelectorAll("[data-open-file]").forEach((row) => {
        row.addEventListener("click", () => {
          const path = row.dataset.openFile;
          const project = path.split("/")[0];
          const file = path.split("/").slice(1).join("/");
          navigate2(`#/editor?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`);
        });
      });
    }
    try {
      const [stats, projects, recent] = await Promise.all([
        api.get("/api/stats"),
        api.get("/api/projects"),
        api.get("/api/recent?limit=7")
      ]);
      if (disposed || !root.isConnected) return void 0;
      state2.stats = stats;
      state2.projects = projects.projects || [];
      renderStats(stats);
      renderProjects(state2.projects);
      renderRecent(recent.recent || []);
      renderAi();
      timer = setInterval(async () => {
        if (document.hidden || !root.isConnected) return;
        try {
          const fresh = await api.get("/api/stats");
          if (disposed || !root.isConnected) return;
          state2.stats = fresh;
          const cpu = Math.round(Number(fresh.cpu?.percent) || 0);
          history2.push(cpu);
          if (history2.length > 34) history2.shift();
          const ring = root.querySelector(".stat-card .ring");
          if (ring) {
            ring.style.setProperty("--p", cpu);
            const value = ring.querySelector(".ring-value");
            if (value) value.innerHTML = `${cpu}<small>%</small>`;
          }
          const spark = root.querySelector("#cpuSpark");
          if (spark) spark.innerHTML = sparkline(history2, 128, 24);
          const bars = root.querySelectorAll(".stat-card .bar > span");
          if (bars[0] && fresh.memory) bars[0].style.width = `${Math.round(fresh.memory.percent || 0)}%`;
          if (bars[1] && fresh.disk) bars[1].style.width = `${Math.round(fresh.disk.percent || 0)}%`;
          const ramNote = root.querySelectorAll(".stat-card .stat-note");
          if (ramNote[1] && fresh.memory) {
            ramNote[1].textContent = `av ${fmtBytes(fresh.memory.total || 0)}`;
          }
        } catch {
        }
      }, 3e3);
    } catch (err) {
      if (root.isConnected) {
        toast(err.message || "Kunne ikke hente systemstatus", "error");
        const host = root.querySelector("#homeStats");
        if (host) {
          host.innerHTML = `<div class="card" style="grid-column:1/-1;padding:18px"><div class="row">${icon("alert", 18)}<span>${esc(err.message)}</span></div></div>`;
        }
      }
    }
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
  }

  // ui/js/views/projects.js
  var projects_exports = {};
  __export(projects_exports, {
    mount: () => mount2
  });
  var TEMPLATES = [
    { id: "empty", label: "Tom", hint: "Bare en README" },
    { id: "node", label: "Node", hint: "package.json + index.js" },
    { id: "web", label: "Nettside", hint: "HTML, CSS og JS" },
    { id: "python", label: "Python", hint: "main.py + requirements" }
  ];
  function projectCard(project) {
    const description = project.description || "Ingen beskrivelse enn\xE5.";
    return `
    <article class="project-card" data-project="${esc(project.name)}" tabindex="0" role="button" aria-label="\xC5pne ${esc(project.name)}">
      <div class="pc-top">
        <span class="pc-tile">${icon("folder", 19)}</span>
        <button class="btn icon-btn small subtle" data-menu="${esc(project.name)}" type="button" aria-label="Meny for ${esc(project.name)}">${icon("more", 16)}</button>
      </div>
      <h3 class="pc-name">${esc(project.name)}</h3>
      <p class="pc-desc">${esc(description)}</p>
      <div class="pc-meta">
        <span>${project.remote ? "ekstern" : `${fmtNumber(project.fileCount)} filer`}</span>
        ${project.remote ? "" : `<span>${esc(fmtBytes(project.size))}</span>`}
        <span>${esc(timeAgo(project.modified))}</span>
        ${project.git ? '<span class="badge">git</span>' : ""}
      </div>
    </article>`;
  }
  function newProjectCard() {
    return `
    <button class="project-card new" id="newProjectCard" type="button">
      <span class="pc-tile">${icon("plus", 18)}</span>
      <strong>Nytt prosjekt</strong>
      <span>Start noe nytt</span>
    </button>`;
  }
  function openCreateDialog({ workspace, onCreated }) {
    let template = "web";
    let git = true;
    let readme = true;
    const form = document.createElement("div");
    form.className = "dialog-form";
    form.innerHTML = `
    <label class="field">
      <span class="field-label">Prosjektnavn</span>
      <input class="input" name="name" autocomplete="off" spellcheck="false" placeholder="f.eks. MinNettside" />
    </label>
    <div class="field">
      <span class="field-label">Mal</span>
      <div class="theme-options" style="grid-template-columns:repeat(4,1fr)">
        ${TEMPLATES.map(
      (item) => `
          <button class="theme-card ${item.id === template ? "selected" : ""}" data-template="${item.id}" type="button">
            <span class="theme-label"><strong style="font-size:12px">${esc(item.label)}</strong></span>
            <span class="tiny" style="font-size:10.5px">${esc(item.hint)}</span>
          </button>`
    ).join("")}
      </div>
    </div>
    <div class="settings-group" style="margin-top:4px">
      <label class="switch-row" style="padding:6px 0;border:0">
        <span class="switch-copy"><strong>Git-repo</strong><span>Kj\xF8r git init og lag f\xF8rste commit</span></span>
        <button class="switch on" data-switch="git" type="button" role="switch" aria-checked="true"></button>
      </label>
      <label class="switch-row" style="padding:6px 0;border:0">
        <span class="switch-copy"><strong>README</strong><span>Lag en README.md med prosjektnavnet</span></span>
        <button class="switch on" data-switch="readme" type="button" role="switch" aria-checked="true"></button>
      </label>
    </div>
    <p class="field-hint" id="createHint">Opprettes i ${esc(workspace)}</p>
    <p class="test-result fail" id="createError" style="display:none"></p>
  `;
    const nameInput = form.querySelector('input[name="name"]');
    form.querySelectorAll("[data-template]").forEach((button) => {
      button.addEventListener("click", () => {
        template = button.dataset.template;
        form.querySelectorAll("[data-template]").forEach((item) => item.classList.toggle("selected", item === button));
      });
    });
    form.querySelectorAll("[data-switch]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.switch;
        if (key === "git") git = !git;
        else readme = !readme;
        const value = key === "git" ? git : readme;
        button.classList.toggle("on", value);
        button.setAttribute("aria-checked", value ? "true" : "false");
      });
    });
    const dialog = openDialog({
      title: "Nytt prosjekt",
      subtitle: "Lag en mappe med startfiler, klar til \xE5 kodes.",
      content: form,
      width: 560,
      footer: [
        { label: "Avbryt", onClick: () => {
        } },
        {
          label: "Opprett prosjekt",
          kind: "primary",
          icon: "plus",
          onClick: async () => {
            const name = nameInput.value.trim();
            const errorBox = form.querySelector("#createError");
            if (!name) {
              nameInput.focus();
              nameInput.classList.add("invalid");
              setTimeout(() => nameInput.classList.remove("invalid"), 900);
              return false;
            }
            try {
              const created = await api.post("/api/projects", { name, template, git, readme });
              toast(`Prosjektet \xAB${created.name}\xBB er opprettet`, "success");
              dialog.close();
              onCreated(created);
            } catch (err) {
              errorBox.style.display = "block";
              errorBox.textContent = err.message;
              return false;
            }
            return false;
          }
        }
      ]
    });
    setTimeout(() => nameInput.focus(), 80);
  }
  async function mount2(root, ctx) {
    const { state: state2, navigate: navigate2 } = ctx;
    const workspace = state2.status && state2.status.workspace || "";
    root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>Prosjekter</h1>
            <p class="page-sub">${esc(workspace)}</p>
          </div>
          <div class="actions">
            <button class="btn primary" id="createProject" type="button">${icon("plus", 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>

        <div class="project-toolbar">
          <div class="search-box">
            ${icon("search", 15)}
            <input class="input" id="projectSearch" type="search" placeholder="S\xF8k i prosjekter \u2026" autocomplete="off" />
          </div>
          <span class="tiny" id="projectCount"></span>
          <div class="grow"></div>
          <button class="btn icon-btn subtle" id="refreshProjects" type="button" title="Oppdater">${icon("refresh", 16)}</button>
        </div>

        <div class="project-grid" id="projectGrid">
          ${Array.from({ length: 6 }).map(
      () => `<div class="card" style="min-height:164px;padding:16px">
                <div class="skeleton" style="width:38px;height:38px;border-radius:9px;margin-bottom:12px"></div>
                <div class="skeleton" style="height:14px;width:60%;margin-bottom:8px"></div>
                <div class="skeleton" style="height:10px;width:90%;margin-bottom:6px"></div>
                <div class="skeleton" style="height:10px;width:70%"></div>
              </div>`
    ).join("")}
        </div>
      </div>
    </div>`;
    const grid = root.querySelector("#projectGrid");
    const count = root.querySelector("#projectCount");
    const search = root.querySelector("#projectSearch");
    let projects = [];
    let filter = "";
    const openMenu = (anchor, project) => {
      menu(anchor, [
        { label: "\xC5pne i editor", icon: "edit", onClick: () => navigate2(`#/editor?project=${encodeURIComponent(project.name)}`) },
        {
          label: "Terminal her",
          icon: "terminal",
          onClick: () => navigate2(`#/terminal?project=${encodeURIComponent(project.name)}`)
        },
        { separator: true },
        {
          label: "Slett prosjekt",
          icon: "trash",
          danger: true,
          onClick: async () => {
            const ok = await confirmDialog({
              title: `Slette \xAB${project.name}\xBB?`,
              message: "Mappen flyttes til Servidor sin papirkurv. Du kan hente den tilbake derfra.",
              confirm: "Slett",
              danger: true
            });
            if (!ok) return;
            try {
              await api.del(`/api/entry?path=${encodeURIComponent(project.path)}`);
              toast("Prosjektet er slettet", "success");
              await load();
            } catch (err) {
              toast(err.message, "error");
            }
          }
        }
      ]);
    };
    function render() {
      if (!grid) return;
      const filtered = projects.filter(
        (project) => !filter || project.name.toLowerCase().includes(filter) || (project.description || "").toLowerCase().includes(filter)
      );
      if (count) {
        count.textContent = `${filtered.length} av ${projects.length}`;
      }
      if (!projects.length) {
        grid.innerHTML = `
        <div class="card" style="grid-column:1/-1">
          <div class="empty-state">
            <div class="empty-glyph">${icon("folder", 30)}</div>
            <h3>Ingen prosjekter enn\xE5</h3>
            <p>Lag et prosjekt med git, README og startfiler \u2013 eller en helt tom mappe.</p>
            <button class="btn primary" id="emptyCreate" type="button">${icon("plus", 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>`;
        const button = grid.querySelector("#emptyCreate");
        if (button) button.addEventListener("click", () => openCreateDialog({ workspace, onCreated: afterCreate }));
        return;
      }
      if (!filtered.length) {
        grid.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-glyph">${icon("search", 28)}</div><h3>Ingen treff</h3><p>Pr\xF8v et annet s\xF8keord.</p></div></div>`;
        return;
      }
      grid.innerHTML = filtered.map(projectCard).join("") + newProjectCard();
      grid.querySelectorAll("[data-project]").forEach((card) => {
        const name = card.dataset.project;
        card.addEventListener("click", (event) => {
          if (event.target.closest("[data-menu]")) return;
          navigate2(`#/editor?project=${encodeURIComponent(name)}`);
        });
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate2(`#/editor?project=${encodeURIComponent(name)}`);
          }
        });
      });
      grid.querySelectorAll("[data-menu]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const project = projects.find((item) => item.name === button.dataset.menu);
          if (project) openMenu(button, project);
        });
      });
      const newCard = grid.querySelector("#newProjectCard");
      if (newCard) newCard.addEventListener("click", () => openCreateDialog({ workspace, onCreated: afterCreate }));
    }
    function afterCreate(created) {
      navigate2(`#/editor?project=${encodeURIComponent(created.path || created.name)}`);
    }
    async function load() {
      try {
        const data = await api.get("/api/projects");
        if (!root.isConnected) return;
        projects = data.projects || [];
        state2.projects = projects;
        render();
      } catch (err) {
        if (!root.isConnected) return;
        grid.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-glyph">${icon("alert", 28)}</div><h3>Kunne ikke hente prosjekter</h3><p>${esc(err.message)}</p></div></div>`;
      }
    }
    const createButton = root.querySelector("#createProject");
    if (createButton) createButton.addEventListener("click", () => openCreateDialog({ workspace, onCreated: afterCreate }));
    const refresh = root.querySelector("#refreshProjects");
    if (refresh) refresh.addEventListener("click", () => load());
    if (search) {
      search.addEventListener("input", () => {
        filter = search.value.trim().toLowerCase();
        render();
      });
    }
    await load();
    if (ctx.query.get("new") === "1" && root.isConnected) {
      openCreateDialog({ workspace, onCreated: afterCreate });
    }
    return void 0;
  }

  // ui/js/views/editor.js
  var editor_exports = {};
  __export(editor_exports, {
    mount: () => mount3
  });
  function extOf2(path) {
    const base = String(path).split("/").pop() || "";
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  }
  function baseName2(path) {
    return String(path).split("/").pop() || String(path);
  }
  function dirName(path) {
    const parts = String(path).split("/");
    parts.pop();
    return parts.join("/");
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function highlightJs(code) {
    const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|this|super|in|of|delete|void|yield|static|get|set)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b[A-Za-z_$][\w$]*(?=\s*\())/g;
    return code.replace(re, (match, comment, string, keyword, literal, number, fn) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      if (keyword) return `<span class="tok-key">${keyword}</span>`;
      if (literal) return `<span class="tok-key">${literal}</span>`;
      if (number) return `<span class="tok-num">${number}</span>`;
      if (fn) return `<span class="tok-fn">${fn}</span>`;
      return match;
    });
  }
  function highlightPython(code) {
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|lambda|yield|global|nonlocal|pass|break|continue|async|await|self)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\s*\())/g;
    return code.replace(re, (match, comment, string, keyword, number, fn) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      if (keyword) return `<span class="tok-key">${keyword}</span>`;
      if (number) return `<span class="tok-num">${number}</span>`;
      if (fn) return `<span class="tok-fn">${fn}</span>`;
      return match;
    });
  }
  function highlightCss(code) {
    const re = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([a-zA-Z-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|fr)?\b)/g;
    return code.replace(re, (match, comment, string, prop, hex, number) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      if (prop) return `<span class="tok-attr">${prop}</span>`;
      if (hex) return `<span class="tok-num">${hex}</span>`;
      if (number) return `<span class="tok-num">${number}</span>`;
      return match;
    });
  }
  function highlightHtml(code) {
    const re = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([a-zA-Z0-9-]+)|([a-zA-Z-]+)(?==)|("(?:[^"]*)")/g;
    return code.replace(re, (match, comment, open, tag, attr, string) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (open) return `${open}<span class="tok-tag">${tag}</span>`;
      if (attr) return `<span class="tok-attr">${attr}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      return match;
    });
  }
  function highlightShell(code) {
    const re = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:[^'])*')|(\$[A-Za-z_]\w*)|\b(if|else|elseif|foreach|for|while|function|param|return|try|catch|finally|throw|switch|case|default|break|continue|exit|Write-Output|Get-ChildItem|Set-Location|New-Item|Remove-Item|Copy-Item|Move-Item|Test-Path)\b/gi;
    return code.replace(re, (match, comment, string, variable, keyword) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      if (variable) return `<span class="tok-num">${variable}</span>`;
      if (keyword) return `<span class="tok-key">${keyword}</span>`;
      return match;
    });
  }
  function highlight(code, ext) {
    const text = escapeHtml(String(code));
    if (text.length > 25e4) return text;
    try {
      if (["js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "jsonc"].includes(ext)) return highlightJs(text);
      if (["py", "pyw"].includes(ext)) return highlightPython(text);
      if (["css", "scss", "less"].includes(ext)) return highlightCss(text);
      if (["html", "htm", "xml", "svg", "vue", "svelte"].includes(ext)) return highlightHtml(text);
      if (["ps1", "sh", "bash", "zsh", "bat", "cmd"].includes(ext)) return highlightShell(text);
    } catch {
      return text;
    }
    return text;
  }
  async function mount3(root, ctx) {
    const { state: state2, navigate: navigate2 } = ctx;
    const project = ctx.query.get("project") || "";
    const initialFile = ctx.query.get("file") || "";
    if (!project) {
      navigate2("#/projects");
      return void 0;
    }
    const workspace = state2.status && state2.status.workspace || "";
    const projectName = project;
    root.innerHTML = `
    <div class="page editor-page">
      <div class="editor">
        <aside class="editor-side">
          <div class="side-head">
            <button class="btn small subtle" id="backProjects" type="button" style="align-self:flex-start">${icon("chevron-left", 14)} Prosjekter</button>
            <div class="side-project">${icon("folder", 16)}<span id="sideProjectName">${esc(projectName)}</span></div>
            <div class="side-actions">
              <button class="btn small ghost" id="newFile" type="button" title="Ny fil">${icon("file-plus", 14)} Fil</button>
              <button class="btn small ghost" id="newFolder" type="button" title="Ny mappe">${icon("folder", 14)} Mappe</button>
              <button class="btn small ghost icon-btn" id="refreshTree" type="button" title="Oppdater treet">${icon("refresh", 14)}</button>
            </div>
          </div>
          <div class="tree" id="tree">
            <div style="padding:10px"><div class="skeleton" style="height:22px;margin-bottom:6px"></div><div class="skeleton" style="height:22px;margin-bottom:6px"></div><div class="skeleton" style="height:22px"></div></div>
          </div>
        </aside>
        <section class="editor-main">
          <div class="tabs" id="tabs"></div>
          <div class="code-area" id="codeArea"></div>
          <div class="editor-status" id="editorStatus">
            <span>Klar</span>
          </div>
        </section>
      </div>
    </div>`;
    const treeEl = root.querySelector("#tree");
    const tabsEl = root.querySelector("#tabs");
    const codeArea = root.querySelector("#codeArea");
    const statusEl = root.querySelector("#editorStatus");
    const expanded = /* @__PURE__ */ new Set([project]);
    const cache = /* @__PURE__ */ new Map();
    const tabs = [];
    let activePath = null;
    let saveTimer = null;
    let disposed = false;
    let scrollByPath = /* @__PURE__ */ new Map();
    function dirOf(path) {
      return dirName(path);
    }
    async function getDir(path) {
      if (cache.has(path)) return cache.get(path);
      const data = await api.get(`/api/tree?path=${encodeURIComponent(path)}`);
      cache.set(path, data.entries || []);
      return data.entries || [];
    }
    async function renderTree() {
      try {
        const rows = [];
        const walk = async (dirPath, depth) => {
          const entries = await getDir(dirPath);
          for (const entry of entries) {
            if (disposed) return;
            const isDir = entry.type === "dir";
            const isOpen = isDir && expanded.has(entry.path);
            const active = entry.path === activePath;
            rows.push(`
            <div class="tree-row ${isDir ? "dir" : "file"} ${isOpen ? "open" : ""} ${active ? "active" : ""}"
                 data-path="${esc(entry.path)}" data-type="${entry.type}" style="padding-left:${6 + depth * 14}px">
              ${isDir ? `<span class="tree-caret">${icon("chevron-right", 11)}</span>` : '<span class="tree-caret"></span>'}
              ${icon(isDir ? isOpen ? "folder-open" : "folder" : fileIconName(entry.ext, entry.image), 15)}
              <span class="tree-name" title="${esc(entry.name)}">${esc(entry.name)}</span>
              <button class="tree-more" data-more="${esc(entry.path)}" type="button" aria-label="Meny">${icon("more", 13)}</button>
            </div>`);
            if (isDir && isOpen) await walk(entry.path, depth + 1);
          }
        };
        await walk(project, 0);
        if (!rows.length) {
          treeEl.innerHTML = `<div class="empty-state" style="padding:24px 12px"><p style="margin:0">Tomt prosjekt. Lag en fil for \xE5 komme i gang.</p></div>`;
        } else {
          treeEl.innerHTML = rows.join("");
        }
        treeEl.querySelectorAll("[data-path]").forEach((row) => {
          const path = row.dataset.path;
          const type = row.dataset.type;
          row.addEventListener("click", async (event) => {
            if (event.target.closest("[data-more]")) return;
            if (type === "dir") {
              if (expanded.has(path)) expanded.delete(path);
              else expanded.add(path);
              await renderTree();
            } else {
              await openFile(path);
            }
          });
          row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            const entry = { path, type };
            openEntryMenu(row, entry);
          });
          const more = row.querySelector("[data-more]");
          if (more) {
            more.addEventListener("click", (event) => {
              event.stopPropagation();
              const entry = { path, type };
              openEntryMenu(more, entry);
            });
          }
        });
      } catch (err) {
        treeEl.innerHTML = `<div class="empty-state" style="padding:20px 12px"><p style="margin:0">${esc(err.message)}</p></div>`;
      }
    }
    function openEntryMenu(anchor, entry) {
      const isDir = entry.type === "dir";
      menu(anchor, [
        ...isDir ? [
          {
            label: "Ny fil her",
            icon: "file-plus",
            onClick: () => createEntry("file", entry.path)
          },
          {
            label: "Ny mappe her",
            icon: "folder",
            onClick: () => createEntry("dir", entry.path)
          },
          { separator: true }
        ] : [],
        {
          label: "Gi nytt navn",
          icon: "edit",
          onClick: async () => {
            const name = await promptDialog({
              title: "Gi nytt navn",
              label: "Nytt navn",
              value: baseName2(entry.path),
              confirm: "Lagre"
            });
            if (!name || name === baseName2(entry.path)) return;
            const target = dirOf(entry.path) ? `${dirOf(entry.path)}/${name}` : name;
            try {
              await api.post("/api/rename", { from: entry.path, to: target });
              cache.clear();
              if (entry.type === "file") {
                const tab = tabs.find((item) => item.path === entry.path);
                if (tab) {
                  tab.path = target;
                  tab.name = name;
                }
                if (activePath === entry.path) {
                  activePath = target;
                  updateHash();
                }
              }
              await renderTree();
              toast("Navnet er endret", "success");
            } catch (err) {
              toast(err.message, "error");
            }
          }
        },
        {
          label: "Kopier sti",
          icon: "copy",
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(entry.path);
              toast("Stien er kopiert", "success");
            } catch {
              toast("Kunne ikke kopiere", "error");
            }
          }
        },
        { separator: true },
        {
          label: isDir ? "Slett mappen" : "Slett filen",
          icon: "trash",
          danger: true,
          onClick: async () => {
            const ok = await confirmDialog({
              title: `Slette \xAB${baseName2(entry.path)}\xBB?`,
              message: "Elementet flyttes til Servidor sin papirkurv.",
              confirm: "Slett",
              danger: true
            });
            if (!ok) return;
            try {
              await api.del(`/api/entry?path=${encodeURIComponent(entry.path)}`);
              for (let index = tabs.length - 1; index >= 0; index -= 1) {
                if (tabs[index].path === entry.path || tabs[index].path.startsWith(`${entry.path}/`)) {
                  tabs.splice(index, 1);
                }
              }
              if (activePath === entry.path || activePath && activePath.startsWith(`${entry.path}/`)) {
                activePath = tabs.length ? tabs[tabs.length - 1].path : null;
              }
              cache.clear();
              await renderTree();
              renderTabs();
              renderCode();
              toast("Slettet", "success");
            } catch (err) {
              toast(err.message, "error");
            }
          }
        }
      ]);
    }
    async function createEntry(type, parent = project) {
      const name = await promptDialog({
        title: type === "dir" ? "Ny mappe" : "Ny fil",
        label: "Navn",
        placeholder: type === "dir" ? "f.eks. src" : "f.eks. app.js",
        confirm: "Opprett"
      });
      if (!name) return;
      const path = parent ? `${parent}/${name}` : name;
      try {
        await api.post("/api/entry", { path, type });
        cache.delete(parent);
        if (type === "dir") expanded.add(path);
        await renderTree();
        if (type === "file") await openFile(path);
        toast(`${type === "dir" ? "Mappen" : "Filen"} er opprettet`, "success");
      } catch (err) {
        toast(err.message, "error");
      }
    }
    function updateHash() {
      const params = new URLSearchParams();
      params.set("project", project);
      if (activePath) params.set("file", activePath);
      history.replaceState(null, "", `#/editor?${params.toString()}`);
    }
    function activeTab() {
      return tabs.find((tab) => tab.path === activePath) || null;
    }
    async function openFile(path) {
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        activePath = path;
        renderTabs();
        renderCode();
        updateHash();
        return;
      }
      try {
        const data = await api.get(`/api/file?path=${encodeURIComponent(path)}`);
        const tab = {
          path,
          name: data.name || baseName2(path),
          language: data.language || "Tekst",
          ext: extOf2(path),
          content: data.content || "",
          original: data.content || "",
          binary: Boolean(data.binary),
          image: Boolean(data.image),
          url: data.url ? api.image(data.url) : "",
          size: data.size || 0,
          mtime: data.mtime || 0,
          scrollTop: 0,
          cursor: 0
        };
        tabs.push(tab);
        activePath = path;
        const parts = path.split("/");
        for (let i = 1; i < parts.length; i += 1) {
          expanded.add(parts.slice(0, i).join("/"));
        }
        await renderTree();
        renderTabs();
        renderCode();
        updateHash();
      } catch (err) {
        toast(err.message, "error");
      }
    }
    function closeTab(path) {
      const index = tabs.findIndex((tab) => tab.path === path);
      if (index < 0) return;
      tabs.splice(index, 1);
      if (activePath === path) {
        const next = tabs[index] || tabs[index - 1] || null;
        activePath = next ? next.path : null;
      }
      renderTabs();
      renderCode();
      updateHash();
    }
    async function tryCloseTab(tab) {
      const dirty = tab.content !== tab.original;
      if (!dirty) {
        closeTab(tab.path);
        return;
      }
      await new Promise((resolve) => {
        openDialog({
          title: "Ulagrede endringer",
          content: `<p class="dialog-text">\xAB${esc(tab.name)}\xBB har endringer som ikke er lagret.</p>`,
          width: 460,
          footer: [
            { label: "Avbryt", onClick: () => resolve(false) },
            {
              label: "Lukk uten \xE5 lagre",
              kind: "danger",
              onClick: () => {
                resolve(true);
                closeTab(tab.path);
              }
            },
            {
              label: "Lagre og lukk",
              kind: "primary",
              onClick: async () => {
                await saveTab(tab, { silent: true });
                resolve(true);
                closeTab(tab.path);
              }
            }
          ],
          onClose: () => resolve(false)
        });
      });
    }
    function renderTabs() {
      if (!tabs.length) {
        tabsEl.innerHTML = "";
        return;
      }
      tabsEl.innerHTML = tabs.map((tab) => {
        const dirty = tab.content !== tab.original;
        return `
          <div class="tab ${tab.path === activePath ? "active" : ""} ${dirty ? "dirty" : ""}" data-tab="${esc(tab.path)}" role="tab" tabindex="0">
            ${icon(tab.image ? "image" : fileIconName(tab.ext), 14)}
            <span class="tab-name" title="${esc(tab.path)}">${esc(tab.name)}</span>
            <button class="tab-close" data-close="${esc(tab.path)}" type="button" aria-label="Lukk ${esc(tab.name)}">${icon("close", 12)}</button>
          </div>`;
      }).join("");
      tabsEl.querySelectorAll("[data-tab]").forEach((node) => {
        const path = node.dataset.tab;
        node.addEventListener("click", async (event) => {
          if (event.target.closest("[data-close]")) return;
          if (activePath === path) return;
          flushSave();
          activePath = path;
          renderTabs();
          renderCode();
          updateHash();
        });
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            activePath = path;
            renderTabs();
            renderCode();
          }
        });
        const close = node.querySelector("[data-close]");
        if (close) {
          close.addEventListener("click", async (event) => {
            event.stopPropagation();
            const tab = tabs.find((item) => item.path === path);
            if (tab) await tryCloseTab(tab);
          });
        }
      });
    }
    function setStatus(tab, extra = "") {
      if (!tab) {
        statusEl.innerHTML = "<span>Ingen fil \xE5pen</span>";
        return;
      }
      const lines = tab.content.split("\n").length;
      const dirty = tab.content !== tab.original;
      statusEl.innerHTML = `
      <span>${esc(tab.language)}</span>
      <span>${fmtNumber(lines)} linjer</span>
      <span>${esc(fmtBytes(tab.size || tab.content.length))}</span>
      <span class="right">
        ${extra ? `<span>${esc(extra)}</span>` : ""}
        <span>UTF-8</span>
        <span>${dirty ? "Endret" : "Lagret"}</span>
      </span>`;
    }
    function codeTemplate(tab) {
      return `
      <div class="gutter" id="gutter"></div>
      <div class="code-wrap">
        <pre id="highlight"><code></code></pre>
        <textarea id="editorArea" spellcheck="false" wrap="off" autocomplete="off" autocapitalize="off"></textarea>
      </div>`;
    }
    function renderCode() {
      const tab = activeTab();
      if (!tab) {
        codeArea.innerHTML = `
        <div class="editor-empty">
          <div class="big-glyph">${icon("code", 32)}</div>
          <h3>Velg en fil</h3>
          <p>\xC5pne en fil i treet til venstre, eller lag en ny. Endringer lagres automatisk, og med Ctrl+S lagrer du med en gang.</p>
          <div class="actions">
            <button class="btn" id="emptyNewFile" type="button">${icon("file-plus", 16)}<span>Ny fil</span></button>
            <button class="btn" id="emptyTerminal" type="button">${icon("terminal", 16)}<span>Terminal her</span></button>
          </div>
        </div>`;
        const newFile2 = codeArea.querySelector("#emptyNewFile");
        if (newFile2) newFile2.addEventListener("click", () => createEntry("file", project));
        const terminal = codeArea.querySelector("#emptyTerminal");
        if (terminal) {
          terminal.addEventListener(
            "click",
            () => navigate2(`#/terminal?project=${encodeURIComponent(project)}`)
          );
        }
        setStatus(null);
        return;
      }
      if (tab.image) {
        codeArea.classList.add("image-mode");
        codeArea.innerHTML = `<div class="image-preview"><img src="${esc(tab.url)}" alt="${esc(tab.name)}" /></div>`;
        setStatus(tab);
        return;
      }
      codeArea.classList.remove("image-mode");
      codeArea.innerHTML = codeTemplate(tab);
      const textarea = codeArea.querySelector("#editorArea");
      const pre = codeArea.querySelector("#highlight");
      const codeEl = pre.querySelector("code");
      const gutter = codeArea.querySelector("#gutter");
      textarea.value = tab.content;
      const paint = () => {
        codeEl.innerHTML = highlight(textarea.value, tab.ext);
        const count = textarea.value.split("\n").length;
        gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join("\n");
      };
      paint();
      textarea.scrollTop = tab.scrollTop || 0;
      pre.scrollTop = textarea.scrollTop;
      gutter.scrollTop = textarea.scrollTop;
      const syncScroll = () => {
        pre.scrollTop = textarea.scrollTop;
        pre.scrollLeft = textarea.scrollLeft;
        gutter.scrollTop = textarea.scrollTop;
        tab.scrollTop = textarea.scrollTop;
      };
      textarea.addEventListener("scroll", syncScroll);
      textarea.addEventListener("input", () => {
        const wasDirty = tab.content !== tab.original;
        tab.content = textarea.value;
        tab.size = new Blob([tab.content]).size;
        paint();
        if (wasDirty !== (tab.content !== tab.original)) renderTabs();
        setStatus(tab, "Skriver \u2026");
        scheduleSave(tab);
      });
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const value = textarea.value;
          if (event.shiftKey) {
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            const slice = value.slice(lineStart, lineStart + 2);
            if (slice === "  ") {
              textarea.value = value.slice(0, lineStart) + value.slice(lineStart + 2);
              textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
            }
          } else {
            textarea.value = `${value.slice(0, start)}  ${value.slice(end)}`;
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }
          textarea.dispatchEvent(new Event("input"));
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          saveTab(tab);
        }
      });
      textarea.addEventListener("keyup", () => updateCursor(tab, textarea));
      textarea.addEventListener("click", () => updateCursor(tab, textarea));
      textarea.addEventListener("blur", () => {
        if (tab.content !== tab.original) flushSave();
      });
      textarea.focus();
      updateCursor(tab, textarea);
      setStatus(tab);
    }
    function updateCursor(tab, textarea) {
      const position = textarea.selectionStart;
      const before = textarea.value.slice(0, position);
      const line = before.split("\n").length;
      const column = position - before.lastIndexOf("\n");
      const right = statusEl.querySelector(".right");
      if (right) {
        const existing = right.querySelector(".cursor-info");
        if (existing) existing.remove();
        const span = document.createElement("span");
        span.className = "cursor-info";
        span.textContent = `Linje ${line}, kol ${column}`;
        right.prepend(span);
      }
    }
    function scheduleSave(tab) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveTab(tab, { silent: true }), 1400);
    }
    function flushSave() {
      clearTimeout(saveTimer);
      const tab = activeTab();
      if (tab && tab.content !== tab.original && !tab.image) {
        saveTab(tab, { silent: true });
      }
    }
    async function saveTab(tab, { silent = false } = {}) {
      if (!tab || tab.image) return;
      if (tab.content === tab.original) {
        if (!silent) toast("Ingen endringer \xE5 lagre", "info", 1800);
        return;
      }
      try {
        setStatus(tab, "Lagrer \u2026");
        const result = await api.put(`/api/file?path=${encodeURIComponent(tab.path)}`, { content: tab.content });
        tab.original = tab.content;
        tab.mtime = result.mtime;
        tab.size = result.size;
        renderTabs();
        setStatus(tab);
        if (!silent) toast("Lagret", "success", 1600);
      } catch (err) {
        toast(err.message, "error");
        setStatus(tab, "Lagring feilet");
      }
    }
    const back = root.querySelector("#backProjects");
    if (back) back.addEventListener("click", () => navigate2("#/projects"));
    const newFile = root.querySelector("#newFile");
    if (newFile) newFile.addEventListener("click", () => createEntry("file", project));
    const newFolder = root.querySelector("#newFolder");
    if (newFolder) newFolder.addEventListener("click", () => createEntry("dir", project));
    const refresh = root.querySelector("#refreshTree");
    if (refresh) {
      refresh.addEventListener("click", async () => {
        cache.clear();
        await renderTree();
      });
    }
    try {
      await renderTree();
      if (initialFile) {
        const target = initialFile.startsWith(`${project}/`) ? initialFile : `${project}/${initialFile}`;
        await openFile(target);
      }
    } catch (err) {
      toast(err.message, "error");
    }
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      for (const tab of tabs) {
        if (!tab.image && tab.content !== tab.original) {
          api.put(`/api/file?path=${encodeURIComponent(tab.path)}`, { content: tab.content }).catch(() => {
          });
        }
      }
    };
  }

  // ui/js/views/chat.js
  var chat_exports = {};
  __export(chat_exports, {
    mount: () => mount4
  });
  var STORAGE_KEY = "servidor.chats.v1";
  var MAX_CHATS = 30;
  var PROVIDERS = [
    { key: "gemini", label: "Gemini", short: "G" },
    { key: "deepseek", label: "DeepSeek", short: "D" },
    { key: "techai", label: "Tech-AI", short: "T" },
    { key: "custom", label: "Egen", short: "+" }
  ];
  var TOOL_LABELS = {
    list_files: "Listet filer",
    read_file: "Leste fil",
    write_file: "Skrev fil",
    edit_file: "Redigerte fil",
    append_file: "La til i fil",
    mkdir: "Opprettet mappe",
    delete_path: "Slettet",
    move_path: "Flyttet",
    copy_path: "Kopierte",
    run_command: "Kj\xF8rte kommando",
    ask_user: "Spurte brukeren",
    finish: "Fullf\xF8rte"
  };
  function providerLabel(key) {
    const found = PROVIDERS.find((item) => item.key === key);
    return found ? found.label : key;
  }
  function providerShort(key) {
    const found = PROVIDERS.find((item) => item.key === key);
    return found ? found.short : "?";
  }
  function loadChats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((chat) => chat && chat.id && Array.isArray(chat.messages));
    } catch {
      return [];
    }
  }
  function newChatObject(provider) {
    return {
      id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Ny samtale",
      provider: provider || "gemini",
      mode: "chat",
      project: "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  function stepsHtml(steps) {
    if (!steps || !steps.length) return "";
    const rows = steps.map((step) => {
      const args = step.args || {};
      let summary = "";
      if (step.name === "run_command") summary = `$ ${args.command || ""}`;
      else if (step.name === "read_file" || step.name === "write_file") summary = args.path || "";
      else if (step.name === "list_files") summary = args.path || ".";
      let output = "";
      const result = step.result || {};
      if (result.error) output = result.error;
      else if (result.stdout) output = result.stdout;
      else if (result.stderr) output = result.stderr;
      else if (step.name === "write_file") output = `Skrev ${result.bytes || 0} byte`;
      else if (step.name === "read_file") output = `${String(result.content || "").slice(0, 400)}`;
      else if (result.entries) output = result.entries.map((entry) => `${entry.type === "dir" ? "\u{1F4C1}" : "\u{1F4C4}"} ${entry.name}`).join("\n");
      const head = `${icon(step.ok ? "check" : "alert", 13, step.ok ? "" : "fail")}<strong>${esc(TOOL_LABELS[step.name] || step.name)}</strong>`;
      return `<div class="agent-step">
        <div class="agent-step-head">${head}</div>
        ${summary ? `<div class="agent-step-code">${esc(summary)}</div>` : ""}
        ${output ? `<div class="agent-step-code" style="max-height:110px">${esc(String(output).slice(0, 1200))}</div>` : ""}
      </div>`;
    }).join("");
    return `<details class="agent-steps" open><summary>${icon("layers", 13)} Agenten brukte ${steps.length} steg</summary>${rows}</details>`;
  }
  async function mount4(root, ctx) {
    const { state: state2, navigate: navigate2 } = ctx;
    const status = state2.status || {};
    const isRemote = (status.app && status.app.mode) === "remote";
    const remote = status.remote || {};
    const availability = {};
    if (isRemote) {
      availability.gemini = Boolean(remote.gemini);
      availability.deepseek = Boolean(remote.deepseek);
      availability.techai = Boolean(remote.techai);
      availability.custom = false;
    } else {
      for (const provider of status.ai && status.ai.providers || []) {
        availability[provider.key] = Boolean(provider.configured);
      }
    }
    const defaultProvider = () => {
      const preferred = state2.settings && state2.settings.ai && state2.settings.ai.defaultProvider || "gemini";
      if (availability[preferred]) return preferred;
      return Object.keys(availability).find((key) => availability[key]) || preferred;
    };
    let chats = loadChats();
    if (!chats.length) chats = [newChatObject(defaultProvider())];
    let wanted = null;
    try {
      wanted = ctx.query.get("new") === "1" ? null : localStorage.getItem("servidor.chat.active");
    } catch {
      wanted = null;
    }
    let activeId = chats.find((chat) => chat.id === wanted)?.id || chats[0].id;
    if (ctx.query.get("new") === "1") {
      const fresh = newChatObject(defaultProvider());
      chats.unshift(fresh);
      activeId = fresh.id;
    }
    let pending = null;
    let timer = null;
    let disposed = false;
    let controller = null;
    let stick = true;
    function activeChat() {
      return chats.find((chat) => chat.id === activeId) || chats[0];
    }
    function saveChats() {
      try {
        const clean = chats.slice(0, MAX_CHATS).map((chat) => ({
          ...chat,
          messages: chat.messages.slice(-200)
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        localStorage.setItem("servidor.chat.active", activeId);
      } catch {
      }
    }
    root.innerHTML = `
    <div class="page chat-page">
      <div class="chat">
        <aside class="chat-side">
          <div class="chat-side-head">
            <button class="btn primary" id="chatNewSide" type="button">${icon("plus", 15)}<span>Ny samtale</span></button>
          </div>
          <div class="chat-list" id="chatList"></div>
        </aside>
        <section class="chat-main">
          <div class="chat-top" id="chatTop"></div>
          <div class="chat-scroll" id="chatScroll">
            <div class="chat-thread" id="chatThread"></div>
          </div>
          <div class="composer">
            <div class="composer-inner">
              <div id="chatBanner"></div>
              <div class="composer-box">
                <textarea id="chatInput" rows="1" placeholder="Skriv en melding \u2026"></textarea>
                <button class="send-btn" id="chatSend" type="button" title="Send (Enter)" aria-label="Send">${icon("send", 16)}</button>
              </div>
              <div class="composer-hint">
                <span>Enter = send \xB7 Shift+Enter = ny linje</span>
                <span class="spacer"></span>
                <span id="chatContextHint">Chat-modus</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>`;
    const listEl = root.querySelector("#chatList");
    const topEl = root.querySelector("#chatTop");
    const threadEl = root.querySelector("#chatThread");
    const scrollEl = root.querySelector("#chatScroll");
    const input = root.querySelector("#chatInput");
    const sendBtn = root.querySelector("#chatSend");
    const bannerEl = root.querySelector("#chatBanner");
    const contextHint = root.querySelector("#chatContextHint");
    wireCopyButtons(threadEl);
    function renderList() {
      const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
      listEl.innerHTML = sorted.map((chat) => {
        const last = chat.messages[chat.messages.length - 1];
        const subtitle = chat.mode === "agent" ? "Agent" : "Chat";
        return `<button class="chat-item ${chat.id === activeId ? "active" : ""}" data-chat="${chat.id}" type="button">
          ${icon(chat.mode === "agent" ? "layers" : "chat", 15)}
          <span class="chat-item-main">
            <span class="chat-item-title">${esc(chat.title || "Ny samtale")}</span>
            <span class="chat-item-meta">${esc(subtitle)} \xB7 ${esc(providerLabel(chat.provider))} \xB7 ${chat.messages.length} meld.</span>
          </span>
          <span class="chat-item-del" data-del="${chat.id}" role="button" title="Slett">${icon("trash", 13)}</span>
        </button>
        ${last ? "" : ""}`;
      }).join("");
      listEl.querySelectorAll("[data-chat]").forEach((button) => {
        button.addEventListener("click", (event) => {
          if (event.target.closest("[data-del]")) return;
          const id = button.dataset.chat;
          if (id === activeId) return;
          pending = null;
          activeId = id;
          saveChats();
          renderList();
          renderTop();
          renderThread();
        });
      });
      listEl.querySelectorAll("[data-del]").forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          const id = button.dataset.del;
          const chat = chats.find((item) => item.id === id);
          if (!chat) return;
          const ok = await confirmDialog({
            title: "Slette samtalen?",
            message: `\xAB${chat.title}\xBB fjernes fra denne PC-en.`,
            confirm: "Slett",
            danger: true
          });
          if (!ok) return;
          chats = chats.filter((item) => item.id !== id);
          if (!chats.length) chats = [newChatObject(defaultProvider())];
          if (activeId === id) activeId = chats[0].id;
          saveChats();
          renderList();
          renderTop();
          renderThread();
        });
      });
    }
    function renderTop() {
      const chat = activeChat();
      const available = PROVIDERS.filter((provider) => provider.key !== "custom" || availability.custom);
      topEl.innerHTML = `
      <span class="chat-top-title" title="${esc(chat.title)}">${esc(chat.title)}</span>
      <div class="segmented" id="providerSeg">
        ${available.map(
        (provider) => `<button type="button" data-provider="${provider.key}" class="${chat.provider === provider.key ? "active" : ""}">${esc(provider.label)}</button>`
      ).join("")}
      </div>
      <div class="segmented" id="modeSeg">
        <button type="button" data-mode="chat" class="${chat.mode === "chat" ? "active" : ""}">Chat</button>
        <button type="button" data-mode="agent" class="${chat.mode === "agent" ? "active" : ""}">Agent</button>
      </div>
      <select class="select" id="chatProject" style="width:auto;max-width:190px;height:28px;font-size:11.5px">
        <option value="">Arbeidsomr\xE5det</option>
        ${(state2.projects || []).map((project) => `<option value="${esc(project.name)}" ${chat.project === project.name ? "selected" : ""}>${esc(project.name)}</option>`).join("")}
      </select>
      <span class="spacer"></span>
      <button class="btn icon-btn subtle" id="chatNewTop" type="button" title="Ny samtale">${icon("plus", 16)}</button>
    `;
      topEl.querySelectorAll("[data-provider]").forEach((button) => {
        button.addEventListener("click", () => {
          chat.provider = button.dataset.provider;
          if (chat.provider === "techai" && chat.mode === "agent") chat.mode = "chat";
          chat.updatedAt = Date.now();
          saveChats();
          renderTop();
          renderThread();
        });
      });
      topEl.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          chat.mode = button.dataset.mode;
          if (chat.mode === "agent" && chat.provider === "techai") chat.provider = "gemini";
          chat.updatedAt = Date.now();
          saveChats();
          renderTop();
          renderThread();
        });
      });
      const projectSelect = topEl.querySelector("#chatProject");
      if (projectSelect) {
        projectSelect.addEventListener("change", () => {
          chat.project = projectSelect.value;
          saveChats();
          renderThread();
        });
      }
      const newTop = topEl.querySelector("#chatNewTop");
      if (newTop) newTop.addEventListener("click", createChat);
      if (contextHint) {
        contextHint.textContent = chat.mode === "agent" ? `Agent \xB7 ${chat.project || "arbeidsomr\xE5det"}` : "Chat-modus";
      }
      input.placeholder = chat.mode === "agent" ? "Beskriv hva agenten skal gj\xF8re \u2026" : `Sp\xF8r ${providerLabel(chat.provider)} \u2026`;
      bannerEl.innerHTML = "";
      if (!availability[chat.provider] && !isRemote) {
        bannerEl.innerHTML = `<div class="no-key-banner">${icon("alert", 14)}<span>${esc(providerLabel(chat.provider))} mangler API-n\xF8kkel.</span><a href="#/settings" data-settings>Legg den inn</a></div>`;
        bannerEl.querySelector("[data-settings]").addEventListener("click", (event) => {
          event.preventDefault();
          navigate2("#/settings");
        });
      } else if (chat.mode === "agent" && chat.provider === "techai") {
        bannerEl.innerHTML = `<div class="no-key-banner">${icon("alert", 14)}<span>Agent-modus st\xF8tter ikke Tech-AI. Velg Gemini eller DeepSeek.</span></div>`;
      }
      updateSendState();
    }
    function updateSendState() {
      const chat = activeChat();
      const blocked = !availability[chat.provider] && !isRemote || chat.mode === "agent" && chat.provider === "techai";
      sendBtn.disabled = Boolean(blocked) || Boolean(pending);
      input.placeholder = pending ? chat.mode === "agent" ? "Agenten jobber \u2026" : `${providerLabel(chat.provider)} svarer \u2026` : chat.mode === "agent" ? "Beskriv hva agenten skal gj\xF8re \u2026" : `Sp\xF8r ${providerLabel(chat.provider)} \u2026`;
    }
    function thinkingHtml() {
      const chat = activeChat();
      const label = chat.mode === "agent" ? "Agenten jobber" : `${providerLabel(pending.provider)} tenker`;
      return `<div class="msg assistant" id="thinkingMsg">
      <div class="msg-avatar ${chat.provider}">${providerShort(chat.provider)}</div>
      <div class="msg-body">
        <div class="msg-name">${esc(providerLabel(chat.provider))}</div>
        <div class="thinking">
          <span class="pulse"><i></i><i></i><i></i></span>
          <span>${esc(label)} \u2026</span>
          <span class="muted" id="thinkingTime">0 s</span>
        </div>
      </div>
    </div>`;
    }
    function renderThread() {
      const chat = activeChat();
      if (!chat.messages.length && !pending) {
        threadEl.innerHTML = `
        <div class="chat-empty">
          <div class="glyph">${icon("sparkles", 30)}</div>
          <h2>Hva skal vi bygge?</h2>
          <p>${chat.mode === "agent" ? "Agenten kan lese og skrive filer og kj\xF8re kommandoer p\xE5 PC-en." : `Sp\xF8r ${esc(providerLabel(chat.provider))}, eller bytt til agent-modus for \xE5 la AI-en gj\xF8re jobben.`}</p>
          <div class="suggestions">
            <button class="suggestion" type="button" data-suggest="Lag en enkel nettside med en fin startside, og legg den i et nytt prosjekt.">Lag en nettside</button>
            <button class="suggestion" type="button" data-suggest="Se gjennom prosjektet og foresl\xE5 forbedringer. Forklar hva koden gj\xF8r.">Forklar prosjektet</button>
            <button class="suggestion" type="button" data-suggest="Kj\xF8r git status, og oppsummer hva som er endret.">Sjekk git status</button>
            <button class="suggestion" type="button" data-suggest="Lag en README med en kort beskrivelse, hvordan man installerer og hvordan man kj\xF8rer prosjektet.">Skriv README</button>
          </div>
        </div>`;
        threadEl.querySelectorAll("[data-suggest]").forEach((button) => {
          button.addEventListener("click", () => {
            input.value = button.dataset.suggest;
            input.focus();
            autoGrow();
          });
        });
        return;
      }
      const html = chat.messages.map((message, index) => {
        if (message.role === "user") {
          return `<div class="msg user"><div class="msg-body">${esc(message.content)}</div></div>`;
        }
        if (message.error) {
          return `<div class="msg assistant">
            <div class="msg-avatar ${esc(message.provider || chat.provider)}">${providerShort(message.provider || chat.provider)}</div>
            <div class="msg-body">
              <div class="msg-name">${esc(providerLabel(message.provider || chat.provider))}</div>
              <div class="chat-error">${esc(message.content)} <a href="#/settings" data-settings-inline>\xC5pne innstillinger</a></div>
            </div>
          </div>`;
        }
        return `<div class="msg assistant">
          <div class="msg-avatar ${esc(message.provider || chat.provider)}">${providerShort(message.provider || chat.provider)}</div>
          <div class="msg-body">
            <div class="msg-name">${esc(providerLabel(message.provider || chat.provider))}${message.model ? `<span class="badge">${esc(message.model)}</span>` : ""}</div>
            ${markdown(message.content)}
            ${stepsHtml(message.steps)}
            <div class="msg-actions">
              <button type="button" data-copy-msg="${index}">${icon("copy", 12)} Kopier</button>
            </div>
          </div>
        </div>`;
      }).join("");
      threadEl.innerHTML = html + (pending ? thinkingHtml() : "");
      threadEl.querySelectorAll("[data-copy-msg]").forEach((button) => {
        button.addEventListener("click", async () => {
          const message = chat.messages[Number(button.dataset.copyMsg)];
          if (!message) return;
          try {
            await navigator.clipboard.writeText(message.content);
            toast("Svaret er kopiert", "success", 1600);
          } catch {
            toast("Kunne ikke kopiere", "error");
          }
        });
      });
      threadEl.querySelectorAll("[data-settings-inline]").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          navigate2("#/settings");
        });
      });
      if (stick) {
        requestAnimationFrame(() => {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        });
      }
    }
    function autoGrow() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }
    function createChat() {
      const chat = newChatObject(defaultProvider());
      chats.unshift(chat);
      activeId = chat.id;
      pending = null;
      saveChats();
      renderList();
      renderTop();
      renderThread();
      setTimeout(() => input.focus(), 40);
    }
    async function send() {
      const chat = activeChat();
      const text = input.value.trim();
      if (!text || pending) return;
      if (!availability[chat.provider] && !isRemote) {
        toast(`${providerLabel(chat.provider)} mangler API-n\xF8kkel. \xC5pne Innstillinger \u2192 AI.`, "warning");
        return;
      }
      const userMessage = { role: "user", content: text, ts: Date.now() };
      chat.messages.push(userMessage);
      if (chat.title === "Ny samtale") {
        chat.title = text.slice(0, 44) + (text.length > 44 ? "\u2026" : "");
      }
      chat.updatedAt = Date.now();
      input.value = "";
      autoGrow();
      renderTop();
      pending = { provider: chat.provider, mode: chat.mode, startedAt: Date.now() };
      stick = true;
      renderThread();
      renderList();
      updateSendState();
      scrollEl.scrollTop = scrollEl.scrollHeight;
      const started = Date.now();
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        const node = root.querySelector("#thinkingTime");
        if (node) node.textContent = fmtDuration(Date.now() - started);
      }, 500);
      controller = new AbortController();
      try {
        const history2 = chat.messages.slice(0, -1).slice(-20).map((message) => ({
          role: message.role,
          content: message.content
        }));
        let result;
        if (chat.mode === "agent") {
          result = await api.post(
            "/api/agent",
            { provider: chat.provider, goal: text, project: chat.project, history: history2, maxSteps: 12 },
            { signal: controller.signal }
          );
          chat.messages.push({
            role: "assistant",
            provider: chat.provider,
            content: result.reply || "Agenten ga ikke noe svar.",
            steps: result.steps || [],
            model: result.model || "",
            ts: Date.now()
          });
        } else {
          result = await api.post(
            "/api/chat",
            {
              provider: chat.provider,
              project: chat.project,
              messages: [...history2, { role: "user", content: text }]
            },
            { signal: controller.signal }
          );
          chat.messages.push({
            role: "assistant",
            provider: chat.provider,
            content: result.reply || "(Tomt svar)",
            model: result.model || "",
            ts: Date.now()
          });
        }
        chat.updatedAt = Date.now();
      } catch (err) {
        if (err && err.name === "AbortError") {
          chat.messages.push({
            role: "assistant",
            provider: chat.provider,
            content: "Svaret ble avbrutt.",
            error: true,
            ts: Date.now()
          });
        } else {
          chat.messages.push({
            role: "assistant",
            provider: chat.provider,
            content: err.message || "Kunne ikke f\xE5 svar fra AI-en.",
            error: true,
            ts: Date.now()
          });
        }
      } finally {
        if (timer) clearInterval(timer);
        timer = null;
        pending = null;
        controller = null;
        saveChats();
        renderList();
        renderThread();
        updateSendState();
        input.focus();
      }
    }
    input.addEventListener("input", autoGrow);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
    input.addEventListener("blur", () => saveChats());
    sendBtn.addEventListener("click", send);
    root.querySelector("#chatNewSide").addEventListener("click", createChat);
    scrollEl.addEventListener("scroll", () => {
      const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      stick = distance < 140;
    });
    renderList();
    renderTop();
    renderThread();
    setTimeout(() => input.focus(), 60);
    saveChats();
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      if (controller) controller.abort();
      saveChats();
    };
  }

  // ui/js/views/terminal.js
  var terminal_exports = {};
  __export(terminal_exports, {
    mount: () => mount5
  });
  var HISTORY_KEY = "servidor.terminal.history.v1";
  var QUICK = [
    { label: "ls -la", command: "ls -la" },
    { label: "git status", command: "git status" },
    { label: "python3 --version", command: "python3 --version" },
    { label: "node --version", command: "node --version" },
    { label: "df -h", command: "df -h" }
  ];
  async function mount5(root, ctx) {
    const { state: state2 } = ctx;
    const status = state2.status || {};
    const app = status.app || {};
    const isRemote = app.mode === "remote";
    const project = ctx.query.get("project") || "";
    const dir = ctx.query.get("dir") || "";
    let cwd = status.workspace || "/";
    if (ctx.query.get("cwd")) cwd = ctx.query.get("cwd");
    else if (project) {
      cwd = [status.workspace || "/", project, dir].filter(Boolean).join("/").replace(/\/+/g, "/");
    }
    const promptLabel = (path) => `${path || "/"} $`;
    root.innerHTML = `
    <div class="page terminal-page">
      <div class="terminal-head">
        <div class="terminal-title">${icon("terminal", 17)}<span>Terminal</span></div>
        <span class="terminal-cwd" id="termCwd" title="${esc(cwd)}">${esc(cwd)}</span>
        <span class="badge" id="shellBadge">${isRemote ? "Ubuntu" : "PowerShell"}</span>
        <div class="actions">
          <button class="btn small ghost hidden" id="termCancel" type="button">${icon("stop", 13)}<span>Avbryt</span></button>
          <button class="btn small ghost" id="termClear" type="button">${icon("eraser", 14)}<span>T\xF8m</span></button>
        </div>
      </div>

      <div class="terminal-wrap">
        <div class="terminal">
          <div class="term-output" id="termOutput" tabindex="0"></div>
          <div class="term-input-row">
            <span class="term-input-prompt" id="termPrompt">${esc(promptLabel(cwd))}</span>
            <input class="term-input" id="termInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Skriv en kommando \u2026" />
          </div>
        </div>
        <div class="term-quick" id="termQuick">
          ${QUICK.map((item) => `<button type="button" data-command="${esc(item.command)}">${esc(item.label)}</button>`).join("")}
        </div>
      </div>
    </div>`;
    const output = root.querySelector("#termOutput");
    const input = root.querySelector("#termInput");
    const cwdLabel = root.querySelector("#termCwd");
    const promptNode = root.querySelector("#termPrompt");
    const cancelBtn = root.querySelector("#termCancel");
    let history2 = [];
    try {
      history2 = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      history2 = [];
    }
    let historyIndex = history2.length;
    let runningId = null;
    let runningLine = null;
    let disposed = false;
    function scrollToBottom() {
      output.scrollTop = output.scrollHeight;
    }
    function appendLine(text, type = "stdout") {
      const node = document.createElement("div");
      node.className = `term-line ${type}`;
      node.textContent = text;
      output.appendChild(node);
      while (output.children.length > 900) output.removeChild(output.firstChild);
      scrollToBottom();
      return node;
    }
    function appendCommand(command) {
      const node = document.createElement("div");
      node.className = "term-line command";
      node.innerHTML = `<span class="term-prompt">${esc(promptLabel(cwd))}</span> `;
      const span = document.createElement("span");
      span.textContent = command;
      node.appendChild(span);
      output.appendChild(node);
      scrollToBottom();
    }
    function updatePrompt() {
      cwdLabel.textContent = cwd;
      cwdLabel.title = cwd;
      promptNode.textContent = promptLabel(cwd);
    }
    function clearOutput() {
      output.innerHTML = "";
      welcome();
    }
    function welcome() {
      const node = document.createElement("div");
      node.className = "term-welcome";
      node.innerHTML = `<strong>Servidor Terminal</strong> \xB7 Ubuntu-serveren<br>${esc(cwd)}<br><span style="opacity:.8">Kommandoene kj\xF8rer p\xE5 serveren. \xABcd\xBB bytter mappe, \xABclear\xBB t\xF8mmer, \u2191/\u2193 henter historikk.</span><br><br>`;
      output.appendChild(node);
    }
    async function runCommand(raw2) {
      const command = String(raw2 || "").trim();
      if (!command || runningId) return;
      const lower = command.toLowerCase();
      if (lower === "cls" || lower === "clear" || lower === "clear-host") {
        clearOutput();
        input.value = "";
        return;
      }
      if (lower === "exit") {
        appendLine("Terminalen er en del av Servidor \u2013 lukk fanen for \xE5 g\xE5 ut.", "meta");
        input.value = "";
        return;
      }
      appendCommand(command);
      input.value = "";
      history2.push(command);
      if (history2.length > 120) history2.shift();
      historyIndex = history2.length;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history2.slice(-120)));
      } catch {
      }
      runningId = `term-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      cancelBtn.classList.remove("hidden");
      runningLine = appendLine("Kj\xF8rer \u2026", "meta");
      try {
        const result = await api.post("/api/shell", {
          command,
          cwd,
          timeout: 300,
          id: runningId
        });
        if (disposed || !root.isConnected) return;
        runningLine.remove();
        runningLine = null;
        if (result.cd) {
          cwd = result.cwd;
          updatePrompt();
          appendLine(`\u2192 ${cwd}`, "meta");
        } else {
          if (result.cwd && result.cwd !== cwd) {
            cwd = result.cwd;
            updatePrompt();
          }
          if (result.stdout) appendLine(result.stdout.replace(/\n+$/, ""), "stdout");
          if (result.stderr) appendLine(result.stderr.replace(/\n+$/, ""), "stderr");
          if (result.code !== 0 || result.timedOut) {
            const badge = document.createElement("div");
            badge.className = "term-line meta";
            badge.innerHTML = `<span class="term-exit">${result.timedOut ? "tidsavbrudd" : `avsluttet med kode ${result.code}`} \xB7 ${fmtDuration(result.duration)}</span>`;
            output.appendChild(badge);
          } else if (result.stdout || result.stderr) {
            appendLine(`\u2191 ${fmtDuration(result.duration)}`, "meta");
          }
          if (result.truncated) appendLine("(utskriften ble avkortet)", "meta");
          if (result.error && !result.stdout && !result.stderr) appendLine(result.error, "error");
        }
      } catch (err) {
        if (!root.isConnected) return;
        if (runningLine) {
          runningLine.remove();
          runningLine = null;
        }
        appendLine(err.message || "Kommandoen feilet", "error");
      } finally {
        runningId = null;
        cancelBtn.classList.add("hidden");
        scrollToBottom();
        input.focus();
      }
    }
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await runCommand(input.value);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!history2.length) return;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history2[historyIndex] || "";
        requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!history2.length) return;
        historyIndex = Math.min(history2.length, historyIndex + 1);
        input.value = history2[historyIndex] || "";
        requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
      } else if (event.key === "c" && event.ctrlKey) {
        event.preventDefault();
        if (runningId) {
          cancel();
        } else {
          appendLine("^C", "meta");
          input.value = "";
        }
      } else if (event.key === "l" && event.ctrlKey) {
        event.preventDefault();
        clearOutput();
      }
    });
    async function cancel() {
      if (!runningId) return;
      const id = runningId;
      try {
        await api.post("/api/shell/cancel", { id });
        if (runningLine) runningLine.textContent = "Avbryter \u2026";
      } catch (err) {
        toast(err.message, "error");
      }
    }
    root.querySelector("#termClear").addEventListener("click", clearOutput);
    cancelBtn.addEventListener("click", cancel);
    root.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => runCommand(button.dataset.command));
    });
    cwdLabel.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(cwd);
        toast("Stien er kopiert", "success", 1600);
      } catch {
      }
    });
    output.addEventListener("click", () => input.focus());
    welcome();
    input.focus();
    return () => {
      disposed = true;
    };
  }

  // ui/js/views/settings.js
  var settings_exports = {};
  __export(settings_exports, {
    mount: () => mount6
  });
  var THEMES = [
    { id: "light", label: "Lyst", icon: "sun" },
    { id: "dark", label: "M\xF8rkt", icon: "moon" },
    { id: "system", label: "System", icon: "monitor" }
  ];
  async function mount6(root, ctx) {
    const { state: state2 } = ctx;
    const status = state2.status || {};
    const providers = status.ai && status.ai.providers || [];
    const server = status.remote || {};
    const projectDir = status.workspace || "";
    const hasToken = Boolean(api.getToken());
    const currentTheme = state2.settings && state2.settings.theme || api.getTheme() || "system";
    root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>Innstillinger</h1>
            <p class="page-sub">Tilkobling, AI-assistenter og utseende. Alt arbeid skjer p\xE5 Ubuntu-serveren.</p>
          </div>
        </div>

        <div class="settings-wrap">
          <section class="card settings-card">
            <h2>Tilkobling</h2>
            <p class="settings-desc">UI-en snakker direkte med Ubuntu-serveren via Tailscale. Det finnes ingen lokal server.</p>
            <div class="settings-group">
              <div class="settings-group-head">
                <span class="provider-mark" style="background:var(--accent-soft);color:var(--accent)">S</span>
                <strong>${esc(api.origin())}</strong>
                <span class="badge ${server.online ? "success" : "danger"}" id="connBadge">${server.online ? "tilkoblet" : "utilgjengelig"}</span>
              </div>
              <p class="field-hint" style="margin:0 0 10px">
                ${esc(server.os || "Ubuntu-server")} \xB7 versjon ${esc(status.app?.version || "?")}
              </p>
              <label class="field">
                <span class="field-label">Serveradresse</span>
                <input class="input" id="serverUrlInput" type="url" autocomplete="off" spellcheck="false" value="${esc(api.origin())}" />
              </label>
              <label class="field">
                <span class="field-label">X-API-Token</span>
                <div class="key-row">
                  <input class="input" id="tokenInput" type="password" autocomplete="off" spellcheck="false"
                    placeholder="${hasToken ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (lagret)" : "API_TOKEN fra din Ubuntu-server"}" />
                  <button class="btn icon-btn subtle" id="showToken" type="button" title="Vis/skjul">${icon("keyboard", 15)}</button>
                </div>
              </label>
              <div class="field-row">
                <button class="btn primary" id="saveToken" type="button">${icon("check", 15)}<span>Lagre</span></button>
                <button class="btn ghost" id="testConn" type="button">${icon("wifi", 15)}<span>Test tilkobling</span></button>
                <button class="btn subtle" id="logout" type="button">${icon("close", 15)}<span>Logg ut</span></button>
                <span class="test-result" id="connResult"></span>
              </div>
              <p class="field-hint">Hent API_TOKEN fra din egen Ubuntu-servers <code>backend/.env</code>. Tokenet lagres bare i denne Windows-brukerens nettleserprofil.</p>
            </div>
          </section>

          <section class="card settings-card">
            <h2>AI-assistenter</h2>
            <p class="settings-desc">N\xF8klene ligger p\xE5 serveren i <code>backend/.env</code>. Her ser du hvilke agenter som er klare.</p>
            <div class="settings-group">
              ${providers.length ? providers.map((provider) => `
                <div class="provider-row">
                  <span class="provider-mark ${esc(provider.key)}">${esc((provider.label || provider.key).slice(0, 1))}</span>
                  <span class="provider-name">${esc(provider.label || provider.key)}</span>
                  <span class="provider-state">${provider.configured ? "klar" : "mangler n\xF8kkel"}</span>
                  <span class="dot ${provider.configured ? "" : "off"}"></span>
                  ${provider.configured ? `<button class="btn small subtle" data-test-provider="${esc(provider.key)}" type="button">Test</button>` : ""}
                </div>`).join("") : '<p class="field-hint" style="margin:0">Ingen agenter rapportert fra serveren.</p>'}
            </div>
            <p class="field-hint">${esc(status.ai?.default ? `Standard: ${status.ai.default}` : "")}</p>
          </section>

          <section class="card settings-card">
            <h2>Utseende</h2>
            <p class="settings-desc">Lagres i denne nettleseren. \xABSystem\xBB f\xF8lger Windows.</p>
            <div class="theme-options">
              ${THEMES.map((theme) => `
                <button class="theme-card ${currentTheme === theme.id ? "selected" : ""}" data-theme-choice="${theme.id}" type="button">
                  <span class="theme-preview ${theme.id === "dark" ? "dark" : "light"}">
                    <span class="tp-side"></span>
                    <span class="tp-main"><span class="tp-line accent"></span><span class="tp-line"></span><span class="tp-line" style="width:70%"></span></span>
                  </span>
                  <span class="theme-label">${icon(theme.icon, 14)}<span>${theme.label}</span></span>
                </button>`).join("")}
            </div>
          </section>

          <section class="card settings-card">
            <h2>Om serveren</h2>
            <div class="about-grid">
              <dt>Adresse</dt><dd>${esc(api.origin())}</dd>
              <dt>OS</dt><dd>${esc(server.os || "Linux")}</dd>
              <dt>Versjon</dt><dd>${esc(status.app?.version || "?")}</dd>
              <dt>Prosjektmappe</dt><dd>${esc(projectDir)}</dd>
              <dt>Shell</dt><dd>${status.shell?.enabled ? "aktivert" : "avsl\xE5tt"}</dd>
              <dt>Agentmodus</dt><dd>kj\xF8rer p\xE5 serveren</dd>
            </div>
            <div class="divider"></div>
            <div class="shortcut-list">
              <div class="shortcut-row"><span>Kommandopalett</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">K</span></span></div>
              <div class="shortcut-row"><span>Skjul navigasjon</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">B</span></span></div>
              <div class="shortcut-row"><span>Lagre fil</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">S</span></span></div>
            </div>
          </section>
        </div>
      </div>
    </div>`;
    const tokenInput = root.querySelector("#tokenInput");
    const serverUrlInput = root.querySelector("#serverUrlInput");
    const showToken = root.querySelector("#showToken");
    const connResult = root.querySelector("#connResult");
    showToken.addEventListener("click", () => {
      tokenInput.type = tokenInput.type === "password" ? "text" : "password";
    });
    root.querySelector("#saveToken").addEventListener("click", async () => {
      const value = tokenInput.value.trim();
      const serverUrl = serverUrlInput.value.trim();
      if (!value) {
        toast("Skriv inn API-token f\xF8rst", "warning");
        tokenInput.focus();
        return;
      }
      try {
        const parsed = new URL(serverUrl);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("Bruk http:// eller https://");
      } catch (err) {
        toast("Ugyldig serveradresse: " + err.message, "error");
        serverUrlInput.focus();
        return;
      }
      api.setServerUrl(serverUrl);
      api.setToken(value);
      try {
        await ctx.reload();
        toast("Tilkobling lagret", "success");
        ctx.navigate("#/settings");
      } catch (err) {
        api.clearToken();
        toast(err.message, "error");
      }
    });
    root.querySelector("#testConn").addEventListener("click", async () => {
      connResult.className = "test-result";
      connResult.textContent = "Tester \u2026";
      try {
        const data = await api.get("/api/status");
        connResult.className = "test-result ok";
        connResult.textContent = `OK \u2013 ${data.remote?.os || "server"} \xB7 ${data.app?.version || ""}`;
        const badge = root.querySelector("#connBadge");
        if (badge) {
          badge.className = "badge success";
          badge.textContent = "tilkoblet";
        }
      } catch (err) {
        connResult.className = "test-result fail";
        connResult.textContent = err.message;
      }
    });
    root.querySelector("#logout").addEventListener("click", () => {
      api.clearToken();
      location.reload();
    });
    root.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = button.dataset.themeChoice;
        api.setTheme(theme);
        if (state2.settings) state2.settings.theme = theme;
        root.querySelectorAll("[data-theme-choice]").forEach((item) => item.classList.toggle("selected", item === button));
        ctx.applyTheme();
      });
    });
    root.querySelectorAll("[data-test-provider]").forEach((button) => {
      button.addEventListener("click", async () => {
        const provider = button.dataset.testProvider;
        button.disabled = true;
        button.textContent = "Tester \u2026";
        try {
          const result = await api.post("/api/ai/test", { provider });
          if (result.ok) {
            button.textContent = `OK (${result.ms} ms)`;
          } else {
            button.textContent = "Feilet";
          }
        } catch (err) {
          button.textContent = "Feilet";
          toast(err.message, "error");
        }
        setTimeout(() => {
          button.disabled = false;
          button.textContent = "Test";
        }, 2500);
      });
    });
    return void 0;
  }

  // ui/js/app.js
  var state = {
    status: null,
    settings: null,
    stats: null,
    projects: [],
    theme: "dark",
    bootedAt: Date.now()
  };
  var VIEWS = {
    home: home_exports,
    projects: projects_exports,
    editor: editor_exports,
    chat: chat_exports,
    terminal: terminal_exports,
    settings: settings_exports
  };
  var NAV_ITEMS = [
    { id: "home", label: "Hjem", icon: "home", hash: "#/home" },
    { id: "projects", label: "Prosjekter", icon: "folder", hash: "#/projects" },
    { id: "chat", label: "Chat", icon: "chat", hash: "#/chat" },
    { id: "terminal", label: "Terminal", icon: "terminal", hash: "#/terminal" }
  ];
  var bind = window.servidor || null;
  var currentCleanup = null;
  var routeToken = 0;
  var navCollapsed = false;
  function applyTheme() {
    const preference = state.settings && state.settings.theme || getTheme() || "system";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = preference === "dark" || preference === "system" && systemDark;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    state.theme = dark ? "dark" : "light";
  }
  function renderNav() {
    const items = document.getElementById("navItems");
    const footer = document.getElementById("navFooter");
    if (!items || !footer) return;
    items.innerHTML = `
    <div class="nav-group-label">Arbeidsomr\xE5de</div>
    ${NAV_ITEMS.map(
      (item) => `
      <button class="nav-item" data-route="${item.hash}" data-nav="${item.id}" type="button" title="${esc(item.label)}">
        ${icon(item.icon, 18)}
        <span class="nav-label">${esc(item.label)}</span>
      </button>`
    ).join("")}
  `;
    footer.innerHTML = `
    <div class="nav-status" id="navStatus"></div>
    <button class="nav-item" data-route="#/settings" data-nav="settings" type="button" title="Innstillinger">
      ${icon("settings", 18)}
      <span class="nav-label">Innstillinger</span>
    </button>
    <button class="nav-item nav-collapse" id="navCollapse" type="button" title="Skjul navigasjonen (Ctrl+B)">
      ${icon("panel", 18)}
      <span class="nav-label">Skjul</span>
    </button>
  `;
    items.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });
    footer.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });
    const collapse = document.getElementById("navCollapse");
    if (collapse) {
      collapse.addEventListener("click", () => {
        navCollapsed = !navCollapsed;
        document.getElementById("nav").classList.toggle("collapsed", navCollapsed);
        try {
          localStorage.setItem("servidor.navCollapsed", navCollapsed ? "1" : "0");
        } catch {
        }
      });
    }
    updateNavStatus();
  }
  function updateNavStatus() {
    const node = document.getElementById("navStatus");
    if (!node) return;
    if (!state.status) {
      node.innerHTML = '<span class="status-dot off"></span><span class="nav-status-text">Ikke tilkoblet</span>';
      node.title = "Ikke tilkoblet";
      return;
    }
    const remote = state.status.remote;
    let text = "Lokal";
    let dot = "status-dot";
    if (remote && remote.enabled) {
      if (remote.online) {
        text = `Server \xB7 ${(remote.os || "Linux").split(" ")[0]}`;
      } else {
        text = "Server utilgjengelig";
        dot = "status-dot off";
      }
    } else if (state.status) {
      text = `Lokal \xB7 ${state.status.app.hostname}`;
    }
    node.innerHTML = `<span class="${dot}"></span><span class="nav-status-text">${esc(text)}</span>`;
    node.title = text;
  }
  function setActiveNav(name) {
    const active = name === "editor" ? "projects" : name;
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.classList.toggle("active", button.dataset.nav === active);
    });
  }
  function parseRoute() {
    const raw2 = location.hash.replace(/^#\/?/, "") || "home";
    const [name, queryString = ""] = raw2.split("?");
    return { name: name || "home", query: new URLSearchParams(queryString) };
  }
  function navigate(hash) {
    if (location.hash === hash) {
      renderRoute();
      return;
    }
    location.hash = hash;
  }
  async function renderRoute() {
    if (!api.getToken()) {
      showConnect();
      return;
    }
    const { name, query } = parseRoute();
    const view = VIEWS[name] || VIEWS.home;
    const token = ++routeToken;
    if (currentCleanup) {
      try {
        currentCleanup();
      } catch {
      }
      currentCleanup = null;
    }
    setActiveNav(name);
    const container = document.getElementById("view");
    container.innerHTML = "";
    container.scrollTop = 0;
    document.title = `${name === "home" ? "Hjem" : name[0].toUpperCase() + name.slice(1)} \xB7 Servidor`;
    const context = {
      query,
      state,
      navigate,
      reload: loadBootstrap,
      applyTheme,
      onSettingsChanged: async () => {
        await loadBootstrap();
        updateNavStatus();
      }
    };
    try {
      const cleanup = await view.mount(container, context);
      if (token !== routeToken) {
        if (typeof cleanup === "function") cleanup();
        return;
      }
      currentCleanup = typeof cleanup === "function" ? cleanup : null;
    } catch (err) {
      if (token !== routeToken) return;
      console.error(err);
      container.innerHTML = `
      <div class="page"><div class="page-inner">
        <div class="empty-state">
          <div class="empty-glyph">${icon("alert", 30)}</div>
          <h3>Noe gikk galt</h3>
          <p>${esc(err.message || "Ukjent feil")}</p>
        </div>
      </div></div>`;
    }
  }
  async function loadBootstrap() {
    const data = await api.get("/api/settings");
    const projects = await api.get("/api/projects").catch((err) => {
      if (err instanceof AuthError) throw err;
      return { projects: [] };
    });
    state.settings = data.settings;
    state.status = data.status;
    state.projects = projects.projects || [];
    applyTheme();
    updateNavStatus();
    return data;
  }
  function showOffline(error) {
    const container = document.getElementById("view");
    container.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="empty-state" style="min-height: 70vh">
        <div class="empty-glyph">${icon("server", 30)}</div>
        <h3>F\xE5r ikke kontakt med Ubuntu-serveren</h3>
        <p>${esc(error.message || "Serveren svarer ikke.")}</p>
        <p class="tiny">Sjekk at Tailscale er tilkoblet p\xE5 denne PC-en, og at tjenesten kj\xF8rer p\xE5 serveren.</p>
        <button class="btn primary" id="retryBoot" type="button">${icon("refresh", 16)}<span>Pr\xF8v igjen</span></button>
      </div>
    </div></div>`;
    const retry = document.getElementById("retryBoot");
    if (retry) {
      retry.addEventListener("click", async () => {
        try {
          await loadBootstrap();
          renderRoute();
        } catch (err) {
          if (err instanceof AuthError) {
            api.clearToken();
            showConnect(err.message);
            return;
          }
          toast(err.message, "error");
        }
      });
    }
  }
  function showConnect(message = "") {
    const container = document.getElementById("view");
    if (!container) return;
    if (currentCleanup) {
      try {
        currentCleanup();
      } catch {
      }
      currentCleanup = null;
    }
    document.title = "Koble til \xB7 Servidor";
    container.innerHTML = `
    <div class="page">
      <div class="page-inner" style="max-width:560px;margin-top:8vh">
        <div class="card" style="padding:26px">
          <div class="row" style="gap:10px;margin-bottom:6px">
            <div class="empty-glyph" style="width:42px;height:42px;border-radius:11px;margin:0">${icon("server", 22)}</div>
            <div>
              <h1 style="margin:0;font-size:22px">Koble til Ubuntu-serveren</h1>
              <p class="muted" style="margin:2px 0 0;font-size:12px">Windows-klient \xB7 UI kj\xF8rer lokalt</p>
            </div>
          </div>
          <p class="muted" style="font-size:12.5px;line-height:1.5">
            Dette er en klient til Ubuntu-serveren din. Prosjekter, filer, terminal og AI-kall behandles p\xE5 serveren via Tailscale.
          </p>
          <label class="field">
            <span class="field-label">Serveradresse</span>
            <input class="input" id="connectUrl" type="url" autocomplete="off" spellcheck="false"
              value="${esc(getServerUrl())}" placeholder="http://<Ubuntu-Tailscale-IP>:8000" />
          </label>
          <label class="field">
            <span class="field-label">X-API-Token</span>
            <input class="input" id="connectToken" type="password" autocomplete="off" spellcheck="false" placeholder="Lim inn API-token" />
          </label>
          <p class="test-result fail" id="connectError" style="${message ? "" : "display:none"}">${esc(message)}</p>
          <div class="field-row">
            <button class="btn primary" id="connectBtn" type="button">${icon("link", 15)}<span>Koble til</span></button>
            <span class="tiny">Bruk Ubuntu-serverens Tailscale-IP, ikke Windows-PC-ens.</span>
          </div>
        </div>
      </div>
    </div>`;
    const urlInput = document.getElementById("connectUrl");
    const input = document.getElementById("connectToken");
    const button = document.getElementById("connectBtn");
    const errorBox = document.getElementById("connectError");
    const connect = async () => {
      const serverUrl = urlInput.value.trim();
      const token = input.value.trim();
      if (!serverUrl || !token) {
        errorBox.style.display = "block";
        errorBox.textContent = "B\xE5de serveradresse og token m\xE5 fylles ut.";
        (serverUrl ? input : urlInput).focus();
        return;
      }
      try {
        const parsed = new URL(serverUrl);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("Bruk http:// eller https://");
      } catch (err) {
        errorBox.style.display = "block";
        errorBox.textContent = "Ugyldig serveradresse: " + err.message;
        urlInput.focus();
        return;
      }
      button.disabled = true;
      errorBox.style.display = "none";
      api.setServerUrl(serverUrl);
      api.setToken(token);
      try {
        await loadBootstrap();
        await renderRoute();
      } catch (err) {
        api.clearToken();
        errorBox.style.display = "block";
        errorBox.textContent = err.message || "Kunne ikke koble til.";
        button.disabled = false;
        input.focus();
        input.select();
      }
    };
    button.addEventListener("click", connect);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") connect();
    });
    urlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") connect();
    });
    setTimeout(() => input.focus(), 80);
  }
  function paletteActions() {
    const actions = [
      ...NAV_ITEMS.map((item) => ({
        group: "G\xE5 til",
        label: item.label,
        icon: item.icon,
        sub: `Ctrl+${NAV_ITEMS.indexOf(item) + 1}`,
        run: () => navigate(item.hash)
      })),
      {
        group: "G\xE5 til",
        label: "Innstillinger",
        icon: "settings",
        sub: "Ctrl+5",
        run: () => navigate("#/settings")
      },
      {
        group: "Handlinger",
        label: "Nytt prosjekt",
        icon: "folder",
        run: () => navigate("#/projects?new=1")
      },
      {
        group: "Handlinger",
        label: "Ny samtale",
        icon: "chat",
        run: () => navigate("#/chat?new=1")
      },
      {
        group: "Handlinger",
        label: "Ny terminal",
        icon: "terminal",
        run: () => navigate("#/terminal")
      },
      {
        group: "Handlinger",
        label: "Bytt tema",
        icon: state.theme === "dark" ? "sun" : "moon",
        sub: state.settings ? `N\xE5: ${state.settings.theme}` : "",
        run: async () => {
          const order = ["system", "light", "dark"];
          const current = state.settings && state.settings.theme || "system";
          const next = order[(order.indexOf(current) + 1) % order.length];
          try {
            const data = await api.put("/api/settings", { theme: next });
            state.settings = data.settings;
            applyTheme();
            toast(`Tema: ${next === "system" ? "system" : next === "dark" ? "m\xF8rkt" : "lyst"}`, "success");
          } catch (err) {
            toast(err.message, "error");
          }
        }
      },
      {
        group: "Handlinger",
        label: "Oppdater data",
        icon: "refresh",
        run: async () => {
          await loadBootstrap();
          renderRoute();
          toast("Oppdatert", "success");
        }
      }
    ];
    return actions;
  }
  function openPalette() {
    if (document.querySelector(".palette-backdrop")) return;
    const backdrop = document.createElement("div");
    backdrop.className = "palette-backdrop";
    backdrop.innerHTML = `
    <div class="palette">
      <div class="palette-input-row">
        ${icon("search", 16)}
        <input class="palette-input" type="text" placeholder="S\xF8k etter side eller handling \u2026" autocomplete="off" spellcheck="false" />
        <span class="kbd">Esc</span>
      </div>
      <div class="palette-results"></div>
    </div>`;
    document.getElementById("overlayRoot").appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("in"));
    const input = backdrop.querySelector(".palette-input");
    const results = backdrop.querySelector(".palette-results");
    const all = paletteActions();
    let filtered = all;
    let selected = 0;
    const render = () => {
      const query = input.value.trim().toLowerCase();
      filtered = query ? all.filter((action) => action.label.toLowerCase().includes(query) || (action.sub || "").toLowerCase().includes(query)) : all;
      selected = Math.min(selected, Math.max(0, filtered.length - 1));
      if (!filtered.length) {
        results.innerHTML = '<div class="palette-empty">Ingen treff</div>';
        return;
      }
      let group = "";
      results.innerHTML = filtered.map((action, index) => {
        const header = action.group && action.group !== group ? `<div class="palette-group">${esc(action.group)}</div>` : "";
        group = action.group || group;
        return `${header}<button class="palette-item ${index === selected ? "selected" : ""}" data-index="${index}" type="button">
          ${icon(action.icon, 16)}<span>${esc(action.label)}</span>
          ${action.sub ? `<span class="palette-sub">${esc(action.sub)}</span>` : ""}
        </button>`;
      }).join("");
      results.querySelectorAll(".palette-item").forEach((button) => {
        button.addEventListener("mouseenter", () => {
          selected = Number(button.dataset.index);
          results.querySelectorAll(".palette-item").forEach((item) => item.classList.toggle("selected", item === button));
        });
        button.addEventListener("click", () => run(Number(button.dataset.index)));
      });
    };
    const close = () => {
      backdrop.classList.remove("in");
      document.removeEventListener("keydown", onKey, true);
      setTimeout(() => backdrop.remove(), 140);
    };
    const run = (index) => {
      const action = filtered[index];
      if (!action) return;
      close();
      setTimeout(() => action.run(), 30);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selected = Math.min(selected + 1, filtered.length - 1);
        render();
        const active = results.querySelector(".palette-item.selected");
        if (active) active.scrollIntoView({ block: "nearest" });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selected = Math.max(selected - 1, 0);
        render();
        const active = results.querySelector(".palette-item.selected");
        if (active) active.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        event.preventDefault();
        run(selected);
      }
    };
    input.addEventListener("input", () => {
      selected = 0;
      render();
    });
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", onKey, true);
    render();
    setTimeout(() => input.focus(), 30);
  }
  function setupWindowControls() {
    const minimize = document.getElementById("winMin");
    const maximize = document.getElementById("winMax");
    const close = document.getElementById("winClose");
    if (minimize) minimize.innerHTML = icon("minus", 16);
    if (maximize) maximize.innerHTML = icon("maximize", 14);
    if (close) close.innerHTML = icon("close", 16);
    if (!bind) return;
    document.body.classList.add("electron");
    minimize && minimize.addEventListener("click", () => bind.window.minimize());
    maximize && maximize.addEventListener("click", () => bind.window.maximize());
    close && close.addEventListener("click", () => bind.window.close());
    if (bind.window.onMaximized) {
      bind.window.onMaximized((maximized) => {
        if (maximize) maximize.innerHTML = icon(maximized ? "restore" : "maximize", 14);
      });
    }
    const titlebar = document.getElementById("titlebar");
    if (titlebar) {
      titlebar.addEventListener("dblclick", (event) => {
        if (event.target.closest("button, input")) return;
        bind.window.maximize();
      });
    }
  }
  function setupShortcuts() {
    document.addEventListener("keydown", (event) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        openPalette();
      } else if (key === "b") {
        event.preventDefault();
        document.getElementById("nav").classList.toggle("collapsed");
        navCollapsed = document.getElementById("nav").classList.contains("collapsed");
        try {
          localStorage.setItem("servidor.navCollapsed", navCollapsed ? "1" : "0");
        } catch {
        }
      } else if (["1", "2", "3", "4", "5"].includes(key)) {
        event.preventDefault();
        const target = [...NAV_ITEMS.map((item) => item.hash), "#/settings"][Number(key) - 1];
        if (target) navigate(target);
      }
    });
  }
  async function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get("shell") === "edge") document.body.classList.add("edge-shell");
    const logoNode = document.getElementById("tbLogo");
    if (logoNode) logoNode.innerHTML = logo(22);
    const searchIcon = document.getElementById("tbSearchIcon");
    if (searchIcon) searchIcon.innerHTML = icon("search", 14);
    setupWindowControls();
    renderNav();
    setupShortcuts();
    const paletteBtn = document.getElementById("paletteBtn");
    if (paletteBtn) paletteBtn.addEventListener("click", openPalette);
    try {
      navCollapsed = localStorage.getItem("servidor.navCollapsed") === "1";
    } catch {
      navCollapsed = false;
    }
    if (navCollapsed) document.getElementById("nav").classList.add("collapsed");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());
    window.addEventListener("hashchange", renderRoute);
    if (!api.getToken()) {
      showConnect();
      return;
    }
    try {
      await loadBootstrap();
      await renderRoute();
    } catch (err) {
      console.error(err);
      if (err instanceof AuthError) {
        api.clearToken();
        showConnect(err.message);
      } else {
        showOffline(err);
      }
    }
    window.addEventListener("focus", () => {
      if (state.settings) updateNavStatus();
    });
  }
  boot();
})();
