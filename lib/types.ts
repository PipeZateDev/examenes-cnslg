// ─── Types ────────────────────────────────────────────────────────────────────

export type Rol = 'admin' | 'directivo' | 'coordinador' | 'supervisor' | 'docente' | 'estudiante';

export interface ExUsuario {
  _id?: string;
  username: string;
  passwordHash: string;
  rol: Rol;
  nombre: string;
  apellido?: string;
  email?: string;
  cursosAsignados: string[];   // Course _id refs from reportes-cnslg
  materiasAsignadas: string[]; // Subject _id refs from reportes-cnslg
  activo: boolean;
  creadoEn?: Date;
  actualizadoEn?: Date;
}

export interface OpcionPregunta {
  letra: 'A' | 'B' | 'C' | 'D' | 'E' | string;
  texto: string;
  imagen?: string | null;
}

export interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: OpcionPregunta[];
  respuestaCorrecta?: 'A' | 'B' | 'C' | 'D' | 'E' | string | null;
  peso: number; // integer, all weights sum to 100 (or 100 per area in admissions)
  area?: string; // Matemáticas, Español, Ciencias Naturales, Ciencias Sociales, Inglés
  imagen?: string | null; // base64 or URL
  contexto?: string | null;
  notas?: string | null;
}

export type EstadoExamen = 
  | 'borrador' 
  | 'pendiente_aprobacion' 
  | 'aprobado' 
  | 'activo' 
  | 'cerrado';

export interface ExExamen {
  _id?: string;
  titulo: string;
  descripcion?: string;
  materia?: string;         // Subject name
  materiaId?: string;       // Subject _id ref
  cursos: string[];         // Course _id refs
  anioLectivo: number;
  esAdmision: boolean;      // true = sección de admisiones aparte
  estado: EstadoExamen;
  creadoPor: string;         // usuario _id
  creadoEn: Date;
  aprobadoPor?: string;
  aprobadoEn?: Date;
  duracionMinutos?: number;  // null = sin límite
  intentosPermitidos: number; // default 1
  preguntas: Pregunta[];
  // Daily access key generated per-exam per-day by docente
  claveAcceso?: string;      // 6 chars, shown to docente
}

export type EstadoIntento = 'en_progreso' | 'enviado' | 'bloqueado';

export interface RespuestaIntento {
  preguntaOrden: number;
  opcionSeleccionada: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  esCorrecta?: boolean;
  puntajeObtenido?: number;
}

export interface CalificacionArea {
  area: string;
  puntaje: number;          // 0 - 100%
  totalPreguntas: number;
  correctas: number;
}

export interface ExIntento {
  _id?: string;
  examenId: string;
  estudianteId: string;        // numeroDocumento from reportes Student
  estudianteNombre: string;
  estudianteCurso?: string;
  estado: EstadoIntento;
  iniciadoEn: Date;
  enviadoEn?: Date;
  respuestas: RespuestaIntento[];
  calificacionFinal?: number;  // 0-100
  calificacionesPorArea?: CalificacionArea[]; // Solo para pruebas de admisión
  intentoNumero: number;
}

// ─── Daily codes (close code + exam access keys) ─────────────────────────────
export interface ExClaveDia {
  _id?: string;
  fecha: string;       // YYYY-MM-DD
  codigoCierre: string; // 6 digits, derived deterministically from secret + date
  examenesClaves: {    // per-exam daily access key shown to docentes
    examenId: string;
    clave: string;     // 6 alphanumeric
  }[];
}

// ─── Habilitación de intentos adicionales (Admin / Directivo) ─────────────────
export interface ExHabilitacion {
  _id?: string;
  examenId: string;
  estudianteId: string;
  intentosPermitidos: number;
  autorizadoPor?: string;
  autorizadoPorId?: string;
  autorizadoEn?: Date;
}

// ─── Session payload in JWT ───────────────────────────────────────────────────
export interface SessionPayload {
  userId: string;
  username: string;
  rol: Rol;
  nombre: string;
}

// ─── Student from reportes-cnslg (read-only) ─────────────────────────────────
export interface StudentReportes {
  _id: string;
  numeroDocumento: string;
  tipoDocumento: string;
  nombreCompleto: string;
  foto?: { data: string; contentType: string } | null;
  fotoPosicionX?: number;
  fotoPosicionY?: number;
}

// ─── Course from reportes-cnslg (read-only) ──────────────────────────────────
export interface CourseReportes {
  _id: string;
  nombre: string;
  anioLectivo: number;
}
