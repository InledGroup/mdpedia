#!/bin/bash

# Simple script to sync changes to GitHub
echo "🚀 Syncing MDPEDIA to GitHub..."

# Add all changes
git add .

# Prompt for a commit message if not provided
MESSAGE=$1
if [ -z "$MESSAGE" ]; then
    MESSAGE="update: miscellaneous improvements and UI polish"
fi

# Commit
git commit -m "$MESSAGE"

# Sync
echo "📥 Pulling latest changes..."
git pull --rebase origin main

echo "📤 Pushing to main..."
git push origin main

echo "✅ Done!"
