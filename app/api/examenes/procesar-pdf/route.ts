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
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      textoExamen = body.texto || '';
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File;

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

    // Do not cut off exams unnecessarily (Gemini easily supports 100k+ chars)
    if (textoExamen.length > 100000) {
      textoExamen = textoExamen.substring(0, 100000) + '\n[... texto truncado ...]';
    }

    // Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Eres un asistente especializado en digitalizar exámenes académicos para convertirlos en pruebas digitales evaluables pregunta por pregunta.

Analiza el siguiente texto de un examen y conviértelo en una lista de preguntas digitales estructuradas.
Sé claro y conciso en los enunciados y opciones.
Para cada pregunta o actividad del examen:
- enunciado: redacción clara de la pregunta, ejercicio o problema.
- opciones: array de opciones con "letra" (A, B, C, D) y "texto". Si en el examen original las opciones no tienen letras explícitas o es una lista de ítems, formula o asigna letras A, B, C, D correspondientes.
- notas: breve criterio de evaluación o null si no hay.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "titulo": "título del examen",
  "materia": "materia o área",
  "preguntas": [
    {
      "enunciado": "texto de la pregunta",
      "opciones": [
        {"letra": "A", "texto": "opción A"},
        {"letra": "B", "texto": "opción B"},
        {"letra": "C", "texto": "opción C"},
        {"letra": "D", "texto": "opción D"}
      ],
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

    // Add order and auto-weights
    const pesos = distribuirPesos(preguntas.length);
    const preguntasConOrden = preguntas.map((p, i: number) => ({
      orden: i + 1,
      enunciado: p.enunciado,
      opciones: p.opciones,
      respuestaCorrecta: null, // docente must set this
      peso: pesos[i],
      notas: p.notas || null,
    }));

    return NextResponse.json({
      ok: true,
      titulo: extracted.titulo,
      materia: extracted.materia,
      preguntas: preguntasConOrden,
      total: preguntasConOrden.length,
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
    opciones: Array<{ letra: string; texto: string }>;
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
