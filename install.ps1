<#
.SYNOPSIS
  Install the team Claude Code standard on native Windows.

.DESCRIPTION
  Equivalent of install.sh for people running Claude Code on Windows rather than
  through WSL. Safe by default: dry run unless -Apply, backs up first, never
  overwrites an existing file, preserves every key already in settings.json.

  Two Windows-specific behaviours this handles, both of which fail SILENTLY:

  1. Hook commands run under Git Bash when it is on PATH. Git Bash reads
     "C:\Users\me\.claude\hooks\x.sh" as escape sequences, not a path, and reports
     "command not found". Hook paths are therefore written in POSIX form:
     /c/Users/me/.claude/hooks/x.sh

  2. A .sh file checked out with CRLF line endings fails under bash with
     "\r: command not found". Line endings are normalised on install.

.EXAMPLE
  .\install.ps1
  .\install.ps1 -Apply
  .\install.ps1 -Apply -Dest "$env:USERPROFILE\.claude-test"
#>

[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Dest = $(if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE ".claude" })
)

$ErrorActionPreference = "Stop"
$Src = Split-Path -Parent $MyInvocation.MyCommand.Path

function Say  { param($m) Write-Host $m }
function Act  { param($m) if ($Apply) { Write-Host "  [done] $m" } else { Write-Host "  [would] $m" } }
function Skip { param($m) Write-Host "  [skip] $m" -ForegroundColor DarkGray }

# ---------------------------------------------------------------- source validation
foreach ($d in @("base", "pipeline")) {
    if (-not (Test-Path (Join-Path $Src $d))) {
        Write-Error "Missing $d\. Run this from inside the cloned repo."
        exit 1
    }
}
$payload = @(Get-ChildItem (Join-Path $Src "base"), (Join-Path $Src "pipeline") -Recurse -File)
if ($payload.Count -lt 30) {
    Write-Error "Only $($payload.Count) payload files found; clone looks incomplete."
    exit 1
}

if (-not $Apply) { Say "DRY RUN - nothing will be changed. Re-run with -Apply." }
Say ""
Say "Repo:        $Src ($($payload.Count) files)"
Say "Destination: $Dest"
Say ""

# ---------------------------------------------------------------- Git Bash check
# Hooks are POSIX shell scripts. Without Git Bash they are not merely degraded --
# they do not run at all, and the failure is non-blocking, so nothing tells you.
$gitBash = $null
if ($env:CLAUDE_CODE_GIT_BASH_PATH -and (Test-Path $env:CLAUDE_CODE_GIT_BASH_PATH)) {
    $gitBash = $env:CLAUDE_CODE_GIT_BASH_PATH
} else {
    foreach ($p in @("C:\Program Files\Git\bin\bash.exe",
                     "C:\Program Files (x86)\Git\bin\bash.exe",
                     "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe")) {
        if (Test-Path $p) { $gitBash = $p; break }
    }
    if (-not $gitBash) {
        $cmd = Get-Command bash.exe -ErrorAction SilentlyContinue
        if ($cmd) { $gitBash = $cmd.Source }
    }
}

if ($gitBash) {
    Say "Git Bash:    $gitBash"
} else {
    Say "Git Bash:    NOT FOUND" 
    Say ""
    Say "  WARNING: every hook in this repo is a bash script. Without Git Bash they"
    Say "  will be registered, listed by /hooks, and never execute -- the failure is"
    Say "  non-blocking, so nothing will tell you the safety layer is off."
    Say ""
    Say "  Install Git for Windows, then re-run. If it is installed but not detected,"
    Say "  set CLAUDE_CODE_GIT_BASH_PATH to your bash.exe and re-run."
    Say ""
    if ($Apply) {
        $ans = Read-Host "  Continue anyway and install everything except the hooks? [y/N]"
        if ($ans -ne "y") { exit 1 }
    }
}
Say ""

# ---------------------------------------------------------------- helpers
function ConvertTo-PosixPath {
    # C:\Users\me\.claude\hooks\x.sh  ->  /c/Users/me/.claude/hooks/x.sh
    param([string]$WinPath)
    $full = [System.IO.Path]::GetFullPath($WinPath)
    if ($full -match '^([A-Za-z]):[\\/](.*)$') {
        $drive = $Matches[1].ToLower()
        $rest  = $Matches[2] -replace '\\', '/'
        return "/$drive/$rest"
    }
    return ($full -replace '\\', '/')
}

function Write-LfFile {
    # Write with LF endings and no BOM. A .sh with CRLF fails under bash with
    # "\r: command not found", which reads like a broken script rather than a
    # line-ending problem.
    param([string]$From, [string]$To)
    $text = [System.IO.File]::ReadAllText($From) -replace "`r`n", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($To, $text, $utf8NoBom)
}

if ($Apply -and -not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }

# ---------------------------------------------------------------- backup
if ($Apply -and (Test-Path $Dest) -and (Get-ChildItem $Dest -Force | Select-Object -First 1)) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $bk = "$($Dest.TrimEnd('\'))-backup-$stamp.zip"
    $skipDirs = @("sessions", "cache", "projects", "file-history", "shell-snapshots")
    $items = Get-ChildItem $Dest -Force | Where-Object { $skipDirs -notcontains $_.Name }
    if ($items) {
        Compress-Archive -Path $items.FullName -DestinationPath $bk -Force
        Say "Backup: $bk"
    }
    Say ""
}

$installed = 0
$collisions = 0

function Install-Tree {
    param([string]$Root, [string]$Label)
    Say $Label
    foreach ($f in Get-ChildItem $Root -Recurse -File) {
        $rel = $f.FullName.Substring($Root.Length).TrimStart('\','/')
        if ($rel -eq "CLAUDE.team.md") { continue }
        $target = Join-Path $Dest $rel
        if (Test-Path $target) {
            $same = $false
            try {
                $same = ((Get-FileHash $f.FullName).Hash -eq (Get-FileHash $target).Hash)
            } catch { }
            if ($same) { Skip "$rel (identical)" }
            else { Skip "$rel - EXISTS AND DIFFERS, left untouched"; $script:collisions++ }
            continue
        }
        Act "install $rel"
        if ($Apply) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
            if ($f.Extension -eq ".sh") { Write-LfFile $f.FullName $target }
            else { Copy-Item $f.FullName $target }
        }
        $script:installed++
    }
    Say ""
}

Install-Tree (Join-Path $Src "base")     "Team standard (rules, commands, agents, hooks, skills)"
Install-Tree (Join-Path $Src "pipeline") "Delivery pipeline"

if (Test-Path (Join-Path $Src "tools")) {
    Say "Tools"
    foreach ($t in Get-ChildItem (Join-Path $Src "tools") -File) {
        $target = Join-Path $Dest "tools\$($t.Name)"
        if (Test-Path $target) { Skip "tools\$($t.Name) (exists)"; continue }
        Act "install tools\$($t.Name)"
        if ($Apply) {
            New-Item -ItemType Directory -Path (Join-Path $Dest "tools") -Force | Out-Null
            Write-LfFile $t.FullName $target
        }
        $script:installed++
    }
    Say ""
}

# ---------------------------------------------------------------- CLAUDE.md
Say "CLAUDE.md"
$personal = Join-Path $Src "CLAUDE.personal.md"
$hasPersonal = Test-Path $personal
if (-not $hasPersonal) {
    Say "  No CLAUDE.personal.md found. Create it first:"
    Say "    Copy-Item templates\CLAUDE.personal.example.md CLAUDE.personal.md"
    Say "  Installing the team standard alone for now."
}
$claudeMd = Join-Path $Dest "CLAUDE.md"
if (Test-Path $claudeMd) {
    Skip "CLAUDE.md already exists - left untouched"
    $collisions++
} else {
    Act "assemble CLAUDE.md (team standard$(if ($hasPersonal) { ' + personal section' }))"
    if ($Apply) {
        $parts = @([System.IO.File]::ReadAllText((Join-Path $Src "base\CLAUDE.team.md")))
        if ($hasPersonal) { $parts += "`n" + [System.IO.File]::ReadAllText($personal) }
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($claudeMd, ($parts -join ""), $utf8NoBom)
    }
    $installed++
}
Say ""

# ---------------------------------------------------------------- hooks -> settings.json
Say "settings.json - hooks"
if (-not $gitBash) {
    Skip "no Git Bash; hooks not registered (they could not run)"
} else {
    $settingsPath = Join-Path $Dest "settings.json"
    $settings = @{}
    if (Test-Path $settingsPath) {
        try { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json -AsHashtable }
        catch { Write-Error "$settingsPath is not valid JSON. Fix it, then re-run."; exit 1 }
    }

    $want = @(
        @{ Event = "PreToolUse"; Matcher = "Bash";       Script = "pre-bash-guard.sh";             Timeout = 5  },
        @{ Event = "PreToolUse"; Matcher = "Write|Edit"; Script = "pre-edit-protect-sensitive.sh"; Timeout = 5  },
        @{ Event = "PreToolUse"; Matcher = "Skill";      Script = "log-skill-use.sh";              Timeout = 5  },
        @{ Event = "Stop";       Matcher = $null;        Script = "stop-secret-scan.sh";           Timeout = 10 },
        @{ Event = "Stop";       Matcher = $null;        Script = "stop-require-verification.sh";  Timeout = 10 }
    )

    if (-not $settings.ContainsKey("hooks")) { $settings["hooks"] = @{} }
    $hooks = $settings["hooks"]

    foreach ($w in $want) {
        $winPath = Join-Path $Dest "hooks\$($w.Script)"
        if (-not (Test-Path $winPath)) { Say "    - $($w.Event): SKIPPED $($w.Script) (not installed)"; continue }
        $cmd = "bash " + (ConvertTo-PosixPath $winPath)

        if (-not $hooks.ContainsKey($w.Event)) { $hooks[$w.Event] = @() }
        $bucket = @($hooks[$w.Event])

        $exists = $false
        foreach ($g in $bucket) { foreach ($h in @($g.hooks)) { if ($h.command -eq $cmd) { $exists = $true } } }
        if ($exists) { Say "    - $($w.Event): already registered $($w.Script)"; continue }

        $entry = @{ type = "command"; command = $cmd; timeout = $w.Timeout }
        $grp = $bucket | Where-Object { $_.matcher -eq $w.Matcher } | Select-Object -First 1
        if ($grp) {
            $grp.hooks = @($grp.hooks) + $entry
        } else {
            $new = @{ hooks = @($entry) }
            if ($w.Matcher) { $new["matcher"] = $w.Matcher }
            $bucket += $new
        }
        $hooks[$w.Event] = $bucket
        Say "    - $($w.Event): added $($w.Script)"
    }

    $settings["hooks"] = $hooks
    Act "write settings.json (existing keys preserved)"
    if ($Apply) {
        if (Test-Path $settingsPath) { Copy-Item $settingsPath "$settingsPath.bak-$(Get-Date -Format 'HHmmss')" }
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json -Depth 12), $utf8NoBom)
    }
}

Say ""
Say "---------------------------------------------"
Say "Installed: $installed    Collisions left untouched: $collisions"
Say ""
if ($Apply) {
    Say "Next:"
    Say "  1. Restart Claude Code completely."
    Say "  2. /hooks   - expect PreToolUse: 3, Stop: 2"
    Say "  3. Type /   - expect /work, /plan, /verify"
    Say "  4. Prove they RUN, not just register:"
    Say "       bash `"$(ConvertTo-PosixPath (Join-Path $Dest 'tools\add-hook-audit.sh'))`" --apply"
    Say "     then restart, use Claude, and check hook-audit.log"
} else {
    Say "Re-run with -Apply."
}
