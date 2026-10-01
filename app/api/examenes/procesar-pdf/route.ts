import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { distribuirPesos } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import zlib from 'zlib';

export const maxDuration = 60; // Allow up to 60s for Gemini AI processing on Vercel
export const dynamic = 'force-dynamic';

async function extractImagesFromPdf(buffer: Buffer): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const str = buffer.toString('latin1');
  const streamRegex = /<<([\s\S]*?\/Subtype\s*\/Image[\s\S]*?)>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  let count = 0;

  let sharpModule: any = null;
  try {
    sharpModule = (await import('sharp')).default;
  } catch (e) {
    console.warn('sharp not available:', e);
  }

  while ((match = streamRegex.exec(str)) !== null) {
    count++;
    const placeholder = `[IMAGEN_${count}]`;
    const dict = match[1];
    const streamStart = match.index + match[0].length;
    const endstreamPos = str.indexOf('endstream', streamStart);
    if (endstreamPos === -1) continue;

    let rawData = buffer.subarray(streamStart, endstreamPos);
    while (rawData.length > 0 && (rawData[rawData.length - 1] === 10 || rawData[rawData.length - 1] === 13)) {
      rawData = rawData.subarray(0, rawData.length - 1);
    }

    const isDCT = dict.includes('/DCTDecode');
    const isFlate = dict.includes('/FlateDecode');
    const widthMatch = dict.match(/\/Width\s+(\d+)/);
    const heightMatch = dict.match(/\/Height\s+(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

    try {
      if (isDCT && rawData[0] === 0xFF && rawData[1] === 0xD8) {
        if (sharpModule) {
          const jpegBuf = await sharpModule(rawData)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          map[placeholder] = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
        } else {
          map[placeholder] = `data:image/jpeg;base64,${rawData.toString('base64')}`;
        }
      } else if (isFlate && width > 0 && height > 0) {
        const uncompressed = zlib.inflateSync(rawData);
        if (sharpModule) {
          const channels = uncompressed.length === width * height ? 1 : 3;
          const pngBuf = await sharpModule(uncompressed, {
            raw: { width, height, channels }
          })
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          map[placeholder] = `data:image/png;base64,${pngBuf.toString('base64')}`;
        }
      }
    } catch (e) {
      console.warn(`Error procesando ${placeholder}:`, (e as Error).message);
    }
  }
  return map;
}

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
    let isPdf = false;
    let pdfBuffer: Buffer | null = null;
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

      // Extract text and images based on file type
      if (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        isPdf = true;
        pdfBuffer = buffer;
        try {
          imagenesMap = await extractImagesFromPdf(buffer);
        } catch (imgErr) {
          console.warn('Advertencia al extraer imágenes del PDF:', imgErr);
        }

        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        textoExamen = data.text || '';
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        textoExamen = result.value;
      } else if (file.name.toLowerCase().endsWith('.doc')) {
        return NextResponse.json({
          error: 'El formato .doc antiguo no está soportado. Por favor convierte el archivo a .docx o PDF.'
        }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Formato no soportado. Usa PDF o DOCX.' }, { status: 400 });
      }
    }

    if (!textoExamen.trim() && !isPdf) {
      return NextResponse.json({ error: 'No se pudo extraer texto del archivo.' }, { status: 422 });
    }

    if (textoExamen.length > 100000) {
      textoExamen = textoExamen.substring(0, 100000) + '\n[... texto truncado ...]';
    }

    const totalImgCount = Object.keys(imagenesMap).length;

    // Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Eres un asistente pedagógico de élite especializado en digitalizar exámenes del Colegio Nuevo San Luis Gonzaga para convertirlos en pruebas digitales interactivas pregunta por pregunta.

Analiza minuciosamente el documento del examen y extrae TODAS las preguntas de selección múltiple con la máxima fidelidad pedagógica.

REGLAS OBLIGATORIAS:

1. OMISIÓN DEL ENCABEZADO INSTITUCIONAL:
   - OMITE COMPLETAMENTE el encabezado del colegio (logo o escudo [IMAGEN_1], nombre "Colegio Nuevo San Luis Gonzaga", fecha, año lectivo, grado, líneas de nombre de estudiante, indicaciones iniciales o rúbricas de presentación).
   - NUNCA conviertas el encabezado institucional en una pregunta ni uses [IMAGEN_1] (el escudo) en preguntas o respuestas.
   - Únicamente utiliza esa información para generar un "titulo" descriptivo y limpio (ej: "Examen de Admisión Grado 2° - 2027").

2. IMÁGENES EN PREGUNTAS Y EN OPCIONES (SECUENCIAS, SIMETRÍAS, FIGURAS):
   - Se han identificado y extraído ${totalImgCount} imágenes en orden secuencial: [IMAGEN_1] a [IMAGEN_${totalImgCount}].
   - Si una pregunta tiene una imagen de apoyo o diagrama principal (ej: un ábaco, un gráfico, una secuencia inicial, figura botánica), asígnala al campo "imagen" de la pregunta (ej: "[IMAGEN_2]").
   - Si las OPCIONES de respuesta (A, B, C, D) son imágenes (muy común en secuencias, simetrías, figuras o piezas faltantes):
     - Asigna el identificador de la imagen correspondiente en el campo "imagen" de cada opción (ej: opción A: "imagen": "[IMAGEN_5]", opción B: "imagen": "[IMAGEN_6]", etc.).
     - Si la opción no tiene texto adicional, coloca en "texto" una etiqueta clara como "Opción A", "Opción B" o la descripción de la figura.
     - Si la opción es solo texto sin imagen, coloca "imagen": null.

3. CONTEXTOS, LECTURAS Y SITUACIONES COMPARTIDAS ENTRE VARIAS PREGUNTAS:
   - Si un texto, lectura, situación o imagen indica que sirve para varias preguntas (por ejemplo: "Lee la siguiente situación y responde las preguntas 16 y 17", o "Con base en la siguiente lectura contesta las preguntas 1 a 3"):
     DEBES INCLUIR el texto de la situación y la imagen asociada en EL ENUNCIADO DE CADA UNA de esas preguntas (en la 16 y en la 17).
     De esta forma, cuando el estudiante esté en la pregunta 17, tendrá el texto y la imagen frente a él y no tendrá que retroceder a la pregunta 16.

4. CLASIFICACIÓN EN 5 ÁREAS BÁSICAS (PARA EXÁMENES DE ADMISIÓN):
   ${esAdmision ? `Este es un EXAMEN DE ADMISIÓN. Clasifica obligatoriamente cada pregunta en el campo "area" con uno de estos 5 valores exactos:
   - "Matemáticas" (operaciones, problemas, lógica, simetría, secuencias numéricas, conteo)
   - "Español" (sílabas, oraciones, comprensión lectora, vocabulario, gramática)
   - "Ciencias Naturales" (cuerpo humano, sentidos, animales, plantas, materia, estados físicos)
   - "Ciencias Sociales" (familia, comunidad, normas, convivencia, días de la semana, entorno)
   - "Inglés" (vocabulario, animales, descripciones, partes de la casa)` : `Indica en el campo "area" la asignatura o materia correspondiente.`}

5. REVISIÓN RIGUROSA Y CAMPO "notas":
   - Extrae rigurosamente todas las preguntas numeradas del documento sin omitir ninguna.
   - Si detectas alguna ambigüedad, opción faltante, o detalle que el docente deba verificar antes de activar el examen, regístralo brevemente en el campo "notas" de la pregunta para orientar al docente en el editor.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "titulo": "título limpio del examen",
  "materia": "${esAdmision ? 'Prueba General de Admisión (5 Áreas Básicas)' : 'materia o asignatura'}",
  "preguntas": [
    {
      "enunciado": "texto completo de la pregunta (incluyendo la situación compartida si aplica)",
      "area": "${esAdmision ? 'Matemáticas' : 'Materia'}",
      "imagen": "[IMAGEN_X] o null",
      "opciones": [
        {"letra": "A", "texto": "texto de opción o Opción A", "imagen": "[IMAGEN_Y] o null"},
        {"letra": "B", "texto": "texto de opción o Opción B", "imagen": "[IMAGEN_Z] o null"},
        {"letra": "C", "texto": "texto de opción o Opción C", "imagen": null},
        {"letra": "D", "texto": "texto de opción o Opción D", "imagen": null}
      ],
      "notas": null
    }
  ]
}

TEXTO DEL EXAMEN:
${textoExamen}`;

    // Resilient fallback chain with retry for model availability and transient demand spikes
    const modelsToTry = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-flash-latest'
    ];

    let rawText = '';
    let lastError: Error | null = null;

    // Strategy 1: Multimodal PDF (if PDF)
    // Strategy 2: Text-only prompt (fallback if multimodal exceeds token limits/quotas)
    const contentStrategies: any[] = [];
    if (isPdf && pdfBuffer) {
      contentStrategies.push([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBuffer.toString('base64'),
          },
        },
        prompt,
      ]);
    }
    contentStrategies.push(prompt);

    for (const contents of contentStrategies) {
      for (const modelName of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
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
            console.warn(`Modelo ${modelName} (intento ${attempt}) falló:`, (err as Error).message);
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        if (rawText) break;
      }
      if (rawText) break;
    }

    if (!rawText) {
      const errMsg = lastError?.message || '';
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        return NextResponse.json({
          error: 'El servicio de IA ha alcanzado temporalmente su límite de peticiones por minuto. Por favor espera 30 segundos y vuelve a intentar.'
        }, { status: 429 });
      }
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
        return NextResponse.json({
          error: 'El servicio de IA está experimentando alta demanda momentánea. Por favor intenta de nuevo en unos momentos.'
        }, { status: 503 });
      }
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

    // Helper to resolve image placeholder
    function resolveImg(imgKey: string | null | undefined, text: string): string | null {
      if (imgKey) {
        const trimmed = imgKey.trim();
        if (imagenesMap[trimmed]) return imagenesMap[trimmed];
        const m1 = trimmed.match(/\[IMAGEN_\d+\]/);
        if (m1 && imagenesMap[m1[0]]) return imagenesMap[m1[0]];
      }
      const m = (text || '').match(/\[IMAGEN_\d+\]/);
      if (m && imagenesMap[m[0]]) return imagenesMap[m[0]];
      return null;
    }

    // Weight calculation & image attachment
    // In admissions: Each area sums to 100%!
    // In regular: All questions sum to 100% total!
    let preguntasFinales: Array<{
      orden: number;
      enunciado: string;
      area?: string;
      opciones: Array<{ letra: string; texto: string; imagen?: string | null }>;
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
          const imgData = resolveImg(p.imagen, p.enunciado);
          const opcionesMapeadas = (p.opciones || []).map(op => {
            const opImg = resolveImg(op.imagen, op.texto);
            let cleanedText = (op.texto || '').replace(/\[IMAGEN_\d+\]/g, '').trim();
            if (!cleanedText && opImg) {
              cleanedText = `Opción ${op.letra}`;
            }
            return {
              letra: op.letra,
              texto: cleanedText,
              imagen: opImg,
            };
          });

          preguntasFinales.push({
            orden: globalOrden++,
            enunciado: p.enunciado.replace(/\[IMAGEN_\d+\]/g, '').trim(),
            area: p.area || 'General',
            opciones: opcionesMapeadas,
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
        const imgData = resolveImg(p.imagen, p.enunciado);
        const opcionesMapeadas = (p.opciones || []).map(op => {
          const opImg = resolveImg(op.imagen, op.texto);
          let cleanedText = (op.texto || '').replace(/\[IMAGEN_\d+\]/g, '').trim();
          if (!cleanedText && opImg) {
            cleanedText = `Opción ${op.letra}`;
          }
          return {
            letra: op.letra,
            texto: cleanedText,
            imagen: opImg,
          };
        });

        return {
          orden: i + 1,
          enunciado: p.enunciado.replace(/\[IMAGEN_\d+\]/g, '').trim(),
          area: p.area || undefined,
          opciones: opcionesMapeadas,
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
    console.error('Error procesando archivo:', err);
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
    opciones: Array<{ letra: string; texto: string; imagen?: string | null }>;
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
