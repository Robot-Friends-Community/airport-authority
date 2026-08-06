# capture_wt_tabs.ps1 — read the live Windows Terminal tab titles + order via UI Automation.
# Emits JSON: [{ "window": "<title>", "tabs": ["KB","JP",...] }, ...]
# Used by the session-relaunch skill to preserve the user's exact tab names + order.
# No admin required. Works while the terminal is open (run it BEFORE closing your sessions).

Add-Type -AssemblyName UIAutomationClient

$root = [System.Windows.Automation.AutomationElement]::RootElement
$winCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, 'CASCADIA_HOSTING_WINDOW_CLASS')
$tabCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::TabItem)

$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $winCond)
$out = @()
foreach ($w in $windows) {
    $tabs = @()
    foreach ($t in $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond)) {
        $name = $t.Current.Name
        if ($name) { $tabs += $name }
    }
    $out += [pscustomobject]@{ window = $w.Current.Name; tabs = $tabs }
}
# -Depth so nested arrays serialize; -Compress optional. Always emit an array.
ConvertTo-Json -InputObject @($out) -Depth 5
