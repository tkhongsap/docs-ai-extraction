# PowerShell script to add, commit, and push all changes to multiple remotes

Write-Host "=== Starting Git Operations ===" -ForegroundColor Cyan

# 1. Add all changes
Write-Host "Adding all changes..." -ForegroundColor Yellow
git add .

# 2. Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "Complete route modularization: separate routes into files, add JSDoc comments, move exporters to utils"

# 3. List all remotes
Write-Host "Configured remotes:" -ForegroundColor Yellow
git remote -v

# 4. Push to all remotes
Write-Host "Pushing to all remotes..." -ForegroundColor Yellow
$remotes = git remote
foreach ($remote in $remotes) {
    Write-Host "Pushing to $remote..." -ForegroundColor Green
    git push $remote feature/ingestion-service
}

Write-Host "=== Git Operations Complete ===" -ForegroundColor Cyan
Write-Host "Check above output for any errors" -ForegroundColor Yellow 