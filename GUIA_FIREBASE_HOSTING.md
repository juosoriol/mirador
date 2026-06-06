# 🚀 Guía: Configurar Firebase Hosting para Mirador

## Paso 1: Instalar Node.js

### Descarga Node.js
1. Ve a: https://nodejs.org/
2. Descarga la versión **LTS** (recomendada)
3. Ejecuta el instalador
4. Click "Next" en todo (deja opciones por defecto)
5. Espera a que termine

### Verificar instalación
Abre PowerShell y ejecuta:
```powershell
node --version
npm --version
```

Deberías ver algo como:
```
v20.x.x
10.x.x
```

---

## Paso 2: Instalar Firebase CLI

En PowerShell:
```powershell
npm install -g firebase-tools
```

Espera a que termine (puede tardar 1-2 minutos).

Verifica:
```powershell
firebase --version
```

---

## Paso 3: Login en Firebase

```powershell
firebase login
```

Se abrirá tu navegador. Selecciona tu cuenta Google (la que usaste para Firebase).

---

## Paso 4: Inicializar Firebase Hosting

```powershell
cd C:\Users\juoso\OneDrive\Escritorio\Mirador
firebase init hosting
```

**Respuestas a las preguntas:**

1. **"Please select an option:"** 
   → Usa las flechas ↓↑ y selecciona: **"Use an existing project"**
   → Enter

2. **"Select a default Firebase project:"**
   → Selecciona: **"miradorapp-b9faf"**
   → Enter

3. **"What do you want to use as your public directory?"**
   → Escribe: `.` (punto)
   → Enter

4. **"Configure as a single-page app?"**
   → Escribe: `y` (yes)
   → Enter

5. **"Set up automatic builds with GitHub?"**
   → Escribe: `N` (no)
   → Enter

6. **"File ./index.html already exists. Overwrite?"**
   → Escribe: `N` (NO - MUY IMPORTANTE)
   → Enter

---

## Paso 5: Crear archivo .firebaserc

Crea el archivo `C:\Users\juoso\OneDrive\Escritorio\Mirador\.firebaserc` con:

```json
{
  "projects": {
    "default": "miradorapp-b9faf"
  }
}
```

---

## Paso 6: Crear archivo firebase.json

Crea el archivo `C:\Users\juoso\OneDrive\Escritorio\Mirador\firebase.json` con:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "**/*.md",
      ".git/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache"
          }
        ]
      }
    ]
  }
}
```

---

## Paso 7: Deploy a Firebase

```powershell
firebase deploy --only hosting
```

Espera 1-2 minutos. Verás algo como:

```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/miradorapp-b9faf/overview
Hosting URL: https://miradorapp-b9faf.web.app
```

---

## ✅ ¡LISTO!

Tu app estará disponible en:
- **https://miradorapp-b9faf.web.app**
- **https://miradorapp-b9faf.firebaseapp.com**

---

## 🔄 Para actualizar la app en el futuro

Cada vez que hagas cambios:

```powershell
cd C:\Users\juoso\OneDrive\Escritorio\Mirador
firebase deploy --only hosting
```

---

## ⚠️ IMPORTANTE: Actualizar CORS

Después del deploy, actualiza el CORS en Firebase Storage:

1. Abre Google Cloud Shell: https://console.cloud.google.com/

2. Crea archivo `cors.json`:
```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["https://miradorapp-b9faf.web.app"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
EOF
```

3. Aplica CORS:
```bash
gcloud storage buckets update gs://miradorapp-b9faf.firebasestorage.app --cors-file=cors.json
```

---

## 📝 Notas

- ✅ La URL cambiará de `juosoriol.github.io/mirador/` a `miradorapp-b9faf.web.app`
- ✅ El repo puede quedarse privado
- ✅ Deploy manual con `firebase deploy`
- ✅ Gratis hasta 10GB/mes de transferencia (más que suficiente para 10 usuarios)
- ✅ SSL automático
- ✅ CDN global de Google
