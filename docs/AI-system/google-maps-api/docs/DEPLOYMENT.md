# Deployment Guide

This guide covers how to deploy the Google Reviews API on a VPS (Virtual Private Server) from scratch, including server setup, firewall configuration, SSL, and keeping the service running in production.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Recommended VPS Providers](#recommended-vps-providers)
3. [Step 1 — Provision the Server](#step-1--provision-the-server)
4. [Step 2 — Initial Server Setup](#step-2--initial-server-setup)
5. [Step 3 — Install Docker](#step-3--install-docker)
6. [Step 4 — Deploy the API](#step-4--deploy-the-api)
7. [Step 5 — Configure the Firewall](#step-5--configure-the-firewall)
8. [Step 6 — Set Up Nginx as a Reverse Proxy](#step-6--set-up-nginx-as-a-reverse-proxy)
9. [Step 7 — Enable SSL with Let's Encrypt](#step-7--enable-ssl-with-lets-encrypt)
10. [Step 8 — Auto-restart on Reboot](#step-8--auto-restart-on-reboot)
11. [Tuning Concurrency](#tuning-concurrency)
12. [Updating the API](#updating-the-api)
13. [Monitoring](#monitoring)

---

## Requirements

- A VPS running **Ubuntu 22.04 LTS** (recommended)
- Minimum **4GB RAM** (the Chromium browser used by the scraper requires it)
- Minimum **2 vCPUs**
- A domain name pointed at the server's IP (required for SSL)
- SSH access to the server

---

## Recommended VPS Providers

| Provider | Plan | RAM | vCPU | Cost | Notes |
|---|---|---|---|---|---|
| Hetzner | CX32 | 8GB | 4 | ~€8/mo | Best value, EU-based |
| DigitalOcean | 4GB Droplet | 4GB | 2 | ~$24/mo | Easy UI, good docs |
| AWS EC2 | t3.medium | 4GB | 2 | ~$30/mo | Use if already on AWS |

Hetzner CX32 is the recommended choice for cost/performance.

---

## Step 1 — Provision the Server

Create a new server with:
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 4GB minimum (8GB recommended)
- Add your SSH public key during provisioning

Once created, note the server's public IP address.

---

## Step 2 — Initial Server Setup

SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

Create a non-root user and give it sudo privileges:

```bash
adduser deploy
usermod -aG sudo deploy
```

Copy your SSH key to the new user:

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Switch to the new user for all remaining steps:

```bash
su - deploy
```

Update the system:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 3 — Install Docker

Install Docker and Docker Compose:

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow the deploy user to run Docker without sudo
sudo usermod -aG docker deploy
newgrp docker
```

Verify the installation:

```bash
docker --version
docker compose version
```

---

## Step 4 — Deploy the API

Clone or copy the project onto the server. If your code is in a Git repository:

```bash
cd /home/deploy
git clone YOUR_REPO_URL google-maps-scraper
cd google-maps-scraper
```

If you don't have a Git repository, copy the files using `scp` from your local machine:

```bash
# Run this on your LOCAL machine, not the server
scp -r "/path/to/google maps scraper" deploy@YOUR_SERVER_IP:/home/deploy/google-maps-scraper
```

Then on the server, start the services:

```bash
cd /home/deploy/google-maps-scraper
docker compose up --build -d
```

The first run will:
1. Pull the `gosom/google-maps-scraper` Docker image (~500MB)
2. Build the FastAPI image
3. Start both containers

This may take 3-5 minutes on first run. Verify both containers are running:

```bash
docker compose ps
```

You should see both `scraper` and `api` with status `Up`.

Test the API is responding:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

---

## Step 5 — Configure the Firewall

Allow only SSH, HTTP, and HTTPS. Block direct access to port 8000 (traffic will go through Nginx):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Verify the rules:

```bash
sudo ufw status
```

---

## Step 6 — Set Up Nginx as a Reverse Proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a configuration file for the API:

```bash
sudo nano /etc/nginx/sites-available/reviews-api
```

Paste the following (replace `your-domain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Increase timeouts to handle long scraping requests (up to 15 minutes)
    proxy_read_timeout 900s;
    proxy_connect_timeout 10s;
    proxy_send_timeout 900s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/reviews-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test that the API is reachable via your domain:

```bash
curl http://your-domain.com/health
```

---

## Step 7 — Enable SSL with Let's Encrypt

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain and install the SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically update your Nginx config to handle HTTPS and redirect HTTP to HTTPS.

Verify auto-renewal works:

```bash
sudo certbot renew --dry-run
```

Your API is now available at `https://your-domain.com`.

---

## Step 8 — Auto-restart on Reboot

The `restart: unless-stopped` policy in `docker-compose.yml` means containers restart automatically if they crash. To also start them when the server reboots, create a systemd service:

```bash
sudo nano /etc/systemd/system/reviews-api.service
```

Paste:

```ini
[Unit]
Description=Google Reviews API
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/deploy/google-maps-scraper
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
User=deploy

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable reviews-api
sudo systemctl start reviews-api
```

Test by rebooting the server and checking that the API comes back up automatically:

```bash
sudo reboot
# Wait ~2 minutes, then:
curl https://your-domain.com/health
```

---

## Tuning Concurrency

The `-c` flag in `docker-compose.yml` controls how many businesses can be scraped simultaneously. Adjust it based on your server's RAM:

```yaml
command: ["-web", "-addr", ":8080", "-data-folder", "/gmapsdata", "-c", "4"]
```

| Server RAM | Recommended `-c` | Max concurrent scrapes |
|---|---|---|
| 4GB | `-c 3` | 3 |
| 8GB | `-c 6` | 6 |
| 16GB | `-c 12` | 12 |

After changing this value, restart the scraper:

```bash
docker compose up -d --force-recreate scraper
```

---

## Updating the API

When you make code changes, redeploy with:

```bash
cd /home/deploy/google-maps-scraper
git pull  # if using Git
docker compose up --build -d api
```

This rebuilds only the API container without touching the scraper container, so no downtime on the scraper side.

---

## Monitoring

View live logs:

```bash
# All containers
docker compose logs -f

# API only
docker compose logs -f api

# Scraper only
docker compose logs -f scraper
```

Check container resource usage:

```bash
docker stats
```

Check container status:

```bash
docker compose ps
```

If a container is down, restart it:

```bash
docker compose restart api
docker compose restart scraper
```
