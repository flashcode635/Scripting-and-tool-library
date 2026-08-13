# Mouse Reset Script: Reloads the `i2c_hid_acpi` kernel module to fix Linux 
# touchpad/mouse issues (e.g., freezing, suspend/resume failures).
#
# Setup:
# 1. Create file: `sudo nano /usr/local/bin/mouse` (paste script)
# 2. Make executable: `chmod +x /usr/local/bin/mouse`
#
# Usage: Run `mouse` in terminal.

echo "Resetting i2c_hid_acpi module..."

# Remove the module
sudo modprobe -r i2c_hid_acpi

# Wait a moment for the module to fully unload
sleep 1

# Re-add the module
sudo modprobe i2c_hid_acpi

echo "Module reset complete. Your mouse/touchpad should work now."