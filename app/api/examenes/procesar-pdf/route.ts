import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { distribuirPesos } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import zlib from 'zlib';

export const maxDuration = 60; // Allow up to 60s for Gemini AI processing on Vercel
export const dynamic = 'force-dynamic';

interface ExtractedImagesResult {
  fullMap: Record<string, string>; // Base64 data URIs for saving
  thumbnails: Record<string, { mime: string; data: string }>; // Compressed thumbnails for AI visual inspection
}

async function extractImagesFromPdf(buffer: Buffer): Promise<ExtractedImagesResult> {
  const fullMap: Record<string, string> = {};
  const thumbnails: Record<string, { mime: string; data: string }> = {};

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
          const fullBuf = await sharpModule(rawData)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          fullMap[placeholder] = `data:image/jpeg;base64,${fullBuf.toString('base64')}`;

          const thumbBuf = await sharpModule(rawData)
            .resize(350, 350, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          thumbnails[placeholder] = { mime: 'image/jpeg', data: thumbBuf.toString('base64') };
        } else {
          fullMap[placeholder] = `data:image/jpeg;base64,${rawData.toString('base64')}`;
          thumbnails[placeholder] = { mime: 'image/jpeg', data: rawData.toString('base64') };
        }
      } else if (isFlate && width > 0 && height > 0) {
        const uncompressed = zlib.inflateSync(rawData);
        if (sharpModule) {
          const channels = uncompressed.length === width * height ? 1 : 3;
          const fullBuf = await sharpModule(uncompressed, {
            raw: { width, height, channels }
          })
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          fullMap[placeholder] = `data:image/png;base64,${fullBuf.toString('base64')}`;

          const thumbBuf = await sharpModule(uncompressed, {
            raw: { width, height, channels }
          })
            .resize(350, 350, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          thumbnails[placeholder] = { mime: 'image/jpeg', data: thumbBuf.toString('base64') };
        }
      }
    } catch (e) {
      console.warn(`Error procesando ${placeholder}:`, (e as Error).message);
    }
  }

  return { fullMap, thumbnails };
}

interface ExtractedDocxResult {
  texto: string;
  fullMap: Record<string, string>;
  thumbnails: Record<string, { mime: string; data: string }>;
}

async function extractDocxWithTransforms(buffer: Buffer): Promise<ExtractedDocxResult> {
  const JSZip = (await import('jszip')).default;
  const mammoth = (await import('mammoth')).default;
  let sharpModule: any = null;
  try {
    sharpModule = (await import('sharp')).default;
  } catch (e) {
    console.warn('sharp no disponible:', e);
  }

  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');

  if (!docXml || !relsXml) {
    throw new Error('Documento docx inválido o sin estructura OpenXML.');
  }

  // Parse relationships
  const rels: Record<string, string> = {};
  const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = relRegex.exec(relsXml)) !== null) {
    rels[rMatch[1]] = rMatch[2];
  }

  const fullMap: Record<string, string> = {};
  const thumbnails: Record<string, { mime: string; data: string }> = {};
  let count = 0;

  // Track drawings in exact document.xml sequence
  const drawingRegex = /<w:drawing>([\s\S]*?)<\/w:drawing>/g;
  let dMatch: RegExpExecArray | null;

  while ((dMatch = drawingRegex.exec(docXml)) !== null) {
    count++;
    const placeholder = `[IMAGEN_${count}]`;
    const content = dMatch[1];
    const blipMatch = content.match(/r:embed="([^"]+)"/);
    if (!blipMatch) continue;

    const rId = blipMatch[1];
    const targetPath = rels[rId];
    if (!targetPath) continue;

    const zipPath = targetPath.startsWith('word/') ? targetPath : `word/${targetPath.replace(/^\//, '')}`;
    const rawBuffer = await zip.file(zipPath)?.async('nodebuffer');
    if (!rawBuffer) continue;

    // Parse crop parameters (<a:srcRect l="38682" t="37182" r="39093" b="25629"/>)
    const srcRectMatch = content.match(/<a:srcRect([^>]*)\/?>/);
    let l = 0, t = 0, r = 0, b = 0;
    if (srcRectMatch) {
      const lMatch = srcRectMatch[1].match(/\bl="(\d+)"/);
      const tMatch = srcRectMatch[1].match(/\bt="(\d+)"/);
      const rMatch = srcRectMatch[1].match(/\br="(\d+)"/);
      const bMatch = srcRectMatch[1].match(/\bb="(\d+)"/);
      if (lMatch) l = parseInt(lMatch[1], 10) / 100000;
      if (tMatch) t = parseInt(tMatch[1], 10) / 100000;
      if (rMatch) r = parseInt(rMatch[1], 10) / 100000;
      if (bMatch) b = parseInt(bMatch[1], 10) / 100000;
    }

    // Parse transform (<a:xfrm rot="10800000" flipH="1" flipV="1">)
    const xfrmMatch = content.match(/<a:xfrm([^>]*)>/);
    let rotDeg = 0;
    let flipH = false;
    let flipV = false;
    if (xfrmMatch) {
      const rotMatch = xfrmMatch[1].match(/\brot="(\d+)"/);
      if (rotMatch) rotDeg = Math.round(parseInt(rotMatch[1], 10) / 60000);
      if (/\bflipH="1"/.test(xfrmMatch[1])) flipH = true;
      if (/\bflipV="1"/.test(xfrmMatch[1])) flipV = true;
    }

    try {
      if (sharpModule) {
        const meta = await sharpModule(rawBuffer).metadata();
        let step1Buffer = rawBuffer;

        // Step 1: Crop precisely according to teacher's crop in Word
        if (meta.width && meta.height && (l > 0 || t > 0 || r > 0 || b > 0)) {
          const left = Math.min(meta.width - 1, Math.max(0, Math.round(meta.width * l)));
          const top = Math.min(meta.height - 1, Math.max(0, Math.round(meta.height * t)));
          const width = Math.min(meta.width - left, Math.max(1, Math.round(meta.width * (1 - l - r))));
          const height = Math.min(meta.height - top, Math.max(1, Math.round(meta.height * (1 - t - b))));
          step1Buffer = await sharpModule(rawBuffer).extract({ left, top, width, height }).toBuffer();
        }

        // Step 2: Apply rotation and flips
        let step2Pipeline = sharpModule(step1Buffer);
        if (flipH) step2Pipeline = step2Pipeline.flop();
        if (flipV) step2Pipeline = step2Pipeline.flip();
        if (rotDeg !== 0) step2Pipeline = step2Pipeline.rotate(rotDeg);
        const transformedBuffer = await step2Pipeline.toBuffer();

        // Step 3: High-quality full image & thumbnail
        const fullBuf = await sharpModule(transformedBuffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const thumbBuf = await sharpModule(transformedBuffer)
          .resize(350, 350, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();

        fullMap[placeholder] = `data:image/jpeg;base64,${fullBuf.toString('base64')}`;
        thumbnails[placeholder] = { mime: 'image/jpeg', data: thumbBuf.toString('base64') };
      } else {
        fullMap[placeholder] = `data:image/png;base64,${rawBuffer.toString('base64')}`;
        thumbnails[placeholder] = { mime: 'image/png', data: rawBuffer.toString('base64') };
      }
    } catch (err) {
      console.warn(`Error procesando recorte/transform de ${placeholder}:`, (err as Error).message);
    }
  }

  // Use mammoth to extract text with matching [IMAGEN_X] placeholders and font styles (bold, underline, italic)
  let mammothImgIndex = 0;
  const mammothOptions = {
    convertImage: (mammoth.images as any).inline(function() {
      mammothImgIndex++;
      const ph = `[IMAGEN_${mammothImgIndex}]`;
      return Promise.resolve({ src: ph });
    }),
    styleMap: [
      "u => u",
      "b => strong",
      "i => em",
      "strike => s"
    ]
  };

  const mammothResult = await mammoth.convertToHtml({ buffer }, mammothOptions);
  const texto = mammothResult.value
    .replace(/<img[^>]*src="(\[IMAGEN_\d+\])"[^>]*>/gi, '\n$1\n')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!u|\/u)[^>]+>/g, '') // Strip all other HTML tags except <u> and </u>
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { texto, fullMap, thumbnails };
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
    let imagenesThumbnails: Record<string, { mime: string; data: string }> = {};
    let esAdmision = false;
    let isPdf = false;
    let pdfBuffer: Buffer | null = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      textoExamen = body.texto || '';
      imagenesMap = body.imagenes || {};
      esAdmision = !!body.esAdmision;

      // Create lightweight thumbnails from incoming images
      for (const [key, uri] of Object.entries(imagenesMap)) {
        const match = (uri || '').match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
          imagenesThumbnails[key] = { mime: match[1], data: match[2] };
        }
      }
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
          const imgResult = await extractImagesFromPdf(buffer);
          imagenesMap = imgResult.fullMap;
          imagenesThumbnails = imgResult.thumbnails;
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
        try {
          const docxResult = await extractDocxWithTransforms(buffer);
          textoExamen = docxResult.texto;
          imagenesMap = docxResult.fullMap;
          imagenesThumbnails = docxResult.thumbnails;
        } catch (docxErr) {
          console.warn('Error al extraer docx con transforms:', docxErr);
          const mammoth = (await import('mammoth')).default;
          let imgIndex = 0;
          const options = {
            convertImage: (mammoth.images as any).inline(function() {
              imgIndex++;
              return Promise.resolve({ src: `[IMAGEN_${imgIndex}]` });
            }),
            styleMap: [
              "u => u",
              "b => strong",
              "i => em",
              "strike => s"
            ]
          };
          const result = await mammoth.convertToHtml({ buffer }, options);
          textoExamen = result.value
            .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
            .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
            .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
            .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
            .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<(?!u|\/u)[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }
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

    // Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Eres un diseñador pedagógico de élite especializado en digitalizar exámenes del Colegio Nuevo San Luis Gonzaga para convertirlos en pruebas digitales interactivas pregunta por pregunta.

Analiza minuciosamente el examen y extrae TODAS las preguntas de selección múltiple con la máxima fidelidad pedagógica.

REGLAS OBLIGATORIAS:

1. OMISIÓN TOTAL Y RIGUROSA DEL ENCABEZADO INSTITUCIONAL:
   - OMITE COMPLETAMENTE el encabezado del colegio (logo o escudo institucional, nombre "Colegio Nuevo San Luis Gonzaga", fecha, año lectivo, grado, líneas de nombre de estudiante "Nombre: ________", indicaciones iniciales o rúbricas de presentación).
   - NUNCA conviertas el encabezado institucional en una pregunta.
   - NUNCA asignes logos, escudos o encabezados institucionales a ninguna pregunta. Si una imagen es un logo o escudo del colegio, IGNÓRALA Y NO LA ASIGNES.
   - Las preguntas reales del examen SIEMPRE comienzan a partir de la Pregunta 1 numerada en el cuerpo del documento.
   - Únicamente utiliza la información del encabezado para generar un "titulo" descriptivo y limpio (ej: "Examen de Admisión Grado 2° - 2027").

2. ASOCIACIÓN VISUAL DIRECTA Y EXACTA DE IMÁGENES REALES DEL DOCUMENTO:
   - Te he adjuntado visualmente cada una de las imágenes extraídas del archivo etiquetadas con su identificador [IMAGEN_X].
   - MIRA atentamente el contenido visual de cada [IMAGEN_X] y el enunciado de cada pregunta:
     - Asocia a cada pregunta o a sus opciones la imagen real que CORRESPONDA DIRECTAMENTE a su contenido temático (ej: la imagen del ábaco al problema del ábaco, la imagen de bombas/globos al problema de globos, la imagen de simetría al problema de simetría, la imagen de calzado a la familia de palabras de zapatos, la imagen de plantas al problema de plantas, etc.).
     - IMPORTANTÍSIMO - IMÁGENES EN OPCIONES DE RESPUESTA:
       Si las opciones de respuesta (A, B, C, D) de una pregunta contienen figuras, diagramas, piezas gráficas o imágenes en vez de texto (por ejemplo, en preguntas de simetría como la pregunta 4, secuencias gráficas o figuras geométricas donde las opciones 'a.', 'b.', 'c.' son figuras o imágenes), DEBES asignar a cada opción correspondiente su respectivo [IMAGEN_X] en el campo "imagen" del objeto en el arreglo "opciones".
       Si la opción solo tiene la figura/imagen, asigna en "texto" algo limpio como "Opción A" o la letra, y en "imagen" el identificador "[IMAGEN_X]".
       Si una opción particular es solo texto (como 'd. Ninguna' o 'd. Ninguna de las anteriores'), deja su "imagen": null y en "texto": "Ninguna".
     - Si una pregunta NO tiene imagen en el documento original, coloca estrictamente "imagen": null. NUNCA generes ni inventes imágenes automáticas ni SVGs.

3. PRESERVACIÓN FIDELÍSIMA DE FORMATO DE FUENTE, TAMAÑOS Y SALTOS DE LÍNEA:
   - SALTOS DE LÍNEA Y PÁRRAFOS:
     - MANTÉN FIELMENTE todos los saltos de línea (\n), estrofas de poemas, versos, listas, diálogos y párrafos del texto original en el campo "enunciado" y en las "opciones". NUNCA unas todo en un solo párrafo apretado.
   - NEGRITA Y SUBRAYADO EN PALABRAS DESTACADAS:
     - Si en el documento original alguna palabra, frase o número del enunciado o de las opciones tiene formato especial (como **Negrita**, <u>Subrayado</u>, o *Cursiva*) porque es una palabra clave o destacada para la pregunta (ejemplos: "NO es correcto", "antónimo de <u>rápido</u>", "palabra **SUBRAYADA**", "significado de la expresión <u>a regañadientes</u>", "¿Cuál de las siguientes opciones **NO** cumple...?", etc.):
     - DEBES PRESERVAR OBLIGATORIAMENTE ese formato exacto usando:
       - Negrita: **palabra**
       - Subrayado: <u>palabra</u>
       - Cursiva: *palabra*
     - NUNCA elimines las negritas o subrayados de las palabras destacadas.
   - TÍTULOS Y TAMAÑOS:
     - Si una lectura o situación compartida tiene un título destacado, indícalo con encabezado markdown (# Título o ## Subtítulo).

4. DETECCIÓN Y ASIGNACIÓN AUTOMÁTICA DE LA TABLA DE RESPUESTAS CORRECTAS:
   - Al final del examen o en el documento suele venir una **Tabla de Respuestas**, **Clave de Respuestas**, **Hoja de Claves**, o matriz con las respuestas correctas (ej: "1: B, 2: A, 3: C, 4: D...", o una tabla con columnas Número | Clave | Área).
   - DEBES EXTRAER con extrema exactitud la letra correcta de cada pregunta y asignarla en el campo "respuestaCorrecta": "A" | "B" | "C" | "D" (en mayúscula).
   - OMISIÓN TOTAL DE LA TABLA: Esta tabla de respuestas es EXCLUSIVA para calificar internamente. NUNCA la conviertas en una pregunta, ni la agregues al texto del enunciado de ninguna pregunta. Los alumnos NO deben ver esta tabla en ningún momento.
   - Si el documento no contiene tabla de respuestas, asigna "respuestaCorrecta": null.

5. CONTEXTOS, LECTURAS Y SITUACIONES COMPARTIDAS ENTRE VARIAS PREGUNTAS:
   - Si un texto, lectura, situación o imagen indica que sirve para varias preguntas (por ejemplo: "Lee la siguiente situación y responde las preguntas 16 y 17", o "Con base en la siguiente lectura contesta las preguntas 1 a 3"):
     DEBES INCLUIR el texto de la situación y la imagen asociada en EL ENUNCIADO DE CADA UNA de esas preguntas (en la 16 y en la 17).
     De esta forma, cuando el estudiante esté en la pregunta 17, tendrá el texto y la imagen frente a él y no tendrá que retroceder a la pregunta 16.

6. CLASIFICACIÓN EN 5 ÁREAS BÁSICAS (PARA EXÁMENES DE ADMISIÓN):
   ${esAdmision ? `Este es un EXAMEN DE ADMISIÓN. Clasifica obligatoriamente cada pregunta en el campo "area" con uno de estos 5 valores exactos:
   - "Matemáticas" (operaciones, problemas, lógica, simetría, secuencias numéricas, conteo)
   - "Español" (sílabas, oraciones, comprensión lectora, vocabulario, gramática)
   - "Ciencias Naturales" (cuerpo humano, sentidos, animales, plantas, materia, estados físicos)
   - "Ciencias Sociales" (familia, comunidad, normas, convivencia, días de la semana, entorno)
   - "Inglés" (vocabulario, animales, descripciones, partes de la casa)` : `Indica en el campo "area" la asignatura o materia correspondiente.`}

7. REVISIÓN RIGUROSA Y CAMPO "notas":
   - Extrae rigurosamente todas las preguntas numeradas del documento sin omitir ninguna.
   - Si detectas alguna ambigüedad, opción faltante, o detalle que el docente deba verificar antes de activar el examen, regístralo brevemente en el campo "notas" de la pregunta para orientar al docente en el editor.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "titulo": "título limpio del examen",
  "materia": "${esAdmision ? 'Prueba General de Admisión (5 Áreas Básicas)' : 'materia o asignatura'}",
  "preguntas": [
    {
      "enunciado": "texto completo de la pregunta (incluyendo la situación compartida y palabras con formato **negrita** o <u>subrayado</u> si aplica)",
      "area": "${esAdmision ? 'Matemáticas' : 'Materia'}",
      "imagen": "[IMAGEN_X] o null",
      "respuestaCorrecta": "A",
      "opciones": [
        {"letra": "A", "texto": "texto de opción o Opción A (preservando formato si aplica)", "imagen": "[IMAGEN_Y] o null"},
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

    // Strategy 1: Visual multimodal (with labeled extracted images + text)
    // Strategy 2: Multimodal PDF direct (if PDF available)
    // Strategy 3: Text-only prompt (fallback)
    const contentStrategies: any[] = [];

    // Construct visual contents with labeled thumbnails
    const visualParts: any[] = [
      { text: "A continuación te muestro todas las imágenes extraídas del archivo del examen para que las veas y las asocies exactamente a cada pregunta según su contenido temático:" }
    ];
    for (const [placeholder, img] of Object.entries(imagenesThumbnails)) {
      visualParts.push({ text: `Esta es la imagen ${placeholder}:` });
      visualParts.push({
        inlineData: {
          mimeType: img.mime,
          data: img.data,
        },
      });
    }
    visualParts.push({ text: `TEXTO COMPLETO DEL EXAMEN:\n${textoExamen}\n\n${prompt}` });
    contentStrategies.push(visualParts);

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
      if (imgKey && typeof imgKey === 'string') {
        const trimmed = imgKey.trim();
        if (trimmed.startsWith('data:image/')) return trimmed;
        if (imagenesMap[trimmed]) return imagenesMap[trimmed];
        const withBrackets = `[${trimmed.replace(/^[\[\(]+|[\]\)]+$/g, '')}]`;
        if (imagenesMap[withBrackets]) return imagenesMap[withBrackets];
        const m1 = trimmed.match(/\[?IMAGEN_(\d+)\]?/i);
        if (m1) {
          const standardKey = `[IMAGEN_${parseInt(m1[1], 10)}]`;
          if (imagenesMap[standardKey]) return imagenesMap[standardKey];
        }
      }
      if (text && typeof text === 'string') {
        const m = text.match(/\[?IMAGEN_(\d+)\]?/i);
        if (m) {
          const standardKey = `[IMAGEN_${parseInt(m[1], 10)}]`;
          if (imagenesMap[standardKey]) return imagenesMap[standardKey];
        }
      }
      return null;
    }

    // Helper to sanitize correct answer key letter
    function cleanRespuestaCorrecta(rc: any): string | null {
      if (!rc || typeof rc !== 'string') return null;
      const match = rc.trim().toUpperCase().match(/([A-E])/);
      return match ? match[1] : null;
    }

    // Weight calculation & image attachment
    // In admissions: Each area sums to 100%!
    // In regular: All questions sum to 100% total!
    let preguntasFinales: Array<{
      orden: number;
      enunciado: string;
      area?: string;
      opciones: Array<{ letra: string; texto: string; imagen?: string | null }>;
      respuestaCorrecta: string | null;
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
            respuestaCorrecta: cleanRespuestaCorrecta(p.respuestaCorrecta),
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
          respuestaCorrecta: cleanRespuestaCorrecta(p.respuestaCorrecta),
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
    respuestaCorrecta?: string | null;
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
