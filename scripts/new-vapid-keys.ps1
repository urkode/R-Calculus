function ConvertTo-Base64Url([byte[]]$Bytes) {
  [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$creation = New-Object System.Security.Cryptography.CngKeyCreationParameters
$creation.ExportPolicy = [System.Security.Cryptography.CngExportPolicies]::AllowPlaintextExport
$keyName = 'r-kalkyle-vapid-' + [Guid]::NewGuid().ToString('N')
$cngKey = [System.Security.Cryptography.CngKey]::Create(
  [System.Security.Cryptography.CngAlgorithm]::ECDsaP256, $keyName, $creation
)
$key = New-Object System.Security.Cryptography.ECDsaCng($cngKey)
$parameters = $key.ExportParameters($true)
$public = New-Object byte[] 65
$public[0] = 4
[Array]::Copy($parameters.Q.X, 0, $public, 1, 32)
[Array]::Copy($parameters.Q.Y, 0, $public, 33, 32)

Write-Output "VAPID_PUBLIC_KEY=$(ConvertTo-Base64Url $public)"
Write-Output "VAPID_PRIVATE_KEY=$(ConvertTo-Base64Url $parameters.D)"
Write-Output ''
Write-Output 'Legg begge verdiene inn som Worker secrets. Ikke lagre den private nøkkelen i Git.'
$key.Dispose()
$cngKey.Delete()
$cngKey.Dispose()
