# Exámenes CNSLG — Colegio Nuevo San Luis Gonzaga

Sistema oficial de gestión, creación, presentación y calificación de evaluaciones diagnósticas, periódicas y de admisión para el Colegio Nuevo San Luis Gonzaga (CNSLG).

Este archivo es el punto de entrada para retomar el proyecto en cualquier sesión y máquina.

---

## 🛠️ Stack y Arquitectura

- **Framework**: Next.js 16.3.8 (App Router) + React 19.2.8 + Tailwind CSS 4 + TypeScript 5.
- **Desktop Kiosk Client**: Electron 44.5.1 + Electron Builder (Portable & NSIS Setup).
  - La presentación de exámenes por estudiantes está bloqueada en la web y restringida a la aplicación de escritorio en modo quiosco.
- **Base de Datos (Dual MongoDB)**:
  - `reportes-cnslg`: Base de datos institucional oficial (estudiantes matriculados, cursos, notas académicas históricas).
  - `examenes-cnslg`: Base de datos de exámenes (evaluaciones, preguntas, opciones, respuestas/intentos de estudiantes, usuarios del staff, aspirantes de admisión, habilitaciones y claves diarias).
- **Inteligencia Artificial**: Google Gemini API (`@google/genai`) para importación y extracción automática de preguntas desde PDF/Word.
- **Autenticación**: JWT con cookies HttpOnly seguras (`ex_session`).

---

## 📌 Roles y Permisos

1. `estudiante`: Presentación de exámenes exclusivamente desde la app de escritorio con documento y clave de 6 caracteres.
2. `docente`: Creación y edición de borradores de exámenes, consulta de resultados de sus cursos asignados.
3. `supervisor`: Monitoreo en vivo de presentaciones de exámenes.
4. `coordinador`: Aprobación y activación de exámenes, creación y edición de alumnos y cursos.
5. `directivo`: Eliminación de exámenes aprobados, autorización de 2° intento de examen para alumnos.
6. `admin`: Control total (eliminación de cursos, borrado/restablecimiento de respuestas e intentos por alumno, por curso o globales, gestión total de usuarios del staff).

---

## 📋 Resumen de Funcionalidades Implementadas

### 1. Zona Horaria Estandarizada a Bogotá (UTC-5)
- Todas las fechas, horas y claves de cierre de día calculan estrictamente con la zona horaria `America/Bogota` (`hoy()`, `generateCloseCode()`, `formatFechaBogota()`, `formatHoraBogota()`). Vercel y Electron están sincronizados.

### 2. Búsqueda en Tiempo Real (`onChange`)
- Filtrado instantáneo y reactivo sin recargar la página en `/resultados`, `/admisiones`, `/examenes`, `/admin/usuarios` y `/estudiantes`.

### 3. Selector de Cursos en 3 Columnas y Checkboxes Dinámicos
- Selector ordenado pedagógicamente (*Kinder $\rightarrow$ TRANSICION $\rightarrow$ 101 $\dots$ 1102*).
- Al marcar cursos en la creación/edición de usuarios de acceso, se cargan dinámicamente solo los exámenes activos asignados a esos cursos con checkboxes individuales.

### 4. Pestaña y Aislamiento de Aspirantes (Admisiones)
- **Aspirantes**: Se guardan y gestionan **exclusivamente en `examenes-cnslg`** para no contaminar la base de datos de matrícula oficial `reportes-cnslg`.
- **Reglas de Presentación**:
  - Los **Aspirantes** solo pueden presentar pruebas de **Admisión** (`esAdmision: true`).
  - Los **Estudiantes Matriculados** solo pueden presentar exámenes regulares correspondientes a su curso único asignado.

### 5. Asignación de Cursos en MongoDB (1 Estudiante = 1 Curso)
- Cada estudiante matriculado cuenta con su campo `curso` asignado en MongoDB sincronizado desde `graderecords`.
- **Distribución actual en MongoDB**: 245 estudiantes asignados, 0 estudiantes sin curso.
- Auto-healing integrado en el login: si un alumno nuevo no tiene `curso` en `students`, se consulta y actualiza automáticamente desde `graderecords`.

### 6. Eliminación de Cursos para Administradores
- El administrador puede eliminar cursos desde la cuadrícula o la vista de detalle.
- Al eliminar un curso, los estudiantes asociados pasan de forma segura al listado **"Estudiantes Sin Curso"** para ser reasignados.

### 7. Borrado de Respuestas y Restablecimiento de Intentos (Admin)
- En `/resultados/[id]`, el Administrador puede:
  - **Por Alumno Específico**: Borrar todas sus respuestas o un intento puntual para permitirle repetir desde el intento 1.
  - **Por Curso Completo**: Borrar masivamente las respuestas de todos los estudiantes de un curso.
  - **Por Todo el Examen**: Restablecer el examen completo a 0 intentos para todo el colegio.

---

## 🗄️ Colecciones en MongoDB (`examenes-cnslg`)

- `students`: Aspirantes de admisión y copia local de estudiantes matriculados.
- `courses`: Catálogo de cursos de la institución (*KINDER, TRANSICION, 101..1102*).
- `ex_examenes`: Evaluaciones con preguntas, opciones, áreas, clave de acceso, estado y cursos asignados.
- `ex_intentos`: Respuestas registradas por los alumnos, puntajes por área y calificación final.
- `ex_habilitaciones`: Registro de 2° intentos o autorizaciones especiales concedidas por directivos.
- `ex_usuarios`: Usuarios del personal administrativo y docente con cursos y exámenes asignados.
- `ex_clave_dia`: Clave diaria institucional y mapeo de claves activas por examen.

---

## 🚀 Comandos de Desarrollo y Utilidades

```bash
# Servidor de desarrollo Next.js (:3001)
npm run dev

# Aplicación Electron en desarrollo
npm run electron:dev

# Compilar instalador ejecutable de Electron (.exe)
npm run electron:build

# Sincronizar cursos de estudiantes en MongoDB desde graderecords
npm run sync:courses

# Verificación de tipos TypeScript
npx tsc --noEmit
```

---

## 📌 Historial de Sesión (2026-10-01)

1. Sincronización masiva de cursos para los 245 alumnos de la institución en MongoDB.
2. Implementación de borrado seguro de cursos y restablecimiento de estudiantes huérfanos.
3. Implementación de borrado de respuestas y sobreescritura de intentos (individual, por curso y global).
4. Restablecimiento del curso `TRANSICION` con sus 12 estudiantes matriculados.
5. Verificación `npx tsc --noEmit` completada con 0 errores y despliegue a producción en GitHub / Vercel.
