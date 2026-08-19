
# designed coz i was too laazy to write them everyday..
# Setup:
# 1. Create file: `sudo nano /usr/local/bin/start` (paste script)
# 2. Make executable: `chmod +x /usr/local/bin/start`
#
# Usage: Run `start` in terminal.

echo "🔄 Starting system update..."
sudo apt update

echo "⬆️ Upgrading packages..."
sudo apt upgrade -y

echo "🧹 Removing unnecessary packages..."
sudo apt autoremove -y

echo "✅ All done!"