#!/bin/bash

echo "Stopping any manually running processes (optional check)..."
# Logic to kill python/node if needed could go here, but better to let user handle or just fail on port bind

echo "Installing MAGM Services..."

# 1. Copy service files to systemd directory
echo "Copying service files to /etc/systemd/system/"
sudo cp /home/rpi/Desktop/magm_edge_server/deploy/services/*.service /etc/systemd/system/

# 2. Reload systemd daemon to recognize new services
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# 3. Enable and start services
echo "Enabling and starting services..."
sudo systemctl enable --now magm-edge-server.service
sudo systemctl enable --now magm-sensor-client.service
sudo systemctl enable --now magm-frontend.service
sudo systemctl enable --now magm-ngrok.service

echo "---------------------------------------------------"
echo "Services installed and started!"
echo "Checking status..."
sudo systemctl status magm-edge-server magm-sensor-client magm-frontend magm-ngrok --no-pager
