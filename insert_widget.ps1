$content = Get-Content 'C:\Users\kanem\SHOS-V2\CLAUDE.md' -Raw
$idx = $content.IndexOf('## Recently shipped (21 Sep 2026 — accessibility: all sub-screen titles converted to semantic <h1>)')
if ($idx -ge 0) {
    $newEntry = @'
## Recently shipped (21 Sep 2026 — Android home-screen widget for next medication dose)

Installed `capacitor-widget-bridge` plugin. Created `NextDoseWidgetProvider` (AppWidgetProvider) showing medication name and next dose time on home screen. Widget layout (`next_dose_widget.xml`), metadata (`next_dose_widget_info.xml`), and provider class (`NextDoseWidgetProvider.java`) created. Registered in `AndroidManifest.xml`. Widget reads from SharedPreferences updated via `NextDoseWidgetProvider.updateNextDose()` called from `medicationReminderSync.js`. 

Build passes, lint clean. CI build (APK) triggered on push.

'@
    $content = $content.Insert($idx, $newEntry + "`n`n")
    Set-Content -Path 'C:\Users\kanem\SHOS-V2\CLAUDE.md' -Value $content -Encoding UTF8
    Write-Host 'Inserted successfully'
} else {
    Write-Host 'Pattern not found'
}