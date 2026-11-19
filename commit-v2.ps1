$ErrorActionPreference = "Stop"
Set-Location "C:\Users\muse-ai\Desktop\ai-video-local-quota-manager"
git checkout -b feature/live-readings-multiaccount
$lines = git --literal-pathspecs status --porcelain -uall
foreach ($line in $lines) {
  $path = $line.Substring(3).Trim('"')
  $prefix = "feature:"
  if ($path -like "tests/*") { $prefix = "test:" }
  elseif ($path -like "docs/*") { $prefix = "docs:" }
  elseif ($path -eq ".gitignore" -or $path -eq ".env.sample" -or $path -like "data/*") { $prefix = "chore:" }
  git --literal-pathspecs add -- $path
  git commit -m "$prefix sync v2 (live readings + multi-account): $path"
}
git status --short --branch
git --no-pager log --oneline -3
