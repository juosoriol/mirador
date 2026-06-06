# Migración a Firebase Hosting

## Ventajas de Firebase Hosting vs GitHub Pages

### Firebase Hosting:
- ✅ CDN global de Google
- ✅ SSL automático
- ✅ Dominio personalizado fácil
- ✅ Rollback de versiones
- ✅ Integración nativa con otros servicios Firebase
- ✅ Headers de seguridad personalizados
- ⚠️ Requiere Firebase CLI
- ⚠️ Plan Blaze si excedes 10GB/mes de transferencia

### GitHub Pages (actual):
- ✅ Gratis ilimitado
- ✅ Deploy automático con git push
- ✅ SSL automático
- ✅ Ya funciona
- ⚠️ Código visible si repo es público

---

## Pasos para migrar a Firebase Hosting

### 1. Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login en Firebase

```bash
firebase login
```

### 3. Inicializar proyecto

```bash
cd C:\Users\juoso\OneDrive\Escritorio\Mirador
firebase init hosting
```

**Configuración:**
- Select existing project: `miradorapp-b9faf`
- Public directory: `.` (directorio actual)
- Configure as single-page app: `Yes`
- Set up automatic builds: `No`
- Overwrite index.html: `No`

### 4. Crear archivo firebase.json

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "**/*.md"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=7200"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=604800"
          }
        ]
      }
    ]
  }
}
```

### 5. Deploy

```bash
firebase deploy --only hosting
```

**Tu app estará en:**
- https://miradorapp-b9faf.web.app
- https://miradorapp-b9faf.firebaseapp.com

### 6. (Opcional) Dominio personalizado

En Firebase Console → Hosting → Add custom domain

---

## Alternativa: Repo privado + GitHub Pages

Si solo quieres ocultar el código:

1. **GitHub → Settings → Change visibility → Make private**
2. GitHub Pages seguirá funcionando en `https://juosoriol.github.io/mirador/`
3. El código solo visible para ti

---

## Recomendación

**Para tu caso (10 usuarios internos):**

✅ **OPCIÓN A: Repo privado + GitHub Pages actual**
- Gratis
- Fácil
- Ya funciona
- Código oculto

✅ **OPCIÓN B: Firebase Hosting**
- Más profesional
- Mejor performance
- Más control
- Costo mínimo (probablemente gratis en tu caso)

❌ **NO RECOMENDADO: Dejar repo público con código sensible**
- Las credenciales Firebase son OK
- Pero si tienes lógica de negocio sensible, mejor privado
