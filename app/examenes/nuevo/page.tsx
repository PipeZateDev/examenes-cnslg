'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Opcion {
  letra: string;
  texto: string;
  imagen?: string | null;
}

interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: Opcion[];
  respuestaCorrecta: string | null;
  peso: number;
  area?: string;
  imagen?: string | null;
  notas?: string | null;
}

export default function NuevoExamenPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [materia, setMateria] = useState('');
  const [duracion, setDuracion] = useState('');
  const [esAdmision, setEsAdmision] = useState(false);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);

  // Helper to load mammoth browser library safely
  async function loadMammoth(): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).mammoth) return (window as any).mammoth;

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="/mammoth.browser.min.js"]');
      if (existing) {
        if ((window as any).mammoth) {
          resolve((window as any).mammoth);
          return;
        }
        existing.addEventListener('load', () => resolve((window as any).mammoth));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = '/mammoth.browser.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).mammoth);
      script.onerror = () => reject(new Error('No se pudo cargar el convertidor de Word'));
      document.head.appendChild(script);
    });
  }

  // Crop, transform and compress image on canvas in browser
  function transformImageInBrowser(
    dataUri: string,
    crop?: { l: number; t: number; r: number; b: number } | null,
    transform?: { rotDeg: number; flipH: boolean; flipV: boolean } | null,
    maxWidth = 800
  ): Promise<string> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !dataUri || !dataUri.startsWith('data:image')) {
        resolve(dataUri);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;

        let sx = 0, sy = 0, sw = nw, sh = nh;
        if (crop && (crop.l > 0 || crop.t > 0 || crop.r > 0 || crop.b > 0)) {
          sx = Math.min(nw - 1, Math.max(0, Math.round(nw * crop.l)));
          sy = Math.min(nh - 1, Math.max(0, Math.round(nh * crop.t)));
          sw = Math.min(nw - sx, Math.max(1, Math.round(nw * (1 - crop.l - crop.r))));
          sh = Math.min(nh - sy, Math.max(1, Math.round(nh * (1 - crop.t - crop.b))));
        }

        const scale = Math.min(1, maxWidth / sw, maxWidth / sh);
        const dw = Math.max(1, Math.round(sw * scale));
        const dh = Math.max(1, Math.round(sh * scale));

        const rotDeg = transform?.rotDeg || 0;
        const flipH = transform?.flipH || false;
        const flipV = transform?.flipV || false;

        const isSideways = rotDeg === 90 || rotDeg === 270;
        const canvasWidth = isSideways ? dh : dw;
        const canvasHeight = isSideways ? dw : dh;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUri);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.save();
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        if (rotDeg !== 0) ctx.rotate((rotDeg * Math.PI) / 180);
        if (flipH) ctx.scale(-1, 1);
        if (flipV) ctx.scale(1, -1);

        ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();

        try {
          const compressed = canvas.toDataURL('image/png');
          resolve(compressed);
        } catch {
          resolve(dataUri);
        }
      };
      img.onerror = () => resolve(dataUri);
      img.src = dataUri;
    });
  }

  // ─── Step 1: Upload and process PDF / DOCX ──────────────────────────────────
  async function handleProcesar() {
    if (!file) return;
    setProcesando(true);
    setError('');
    try {
      let res: Response;

      // For Word (.docx): extract text and images in browser with crop and transforms
      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const JSZip = (await import('jszip')).default;
          const mammothBrowser = await loadMammoth();

          if (!mammothBrowser) {
            throw new Error('No se pudo inicializar el convertidor de Word.');
          }

          const zip = await JSZip.loadAsync(arrayBuffer);
          const docXml = await zip.file('word/document.xml')?.async('string');
          const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');

          const imagesMap: Record<string, string> = {};

          if (docXml && relsXml) {
            const rels: Record<string, string> = {};
            const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
            let rMatch: RegExpExecArray | null;
            while ((rMatch = relRegex.exec(relsXml)) !== null) {
              rels[rMatch[1]] = rMatch[2];
            }

            const drawingRegex = /<w:drawing>([\s\S]*?)<\/w:drawing>/g;
            let dMatch: RegExpExecArray | null;
            let drawCount = 0;

            while ((dMatch = drawingRegex.exec(docXml)) !== null) {
              drawCount++;
              const placeholder = `[IMAGEN_${drawCount}]`;
              const content = dMatch[1];
              const blipMatch = content.match(/r:embed="([^"]+)"/);
              if (!blipMatch) continue;

              const rId = blipMatch[1];
              const targetPath = rels[rId];
              if (!targetPath) continue;

              const zipPath = targetPath.startsWith('word/') ? targetPath : `word/${targetPath.replace(/^\//, '')}`;
              const imgZipFile = zip.file(zipPath);
              if (!imgZipFile) continue;

              const imgBase64 = await imgZipFile.async('base64');
              const ext = targetPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
              const rawUri = `data:image/${ext};base64,${imgBase64}`;

              // Parse crop (<a:srcRect l="38682" t="37182" r="39093" b="25629"/>)
              const srcRectMatch = content.match(/<a:srcRect([^>]*)\/?>/);
              let crop: { l: number; t: number; r: number; b: number } | null = null;
              if (srcRectMatch) {
                const lMatch = srcRectMatch[1].match(/\bl="(\d+)"/);
                const tMatch = srcRectMatch[1].match(/\bt="(\d+)"/);
                const rMatch = srcRectMatch[1].match(/\br="(\d+)"/);
                const bMatch = srcRectMatch[1].match(/\bb="(\d+)"/);
                crop = {
                  l: lMatch ? parseInt(lMatch[1], 10) / 100000 : 0,
                  t: tMatch ? parseInt(tMatch[1], 10) / 100000 : 0,
                  r: rMatch ? parseInt(rMatch[1], 10) / 100000 : 0,
                  b: bMatch ? parseInt(bMatch[1], 10) / 100000 : 0,
                };
              }

              // Parse transform (<a:xfrm rot="10800000" flipH="1" flipV="1">)
              const xfrmMatch = content.match(/<a:xfrm([^>]*)>/);
              let transform: { rotDeg: number; flipH: boolean; flipV: boolean } | null = null;
              if (xfrmMatch) {
                const rotMatch = xfrmMatch[1].match(/\brot="(\d+)"/);
                transform = {
                  rotDeg: rotMatch ? Math.round(parseInt(rotMatch[1], 10) / 60000) : 0,
                  flipH: /\bflipH="1"/.test(xfrmMatch[1]),
                  flipV: /\bflipV="1"/.test(xfrmMatch[1]),
                };
              }

              const transformedUri = await transformImageInBrowser(rawUri, crop, transform, 800);
              imagesMap[placeholder] = transformedUri;
            }
          }

          let mammothImgIndex = 0;
          const options = {
            convertImage: mammothBrowser.images.inline(function() {
              mammothImgIndex++;
              const placeholder = `[IMAGEN_${mammothImgIndex}]`;
              return Promise.resolve({ src: placeholder });
            })
          };

          const htmlResult = await mammothBrowser.convertToHtml({ arrayBuffer }, options);
          const textWithPlaceholders = htmlResult.value
            .replace(/<img[^>]*src="(\[IMAGEN_\d+\])"[^>]*>/gi, '\n$1\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (!textWithPlaceholders) {
            setError('No se pudo extraer texto del documento Word.');
            setProcesando(false);
            return;
          }

          const payload = JSON.stringify({
            texto: textWithPlaceholders,
            imagenes: imagesMap,
            esAdmision,
            nombreArchivo: file.name,
          });

          // Verify payload is well below Vercel's 4.5MB limit
          if (payload.length > 4.2 * 1024 * 1024) {
            setError('El examen contiene demasiadas imágenes de gran tamaño. Intenta reducir su cantidad.');
            setProcesando(false);
            return;
          }

          res = await fetch('/api/examenes/procesar-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
        } catch (docxErr: any) {
          console.warn('Fallo extracción en navegador:', docxErr);
          if (file.size > 4.2 * 1024 * 1024) {
            setError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y supera el límite de Vercel (4.5 MB). No se pudo comprimir en el navegador.`);
            setProcesando(false);
            return;
          }
          const fd = new FormData();
          fd.append('file', file);
          fd.append('esAdmision', esAdmision ? '1' : '0');
          res = await fetch('/api/examenes/procesar-pdf', { method: 'POST', body: fd });
        }
      } else {
        // PDF or other formats
        if (file.size > 4.2 * 1024 * 1024) {
          setError(`El archivo PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y supera el límite de Vercel (4.5 MB). Por favor comprímelo o conviértelo a .docx.`);
          setProcesando(false);
          return;
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('esAdmision', esAdmision ? '1' : '0');
        res = await fetch('/api/examenes/procesar-pdf', { method: 'POST', body: fd });
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {
        setError(`Error del servidor (${res.status} ${res.statusText || 'Respuesta no válida'}).`);
        return;
      }

      if (!res.ok) { setError(data?.error || `Error ${res.status}: no se pudo procesar`); return; }

      // Automatic creation: redirect directly to exam view!
      if (data.id) {
        router.push(`/examenes/${data.id}`);
        return;
      }

      if (data.titulo) setTitulo(data.titulo);
      if (data.materia) setMateria(data.materia);
      setPreguntas(data.preguntas);
      setStep('review');
    } catch (err: any) {
      setError(`Error de procesamiento: ${err?.message || 'Verifica tu red o variables en Vercel'}`);
    } finally {
      setProcesando(false);
    }
  }

  function updatePregunta(idx: number, field: keyof Pregunta, value: unknown) {
    setPreguntas(ps => ps.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function updatePeso(idx: number, valor: number) {
    setPreguntas(ps => ps.map((p, i) => i === idx ? { ...p, peso: valor } : p));
  }

  const pesoTotal = preguntas.reduce((s, p) => s + (p.peso || 0), 0);

  // ─── Step 2: Save exam ───────────────────────────────────────────────────────
  async function handleGuardar() {
    if (pesoTotal !== 100) {
      setError(`Los pesos suman ${pesoTotal}%. Deben sumar exactamente 100%.`);
      return;
    }
    const sinRespuesta = preguntas.filter(p => !p.respuestaCorrecta);
    if (sinRespuesta.length > 0) {
      setError(`${sinRespuesta.length} pregunta(s) sin respuesta correcta asignada.`);
      return;
    }
    setStep('saving');
    setError('');
    try {
      const res = await fetch('/api/examenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, materia, duracionMinutos: duracion ? Number(duracion) : null, esAdmision, preguntas }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); setStep('review'); return; }
      router.push(`/examenes/${data.id}`);
    } catch {
      setError('Error al guardar el examen');
      setStep('review');
    }
  }

  // ─── Step 1 UI ───────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <a href="/examenes" className="text-blue-600 hover:underline text-sm">← Exámenes</a>
            <span className="text-slate-400">/</span>
            <h1 className="font-bold text-slate-800 text-xl">Nuevo Examen</h1>
          </div>

          <div className="bg-white rounded-2xl shadow p-8">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">1. Sube el archivo del examen</h2>
            <p className="text-slate-500 text-sm mb-6">
              La IA de Gemini extraerá automáticamente las preguntas de selección múltiple.
              Formatos soportados: <strong>PDF, DOCX</strong>
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition"
            >
              <div className="text-5xl mb-3">{file ? '📄' : '📁'}</div>
              {file ? (
                <div>
                  <p className="font-semibold text-blue-700">{file.name}</p>
                  <p className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-600 font-medium">Haz clic para seleccionar archivo</p>
                  <p className="text-slate-400 text-sm mt-1">PDF o DOCX — máx. 10MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={e => {
                  const selected = e.target.files?.[0] || null;
                  setFile(selected);
                  setError('');
                  if (selected && /admisi[oó]n/i.test(selected.name)) {
                    setEsAdmision(true);
                  }
                }}
              />
            </div>

            {/* Configuración de admisión y opciones */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esAdmision}
                  onChange={e => setEsAdmision(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-800 text-sm block">
                    🎓 Es Prueba de Admisión
                  </span>
                  <span className="text-slate-500 text-xs block mt-0.5">
                    Divide automáticamente el examen en las <strong>5 áreas básicas</strong> (Matemáticas, Español, Ciencias Naturales, Ciencias Sociales e Inglés) y pondera cada área al <strong>100%</strong> (5 preguntas de 20% en primaria, o 10 preguntas de 10% en bachillerato).
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-xs text-blue-800">
              <span className="text-base flex-shrink-0">✨</span>
              <span>
                <strong>Flujo Automático:</strong> Al subir el documento, la IA extraerá las preguntas, conservará todas las imágenes y diagramas, y creará el examen de inmediato para llevarte directamente a la vista previa donde podrás marcar las respuestas correctas.
              </span>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleProcesar}
                disabled={!file || procesando}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg"
              >
                {procesando ? '🤖 Creando examen con IA...' : '🤖 Procesar y Crear Examen con IA'}
              </button>
            </div>

            {procesando && (
              <p className="text-center text-slate-500 text-sm mt-3 animate-pulse">
                Extrayendo preguntas, imágenes y diagramas con Gemini... Serás redirigido a la vista previa automáticamente.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2 UI: Review questions ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('upload')} className="text-blue-600 hover:underline text-sm">
              ← Volver
            </button>
            <h1 className="font-bold text-slate-800 text-xl">Revisar Preguntas</h1>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${pesoTotal === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Peso total: {pesoTotal}%
          </span>
        </div>

        {/* Exam metadata */}
        <div className="bg-white rounded-xl shadow p-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Título del Examen *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Materia</label>
            <input value={materia} onChange={e => setMateria(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Duración (minutos)</label>
            <input type="number" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="Sin límite"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex items-center gap-2 md:col-span-3">
            <input type="checkbox" id="admision" checked={esAdmision} onChange={e => setEsAdmision(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="admision" className="text-sm text-gray-600">Este es un examen de <strong>Admisiones</strong></label>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {preguntas.map((p, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="bg-blue-100 text-blue-700 font-bold text-sm px-2 py-0.5 rounded">P{idx + 1}</span>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-500">Peso:</label>
                  <input
                    type="number"
                    value={p.peso}
                    onChange={e => updatePeso(idx, Number(e.target.value))}
                    min={1} max={100}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-gray-400">%</span>
                </div>
              </div>

              <textarea
                value={p.enunciado}
                onChange={e => updatePregunta(idx, 'enunciado', e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
              />

              {p.imagen && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                  <img
                    src={p.imagen}
                    alt={`Diagrama pregunta ${idx + 1}`}
                    className="max-h-48 object-contain rounded-lg bg-white p-1"
                  />
                </div>
              )}

              <div className="space-y-2 mb-4">
                {p.opciones.map(op => (
                  <div key={op.letra} className={`flex items-center gap-3 p-2 rounded-lg border ${p.respuestaCorrecta === op.letra ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                    <button
                      onClick={() => updatePregunta(idx, 'respuestaCorrecta', op.letra)}
                      className={`w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 transition
                        ${p.respuestaCorrecta === op.letra ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-green-100'}`}
                    >
                      {op.letra}
                    </button>
                    {op.imagen && (
                      <div className="flex-shrink-0 my-1 bg-white p-1 rounded-lg border border-slate-200">
                        <img
                          src={op.imagen}
                          alt={`Opción ${op.letra}`}
                          className="max-h-16 max-w-[120px] object-contain rounded"
                        />
                      </div>
                    )}
                    <input
                      value={op.texto}
                      onChange={e => {
                        const newOpciones = p.opciones.map(o => o.letra === op.letra ? { ...o, texto: e.target.value } : o);
                        updatePregunta(idx, 'opciones', newOpciones);
                      }}
                      placeholder={op.imagen ? 'Descripción o figura...' : `Opción ${op.letra}...`}
                      className="flex-1 border-0 bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {!p.respuestaCorrecta && (
                <p className="text-amber-600 text-xs">⚠️ Haz clic en la letra correcta para marcar la respuesta</p>
              )}
            </div>
          ))}
        </div>

        {/* Save button */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleGuardar}
            disabled={step === 'saving'}
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {step === 'saving' ? 'Guardando...' : `✓ Guardar Examen (${preguntas.length} preguntas)`}
          </button>
        </div>
      </div>
    </div>
  );
}
