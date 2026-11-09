param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'lucifer-virtual-table')
if ($Production) {
    npm run local:production
} else {
    npm run local
}
