# Deploy completo de Mirador a Firebase
# Ejecutar: .\deploy.ps1

Write-Host "Deploying Mirador a Firebase..." -ForegroundColor Cyan

$firebase = "npx -y firebase-tools@latest"
$project  = "miradorapp-b9faf"

Write-Host "`nProyecto: $project" -ForegroundColor Yellow
& $firebase use $project
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nIniciando deploy (hosting + firestore + storage + functions)..." -ForegroundColor Yellow
& $firebase deploy --only hosting,firestore,storage,functions --project $project

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeploy exitoso!" -ForegroundColor Green
    Write-Host "App:      https://miradorapp-b9faf.web.app" -ForegroundColor Cyan
    Write-Host "Consola:  https://console.firebase.google.com/project/miradorapp-b9faf/overview" -ForegroundColor Cyan
} else {
    Write-Host "`nError en deploy" -ForegroundColor Red
    exit 1
}
