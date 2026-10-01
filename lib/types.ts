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
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  texto: string;
}

export interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: OpcionPregunta[];
  respuestaCorrecta: 'A' | 'B' | 'C' | 'D' | 'E';
  peso: number; // integer, all weights sum to 100
  imagen?: string; // base64 or URL
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
