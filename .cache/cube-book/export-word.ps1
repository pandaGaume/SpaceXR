param([string]$InputPath,[string]$OutputPath,[switch]$UpdateFields)
$InputPath=[IO.Path]::GetFullPath($InputPath).Replace("/","\"); $OutputPath=[IO.Path]::GetFullPath($OutputPath).Replace("/","\"); $word=$null; $doc=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false; $word.DisplayAlerts=0; $word.AutomationSecurity=3
  $doc=$word.Documents.Open($InputPath,$false,(-not $UpdateFields),$false)
  if($UpdateFields){[void]$doc.Fields.Update(); foreach($toc in $doc.TablesOfContents){$toc.Update()}; $doc.Repaginate(); $doc.Save()}
  $doc.ExportAsFixedFormat($OutputPath,17)
  Write-Output ('Pages: '+$doc.ComputeStatistics(2))
} finally {
  if($null -ne $doc){$doc.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc)}
  if($null -ne $word){$word.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)}
}


