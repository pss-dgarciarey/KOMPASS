param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'kill', 'stop', 'status')]
    [string]$Command = 'status',
    [switch]$NoBrowser,
    [int]$Port = 8080
)

$launcher = Join-Path $PSScriptRoot 'start_kompass.ps1'

switch ($Command.ToLowerInvariant()) {
    'start' {
        if ($NoBrowser) {
            & $launcher -Port $Port -NoBrowser
        } else {
            & $launcher -Port $Port
        }
        break
    }
    'kill' {
        & $launcher -Stop
        break
    }
    'stop' {
        & $launcher -Stop
        break
    }
    'status' {
        & $launcher -Status
        break
    }
}
