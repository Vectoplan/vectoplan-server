#!/usr/bin/env bash
# -----------------------------------------------------------------
# install.sh – Provisioniert eine Ubuntu-20.04-VM für den Speckle-Stack
#   • Docker Engine + Compose-Plugin
#   • UFW-Firewall (SSH, HTTP/HTTPS offen)
#   • Fail2Ban (ssh-Jail)
#   • systemd-Service startet den Stack beim Boot
#   • systemd-Timer rebootet den Host täglich um 04:00 Uhr
# -----------------------------------------------------------------
set -Eeuo pipefail

# -------------------- Farbcodes & Logging ------------------------
C_TURQ="\033[36m"   # Info
C_GREEN="\033[32m"  # Erfolg
C_YELLOW="\033[33m" # Warnung
C_RED="\033[31m"    # Fehler
C_RESET="\033[0m"

info()    { echo -e "${C_TURQ}$*${C_RESET}"; }
success() { echo -e "${C_GREEN}$*${C_RESET}"; }
warn()    { echo -e "${C_YELLOW}$*${C_RESET}"; }
error()   { echo -e "${C_RED}$*${C_RESET}"; }

trap 'error "❌ Fehler in Zeile $LINENO – Skript abgebrochen."' ERR

# -------------------- Hilfsroutinen ------------------------------
check_root() {
  [[ $EUID -eq 0 ]] || { error "Bitte als root ausführen (sudo -i)"; exit 1; }
}

clear_terminal() {
  printf '\033c'
}

# -------------------- Installationsschritte ---------------------
install_prereqs() {
  info "▶ Installiere Vor­ab­abhängigkeiten …"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release ufw fail2ban >/dev/null
  success "✓ Basis-Pakete installiert."
}

install_docker() {
  info "▶ Installiere Docker Engine & Compose-Plugin …"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                        docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
  success "✓ Docker Engine & Compose-Plugin installiert und gestartet."
}

setup_compose_service() {
  info "▶ Richte systemd-Service für den Speckle-Stack ein …"

  cat >/etc/systemd/system/vectoapi-compose.service <<'EOF'
[Unit]
Description=Speckle-Stack (docker compose)
Requires=docker.service network-online.target
After=docker.service network-online.target

[Service]
Type=simple
WorkingDirectory=/home/VectoAPI
ExecStartPre=/usr/bin/docker compose -f docker-compose-prod.yml pull
ExecStart=/usr/bin/docker compose -f docker-compose-prod.yml up
ExecStop=/usr/bin/docker compose -f docker-compose-prod.yml down
Restart=always
RestartSec=10
TimeoutStopSec=300

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now vectoapi-compose.service
  systemctl enable --now NetworkManager-wait-online.service
  success "✓ Stack-Service aktiviert (Start beim Boot)."
}




configure_ufw() {
  info "▶ Konfiguriere UFW-Firewall …"
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp  comment 'SSH'
  ufw allow 80/tcp  comment 'HTTP (Nginx)'
  ufw allow 443/tcp comment 'HTTPS (Nginx)'
  ufw --force enable
  success "✓ UFW aktiviert. Offen: 22, 80, 443 TCP."
}

configure_fail2ban() {
  info "▶ Installiere & konfiguriere Fail2Ban …"
  cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
bantime  = 1h
maxretry = 5
findtime = 10m
EOF
  systemctl enable --now fail2ban
  success "✓ Fail2Ban aktiv (ssh-Jail)."
}

configure_ssh() {
  info "▶ Stelle sicher, dass Root- & Passwort-Login erlaubt bleiben …"
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin yes/'       /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication yes/' /etc/ssh/sshd_config
  systemctl reload sshd
  success "✓ SSH-Dämon neu geladen (Root/Passwort erlaubt)."
}

finish() {
  success "🎉 Installation abgeschlossen. Docker & Speckle-Stack konfiguriert."
  info    "Starte ein neues Terminal, damit Gruppenänderungen greifen."
}

# -------------------- Hauptprogramm ------------------------------
main() {
  clear_terminal
  check_root
  install_prereqs
  install_docker
  setup_compose_service
  configure_ufw
  configure_fail2ban
  configure_ssh
  finish
}

main "$@"
