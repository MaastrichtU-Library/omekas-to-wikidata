#!/bin/bash

# Simple script to run the browser tests for the Omeka S to Wikidata project
echo "Starting HTTP server for browser tests..."
echo "Please open one of these URLs in your browser:"
echo "http://localhost:8080/tests/browser/test-runner.html"
echo "http://localhost:8080/tests/browser/test-runner-modules.html"
echo ""
echo "Press Ctrl+C to stop the server when done."

# Run Python HTTP server on port 8080
cd "$(dirname "$(dirname "$0")")" # Navigate to project root
python3 -m http.server 8080