 = New-Object -ComObject PowerPoint.Application
.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
 = (Resolve-Path 'test_pptx.pptx').Path
 = (Join-Path (Get-Location) 'test_pptx.pdf')
 = .Presentations.Open(, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
.SaveAs(, 32)
.Close()
.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject() | Out-Null
Test-Path 
