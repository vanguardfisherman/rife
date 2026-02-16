# Rifa Progress App (React Native / Android)

Aplicación para gestionar rifas con persistencia local y backup JSON compartible.

## Funcionalidades

- Crear rifa (nombre, total de números y precio).
- Vender por número individual, múltiple manual y rango.
- Validación para no vender números ya vendidos.
- Comprador obligatorio (nombre + teléfono).
- Dashboard con barra de progreso y recaudado.
- Exportación e importación JSON de rifa completa.
- Importación reemplaza por completo la rifa local.
- Backup automático al enviar app al background.

## Ejecutar

```bash
npm install
npm run start
```

## Estructura

- `src/db/database.ts`: esquema SQLite y lógica principal de negocio.
- `src/services/backupService.ts`: exportar, importar y compartir JSON.
- `App.tsx`: UI de pantallas y flujo principal.
