#!/bin/bash

# Script to add, commit, and push all changes to multiple remotes

echo "=== Starting Git Operations ==="

# 1. Add all changes
echo "Adding all changes..."
git add .

# 2. Commit changes
echo "Committing changes..."
git commit -m "Complete route modularization: separate routes into files, add JSDoc comments, move exporters to utils"

# 3. List all remotes
echo "Configured remotes:"
git remote -v

# 4. Push to all remotes
echo "Pushing to all remotes..."
for remote in $(git remote); do
  echo "Pushing to $remote..."
  git push $remote feature/ingestion-service
done

echo "=== Git Operations Complete ==="
echo "Check above output for any errors" 