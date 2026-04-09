<#
.SYNOPSIS
Displays a clean directory tree for the Tauri project.

.DESCRIPTION
This local utility script traverses the directory to output a file tree.
Typical build folders such as "gen", "target", and "node_modules" are excluded
to ensure an uncluttered view of the source code.

.EXAMPLE
.\mytree.ps1
Prints the directory tree starting from the current working directory.
#>


param(
    [string]$Path = $PSScriptRoot
)

$exclude = 'gen','target','node_modules','dist','.git'

function Show-Tree {
    param(
        [string]$CurrentPath,
        [string]$Prefix = ''
    )

    $items = Get-ChildItem -LiteralPath $CurrentPath -Force |
        Where-Object { $_.Name -notin $exclude } |
        Sort-Object @{Expression = { -not $_.PSIsContainer }}, Name

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $last = $i -eq ($items.Count - 1)
        $branch = if ($last) { '\---' } else { '+---' }

        "$Prefix$branch$($item.Name)"

        if ($item.PSIsContainer) {
            $nextPrefix = if ($last) { "$Prefix    " } else { "$Prefix|   " }
            Show-Tree -CurrentPath $item.FullName -Prefix $nextPrefix
        }
    }
}

$resolved = (Resolve-Path -LiteralPath $Path).Path
$resolved
Show-Tree -CurrentPath $resolved