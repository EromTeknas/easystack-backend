# EasyStack Ubuntu Development Startup — Complete Setup

This guide documents the full setup to start EasyStack's local development environment automatically after logging in to Ubuntu. It includes the startup script itself, desktop autostart configuration, testing, and troubleshooting.

## What this setup does

At desktop login, the startup script will attempt to:

1. Open the backend and frontend projects in separate VS Code windows.
2. Open a terminal for the backend, run `sh start.sh`, and run `npm run dev` only if `start.sh` succeeds.
3. Open a separate terminal and run `npm run dev` for the frontend.
4. Open Antigravity with the backend project if the application is available.
5. Open Brave at `http://localhost:3000` if Brave is available.

**Important:** The backend and frontend commands run in separate GNOME Terminal windows, not in VS Code's integrated terminals. The script assumes `start.sh` is at the backend project root.

## 1. Expected paths

This guide assumes the Linux username is `eteknas` and the projects are located here:

- Backend: `/home/eteknas/Projects/easystack-backend`
- Frontend: `/home/eteknas/Projects/easystack-frontend`
- Startup script: `/home/eteknas/bin/start-easystack.sh`
- Backend startup script: `/home/eteknas/Projects/easystack-backend/start.sh`

If your directories differ, edit the paths in the script before continuing.

## 2. Check prerequisites

Confirm that the project directories and backend startup script exist:

```bash
ls -ld ~/Projects/easystack-backend
ls -ld ~/Projects/easystack-frontend
ls -l ~/Projects/easystack-backend/start.sh
```

Check that the required commands are available:

```bash
command -v code
command -v gnome-terminal
command -v antigravity
command -v brave-browser || command -v brave
```

Some applications may be installed through a different package or command name. The startup script skips an application if it cannot find its command.

## 3. Create the startup script

Create the `~/bin` directory:

```bash
mkdir -p ~/bin
```

Open the script in an editor:

```bash
nano ~/bin/start-easystack.sh
```

Paste the complete script below, then save and exit (`Ctrl+O`, Enter, `Ctrl+X` in Nano).

```bash
#!/usr/bin/env bash
# Start the EasyStack local development environment after Ubuntu desktop login.
# Review the paths and application commands below before running.

set -Eeuo pipefail

BACKEND_DIR="/home/eteknas/Projects/easystack-backend"
FRONTEND_DIR="/home/eteknas/Projects/easystack-frontend"
BACKEND_START="$BACKEND_DIR/start.sh"
URL="http://localhost:3000"

log() {
  printf '[EasyStack] %s\n' "$*"
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    log "ERROR: directory not found: $1"
    exit 1
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "WARNING: command not found: $1"
    return 1
  fi
}

# Confirm the project directories exist before opening anything.
require_dir "$BACKEND_DIR"
require_dir "$FRONTEND_DIR"

# Open each project in a separate VS Code window.
if require_command code; then
  code --new-window "$BACKEND_DIR" >/dev/null 2>&1 &
  sleep 1
  code --new-window "$FRONTEND_DIR" >/dev/null 2>&1 &
else
  log "VS Code was not found; skipping IDE launch."
fi

# Start backend infrastructure, then start the backend development server.
# This terminal stays open so logs remain visible.
if require_command gnome-terminal; then
  if [[ -f "$BACKEND_START" ]]; then
    gnome-terminal --title="EasyStack Backend" -- bash -lc \
      "cd '$BACKEND_DIR' && sh start.sh && npm run dev; status=\$?; echo; echo 'Backend terminal exited with status:' \$status; exec bash" &
  else
    log "WARNING: backend start script not found: $BACKEND_START"
  fi

  # Start the frontend development server in its own terminal.
  gnome-terminal --title="EasyStack Frontend" -- bash -lc \
    "cd '$FRONTEND_DIR' && npm run dev; status=\$?; echo; echo 'Frontend terminal exited with status:' \$status; exec bash" &
else
  log "WARNING: gnome-terminal was not found; skipping dev-server terminals."
fi

# Open Antigravity if installed. --new-window support may vary by version.
if command -v antigravity >/dev/null 2>&1; then
  antigravity --new-window "$BACKEND_DIR" >/dev/null 2>&1 &
elif [[ -x /opt/antigravity/antigravity ]]; then
  /opt/antigravity/antigravity --new-window "$BACKEND_DIR" >/dev/null 2>&1 &
else
  log "Antigravity was not found; skipping."
fi

# Open Brave at the local frontend URL. It may initially show an error
# while the frontend server is starting; refresh once the server is ready.
if command -v brave-browser >/dev/null 2>&1; then
  brave-browser "$URL" >/dev/null 2>&1 &
elif command -v brave >/dev/null 2>&1; then
  brave "$URL" >/dev/null 2>&1 &
else
  log "Brave was not found; skipping browser launch."
fi

log "Startup commands launched. Check the backend/frontend terminal windows for errors."
```

Make it executable:

```bash
chmod +x ~/bin/start-easystack.sh
```

## 4. Understand the backend `start.sh` and sudo

The startup script runs these backend commands in sequence:

```bash
cd /home/eteknas/Projects/easystack-backend
sh start.sh
npm run dev
```

Because the commands use `&&`, the backend's `npm run dev` starts only if `sh start.sh` exits successfully.

If `start.sh` needs administrator permissions, avoid running the entire development server as root. Use `sudo` only for the specific administrative operations that need it.

For example, if you have deliberately configured a privileged helper at `/usr/local/sbin/easystack-start`, the backend's `start.sh` could contain:

```bash
#!/usr/bin/env bash
set -e

sudo /usr/local/sbin/easystack-start
```

Then the startup script above will continue to `npm run dev` only when that helper succeeds.

### Security warning about passwordless sudo

A passwordless `sudo` rule can be dangerous if it allows a root-owned helper to execute a Docker Compose file that your normal user can edit. Compose files can define privileged containers, host mounts, and commands, potentially giving root-level access to the machine.

- Do not grant broad access such as `eteknas ALL=(ALL) NOPASSWD: ALL`.
- Keep privileged helper scripts root-owned and not writable by your normal user.
- Understand that Docker access itself is effectively root-level access.
- Validate sudoers changes with `sudo visudo -c`.
- If unsure, keep the normal password prompt or avoid restarting services on every login.

Check whether Docker and MongoDB are already running:

```bash
systemctl is-active docker
systemctl is-active mongod
```

If you want them to start at system boot, you can enable them once:

```bash
sudo systemctl enable --now docker
sudo systemctl enable --now mongod
```

Only do this if those services are installed and you want them enabled at boot. Your `start.sh` may still need to start the project's containers.

## 5. Test the startup script manually

Before enabling autostart, run:

```bash
~/bin/start-easystack.sh
```

Confirm that:

- VS Code opens the backend and frontend in separate windows.
- The backend terminal runs `start.sh`, followed by `npm run dev` if successful.
- The frontend terminal runs `npm run dev`.
- Antigravity opens if installed.
- Brave opens `http://localhost:3000`.

Brave may open before the frontend server is ready. If the page initially fails to load, wait for the frontend terminal to report that it is ready, then refresh the browser.

## 6. Configure Ubuntu autostart

This runs the script after you log in to your Ubuntu desktop; it does not run before login.

Create the autostart directory:

```bash
mkdir -p ~/.config/autostart
```

Create the desktop entry:

```bash
cat > ~/.config/autostart/easystack.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=EasyStack Startup
Comment=Start EasyStack development environment
Exec=/home/eteknas/bin/start-easystack.sh
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
```

Check it:

```bash
cat ~/.config/autostart/easystack.desktop
```

Make sure the `Exec` path exactly matches the script location.

### Alternative: use Startup Applications

Instead of creating the `.desktop` file manually:

1. Open **Startup Applications** from Ubuntu's applications menu.
2. Click **Add**.
3. Set **Name** to `EasyStack Startup`.
4. Set **Command** to `/home/eteknas/bin/start-easystack.sh`.
5. Save the entry.

Use either the `.desktop` file or the GUI method; you do not need both.

## 7. Test autostart

Log out and log back in, or restart the computer. After login, check that the applications and terminal windows appear.

If something fails, run the script manually in a terminal so you can see any errors:

```bash
~/bin/start-easystack.sh
```

You can also inspect user-session logs:

```bash
journalctl --user -b --no-pager
```

## 8. Disable or remove autostart

To temporarily disable it:

```bash
mv ~/.config/autostart/easystack.desktop \
   ~/.config/autostart/easystack.desktop.disabled
```

To remove the entry completely:

```bash
rm ~/.config/autostart/easystack.desktop
```

The script itself remains at `~/bin/start-easystack.sh`; removing the autostart entry does not delete it.

## Troubleshooting

### `start.sh` asks for a sudo password

That can be expected when the script performs privileged operations. A graphical login startup cannot reliably answer an interactive password prompt. Prefer enabling required services at boot or using a carefully restricted helper. Do not solve this by granting unrestricted passwordless sudo.

### The script cannot find a command

Check the command's path with:

```bash
command -v code
command -v gnome-terminal
command -v antigravity
command -v brave-browser || command -v brave
```

Desktop autostart may have a different `PATH` from an interactive shell. If needed, use the full executable path in the script.

### Frontend URL does not load

Check the frontend terminal for errors and confirm the app is listening on port 3000. If the app uses another port, update `URL` in the startup script.

### A terminal closes or a command fails

The script's terminal commands are intended to leave a shell open after the command exits, so you can inspect the exit status and error output. Fix the underlying error, then rerun the script manually.

## Final checklist

- [ ] Project paths are correct.
- [ ] `start.sh` exists at the backend project root.
- [ ] `~/bin/start-easystack.sh` is executable.
- [ ] Manual startup works.
- [ ] Any privileged commands are handled safely.
- [ ] The autostart desktop entry points to the correct script.
- [ ] Login startup has been tested.
