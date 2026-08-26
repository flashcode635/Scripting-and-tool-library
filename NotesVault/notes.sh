#!/bin/bash

# ============================================
# CONFIGURATION - Change these as needed
# ============================================
COMMAND_NAME="notes"           # The command you want to type to run this
PROJECT_PATH="" # Your project path
# ============================================

# Check if the project directory exists
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Error: Project directory not found at $PROJECT_PATH"
    echo "Please update the PROJECT_PATH variable in the script"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_PATH"

# Check if there's an HTML file
if [ ! -f "index.html" ] && [ ! -f "index.htm" ]; then
    echo "⚠️  Warning: No index.html or index.htm found"
    echo "Make sure you have a main HTML file"
fi

# Detect available port (start from 8000 and find an available one)
PORT=8000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

# Build the URL
URL="http://localhost:$PORT"

# Print the URL prominently
echo ""
echo "=========================================="
echo "🚀 Starting your project..."
echo "📍 Project: $PROJECT_PATH"
echo "🌐 URL: $URL"
echo "=========================================="
echo ""

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL" &
elif command -v open &> /dev/null; then
    open "$URL" &
elif command -v start &> /dev/null; then
    start "$URL" &
else
    echo "ℹ️  Please open $URL in your browser"
fi

# Display the URL again when server starts
echo "✅ Server running at: $URL"
echo "ℹ️  Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first
if command -v python3 &> /dev/null; then
    echo "Using Python 3 HTTP server..."
    python3 -m http.server $PORT

# Try Python 2
elif command -v python &> /dev/null; then
    echo "Using Python HTTP server..."
    python -m SimpleHTTPServer $PORT

# Try Node.js http-server
elif command -v npx &> /dev/null; then
    echo "Using Node.js http-server..."
    npx http-server -p $PORT

# Try PHP server
elif command -v php &> /dev/null; then
    echo "Using PHP server..."
    php -S localhost:$PORT

else
    echo "❌ Error: No server found. Please install Python, Node.js, or PHP."
    echo ""
    echo "Alternative - Open the file directly:"
    echo "  xdg-open $PROJECT_PATH/index.html  # Linux"
    echo "  open $PROJECT_PATH/index.html      # macOS"
    echo "  start $PROJECT_PATH/index.html     # Windows"
    exit 1
fi