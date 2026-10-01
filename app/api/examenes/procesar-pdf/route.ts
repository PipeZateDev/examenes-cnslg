import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { distribuirPesos } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // Allow up to 60s for Gemini AI processing on Vercel
export const dynamic = 'force-dynamic';

// POST /api/examenes/procesar-pdf
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'La variable de entorno GEMINI_API_KEY no está configurada en Vercel. Por favor configúrala en Project Settings > Environment Variables.'
    }, { status: 500 });
  }

  try {
    let textoExamen = '';
    let imagenesMap: Record<string, string> = {};
    let esAdmision = false;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      textoExamen = body.texto || '';
      imagenesMap = body.imagenes || {};
      esAdmision = !!body.esAdmision;
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      esAdmision = formData.get('esAdmision') === '1' || formData.get('esAdmision') === 'true';

      if (!file) {
        return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
      }

      const mimeType = file.type;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Extract text based on file type
      if (mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        textoExamen = data.text;
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        textoExamen = result.value;
      } else if (file.name.endsWith('.doc')) {
        return NextResponse.json({
          error: 'El formato .doc antiguo no está soportado. Por favor convierte el archivo a .docx o PDF.'
        }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Formato no soportado. Usa PDF o DOCX.' }, { status: 400 });
      }
    }

    if (!textoExamen.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del archivo.' }, { status: 422 });
    }

    if (textoExamen.length > 100000) {
      textoExamen = textoExamen.substring(0, 100000) + '\n[... texto truncado ...]';
    }

    // Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Eres un asistente pedagógico especializado en digitalizar exámenes del Colegio Nuevo San Luis Gonzaga para convertirlos en pruebas digitales evaluables pregunta por pregunta.

Analiza el siguiente texto de un examen y conviértelo en una lista de preguntas digitales estructuradas.
${esAdmision ? `IMPORTANTE: Este es un EXAMEN DE ADMISIÓN. Debes clasificar obligatoriamente cada pregunta en una de las 5 ÁREAS BÁSICAS PRINCIPALES:
- "Matemáticas" (para operaciones, problemas, lógica, secuencias, figuras)
- "Español" (para lectura, gramática, vocabulario, comprensión)
- "Ciencias Naturales" (para seres vivos, cuerpo, naturaleza, animales)
- "Ciencias Sociales" (para comunidad, valores, historia, geografía)
- "Inglés" (para vocabulario y expresiones en inglés)
Indica en el campo "area" de cada pregunta el nombre exacto de una de estas 5 áreas.` : `Indica en el campo "area" la materia o área de la pregunta.`}

Si en el texto hay referencias a imágenes como [IMAGEN_1], [IMAGEN_2], consérvalas o indícalas en el campo "imagen" (ej: "[IMAGEN_2]").

Sé conciso en los enunciados y opciones.
Para cada pregunta:
- enunciado: texto claro de la pregunta.
- area: nombre del área asignada.
- opciones: array de opciones con "letra" (A, B, C, D) y "texto".
- imagen: identificador de imagen si aplica (ej: "[IMAGEN_2]") o null.
- notas: breve criterio o null.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "titulo": "título del examen",
  "materia": "${esAdmision ? 'Prueba General de Admisión (5 Áreas Básicas)' : 'materia o asignatura'}",
  "preguntas": [
    {
      "enunciado": "texto de la pregunta",
      "area": "${esAdmision ? 'Matemáticas' : 'Materia'}",
      "opciones": [
        {"letra": "A", "texto": "opción A"},
        {"letra": "B", "texto": "opción B"},
        {"letra": "C", "texto": "opción C"},
        {"letra": "D", "texto": "opción D"}
      ],
      "imagen": null,
      "notas": null
    }
  ]
}

TEXTO DEL EXAMEN:
${textoExamen}`;

    // Resilient fallback chain for model availability and transient demand spikes
    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3-flash-preview',
      'gemini-flash-latest'
    ];

    let rawText = '';
    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 16384,
          },
        });
        if (response.text) {
          rawText = response.text;
          break;
        }
      } catch (err) {
        lastError = err as Error;
        console.warn(`Modelo ${modelName} falló, intentando siguiente...`, (err as Error).message);
      }
    }

    if (!rawText) {
      throw new Error(lastError?.message || 'No se pudo obtener respuesta de ningún modelo de IA');
    }
    
    // Resilient JSON parser that handles valid, markdown, and truncated JSON
    const extracted = repairAndParseQuestionsJson(rawText);
    const preguntas = extracted.preguntas || [];

    if (preguntas.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron preguntas de selección múltiple en el archivo.',
      }, { status: 422 });
    }

    // Weight calculation & image attachment
    // In admissions: Each area sums to 100%!
    // In regular: All questions sum to 100% total!
    let preguntasFinales: Array<{
      orden: number;
      enunciado: string;
      area?: string;
      opciones: Array<{ letra: string; texto: string }>;
      respuestaCorrecta: null;
      peso: number;
      imagen?: string | null;
      notas?: string | null;
    }> = [];

    if (esAdmision) {
      // Group by area
      const areasMap = new Map<string, typeof preguntas>();
      for (const p of preguntas) {
        const a = p.area || 'General';
        if (!areasMap.has(a)) areasMap.set(a, []);
        areasMap.get(a)!.push(p);
      }

      // Distribute 100% per area
      areasMap.forEach((qList) => {
        const pesosArea = distribuirPesos(qList.length);
        qList.forEach((q, idx) => {
          (q as { peso?: number }).peso = pesosArea[idx];
        });
      });

      let globalOrden = 1;
      for (const qList of Array.from(areasMap.values())) {
        for (const p of qList) {
          // Resolve image from imagesMap
          let imgData: string | null = null;
          if (p.imagen && imagenesMap[p.imagen]) {
            imgData = imagenesMap[p.imagen];
          } else {
            const m = p.enunciado.match(/\[IMAGEN_\d+\]/);
            if (m && imagenesMap[m[0]]) imgData = imagenesMap[m[0]];
          }

          preguntasFinales.push({
            orden: globalOrden++,
            enunciado: p.enunciado.replace(/\[IMAGEN_\d+\]/g, '').trim(),
            area: p.area || 'General',
            opciones: p.opciones,
            respuestaCorrecta: null,
            peso: (p as { peso?: number }).peso || 20,
            imagen: imgData,
            notas: p.notas || null,
          });
        }
      }
    } else {
      // Regular exam: 100% distributed evenly across all questions
      const pesos = distribuirPesos(preguntas.length);
      preguntasFinales = preguntas.map((p, i) => {
        let imgData: string | null = null;
        if (p.imagen && imagenesMap[p.imagen]) {
          imgData = imagenesMap[p.imagen];
        } else {
          const m = p.enunciado.match(/\[IMAGEN_\d+\]/);
          if (m && imagenesMap[m[0]]) imgData = imagenesMap[m[0]];
        }

        return {
          orden: i + 1,
          enunciado: p.enunciado.replace(/\[IMAGEN_\d+\]/g, '').trim(),
          area: p.area || undefined,
          opciones: p.opciones,
          respuestaCorrecta: null,
          peso: pesos[i],
          imagen: imgData,
          notas: p.notas || null,
        };
      });
    }

    // Auto-create exam directly in MongoDB
    const { getDb } = await import('@/lib/mongodb');
    const db = await getDb();
    const insertResult = await db.collection('ex_examenes').insertOne({
      titulo: extracted.titulo || (esAdmision ? 'Examen de Admisión' : 'Nuevo Examen'),
      descripcion: esAdmision ? 'Prueba de admisión dividida en las 5 áreas básicas principales (100% por área)' : '',
      materia: extracted.materia || (esAdmision ? 'Admisión General' : ''),
      cursos: [],
      anioLectivo: new Date().getFullYear(),
      esAdmision: esAdmision,
      estado: 'borrador',
      creadoPor: session.userId,
      creadoEn: new Date(),
      duracionMinutos: null,
      intentosPermitidos: 1,
      preguntas: preguntasFinales,
      claveAcceso: null,
    });

    const examenId = insertResult.insertedId.toString();

    return NextResponse.json({
      ok: true,
      id: examenId,
      titulo: extracted.titulo,
      materia: extracted.materia,
      preguntas: preguntasFinales,
      total: preguntasFinales.length,
    });

  } catch (err: unknown) {
    console.error('Error procesando PDF:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: `Error al procesar: ${message}` }, { status: 500 });
  }
}

interface ExtractedExamen {
  titulo?: string;
  materia?: string;
  preguntas: Array<{
    enunciado: string;
    area?: string;
    opciones: Array<{ letra: string; texto: string }>;
    imagen?: string | null;
    peso?: number;
    notas?: string | null;
  }>;
}

function repairAndParseQuestionsJson(raw: string): ExtractedExamen {
  // 1. Direct parse attempt
  try {
    return JSON.parse(raw);
  } catch (_) {}

  // 2. Remove markdown wrappers
  let str = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(str);
  } catch (_) {}

  // 3. If truncated, find last closing brace and close missing array/brackets
  const lastBrace = str.lastIndexOf('}');
  if (lastBrace !== -1) {
    let candidate = str.substring(0, lastBrace + 1);
    const openBrackets = (candidate.match(/\[/g) || []).length;
    const closeBrackets = (candidate.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      candidate += '\n]';
    }
    const openBraces = (candidate.match(/\{/g) || []).length;
    const closeBraces = (candidate.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) {
      candidate += '\n}';
    }
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }

  // 4. Regex fallback: extract individual questions
  const questions: ExtractedExamen['preguntas'] = [];
  const qRegex = /\{\s*"enunciado"\s*:\s*"([^"]+)"[\s\S]*?"opciones"\s*:\s*\[([\s\S]*?)\]\s*(?:,\s*"notas"\s*:\s*([^}]+))?\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = qRegex.exec(str)) !== null) {
    try {
      questions.push(JSON.parse(m[0]));
    } catch (_) {}
  }

  if (questions.length > 0) {
    return {
      titulo: 'Examen de Admisión',
      materia: 'General',
      preguntas: questions,
    };
  }

  throw new Error('No se pudo interpretar el formato de preguntas devuelto por la IA.');
}
