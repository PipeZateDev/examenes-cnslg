import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { distribuirPesos } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';

// POST /api/examenes/procesar-pdf
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const mimeType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());
    let textoExamen = '';

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

    if (!textoExamen.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del archivo.' }, { status: 422 });
    }

    // Trim text to avoid token limits (max ~12000 chars)
    if (textoExamen.length > 12000) {
      textoExamen = textoExamen.substring(0, 12000) + '\n[... texto truncado ...]';
    }

    // Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Eres un asistente especializado en extraer preguntas de exámenes académicos.

Analiza el siguiente texto de un examen y extrae TODAS las preguntas de selección múltiple.

Para cada pregunta, devuelve:
- enunciado: el texto completo de la pregunta
- opciones: array de opciones, cada una con "letra" (A, B, C, D, o E) y "texto"
- notas: cualquier nota adicional importante (o null si no hay)

Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "titulo": "título del examen si lo encuentras, sino null",
  "materia": "materia/asignatura si la encuentras, sino null",
  "preguntas": [
    {
      "enunciado": "texto de la pregunta",
      "opciones": [
        {"letra": "A", "texto": "texto opción A"},
        {"letra": "B", "texto": "texto opción B"},
        {"letra": "C", "texto": "texto opción C"},
        {"letra": "D", "texto": "texto opción D"}
      ],
      "notas": null
    }
  ]
}

Si una pregunta no tiene opciones bien definidas, inclúyela igual con las opciones que puedas inferir.
Si el texto no contiene preguntas de selección múltiple, devuelve preguntas: [].

TEXTO DEL EXAMEN:
${textoExamen}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const rawText = response.text || '';
    
    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        error: 'No se pudo procesar el examen con IA. Intenta con un archivo más claro.',
        rawText: rawText.substring(0, 500),
      }, { status: 422 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    const preguntas = extracted.preguntas || [];

    if (preguntas.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron preguntas de selección múltiple en el archivo.',
      }, { status: 422 });
    }

    // Add order and auto-weights
    const pesos = distribuirPesos(preguntas.length);
    const preguntasConOrden = preguntas.map((p: {
      enunciado: string;
      opciones: Array<{ letra: string; texto: string }>;
      notas?: string;
    }, i: number) => ({
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
