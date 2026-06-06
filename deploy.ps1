# Script de deploy a Firebase Hosting
# Ejecutar: .\deploy.ps1

Write-Host "🚀 Deploying Mirador a Firebase Hosting..." -ForegroundColor Cyan

# Verificar si Firebase CLI está instalado
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI detectado: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI no instalado" -ForegroundColor Red
    Write-Host "Instala con: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Deploy
Write-Host "`n📤 Iniciando deploy..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy exitoso!" -ForegroundColor Green
    Write-Host "🌐 Tu app está en: https://miradorapp-b9faf.web.app" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Error en deploy" -ForegroundColor Red
    exit 1
}
