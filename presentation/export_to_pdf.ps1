$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pptxPath = Join-Path $scriptDir "The_Color_Purple_Letters_61-69_IT_Report.pptx"
$pdfPath = Join-Path $scriptDir "The_Color_Purple_Letters_61-69_IT_Report.pdf"

Write-Output "Opening PowerPoint COM interface..."
$ppt = New-Object -ComObject PowerPoint.Application

try {
    Write-Output "Opening presentation: $pptxPath"
    $pres = $ppt.Presentations.Open($pptxPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    Write-Output "Exporting to PDF: $pdfPath"
    # 32 represents ppSaveAsPDF
    $pres.SaveAs($pdfPath, 32)
    $pres.Close()
    Write-Output "SUCCESS: PDF successfully generated at: $pdfPath"
}
catch {
    Write-Error "Failed to convert PPTX to PDF: $_"
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
