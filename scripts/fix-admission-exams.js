const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');

const env = fs.readFileSync('.env.local', 'utf8');
let uri = '';
env.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('MONGODB_URI_EXAMENES=')) {
    uri = trimmed.substring('MONGODB_URI_EXAMENES='.length).trim();
    if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
      uri = uri.slice(1, -1);
    }
  }
});

async function fixAdmissionExams() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('examenes-cnslg');

  const examenes = await db.collection('ex_examenes').find({ esAdmision: true }).toArray();

  for (const ex of examenes) {
    let modified = false;
    const gradoMatch = ex.titulo.match(/Grado\s+(\d+)/i);
    const grado = gradoMatch ? parseInt(gradoMatch[1], 10) : null;

    console.log(`\nRevisando: ${ex.titulo} (Grado: ${grado})`);

    const nuevasPreguntas = (ex.preguntas || []).map(p => {
      let pCopy = { ...p };

      // Global formatting fixes for all questions and options:
      // Replace chemical formulas
      pCopy.enunciado = pCopy.enunciado
        .replace(/\bCO2\b/g, 'CO₂')
        .replace(/\bH2O\b/g, 'H₂O')
        .replace(/\bO2\b/g, 'O₂')
        .replace(/\bN2\b/g, 'N₂')
        .replace(/\bCH4\b/g, 'CH₄');

      // Replace common units with exponents
      pCopy.enunciado = pCopy.enunciado
        .replace(/\bm2\b/g, 'm²')
        .replace(/\bcm2\b/g, 'cm²')
        .replace(/\bmm2\b/g, 'mm²')
        .replace(/\bkm2\b/g, 'km²')
        .replace(/\bm3\b/g, 'm³')
        .replace(/\bcm3\b/g, 'cm³')
        .replace(/\bm\/s2\b/g, 'm/s²');

      pCopy.opciones = (pCopy.opciones || []).map(op => {
        let texto = op.texto || '';
        texto = texto
          .replace(/\bCO2\b/g, 'CO₂')
          .replace(/\bH2O\b/g, 'H₂O')
          .replace(/\bO2\b/g, 'O₂')
          .replace(/\bN2\b/g, 'N₂')
          .replace(/\bCH4\b/g, 'CH₄')
          .replace(/\bm2\b/g, 'm²')
          .replace(/\bcm2\b/g, 'cm²')
          .replace(/\bmm2\b/g, 'mm²')
          .replace(/\bkm2\b/g, 'km²')
          .replace(/\bm3\b/g, 'm³')
          .replace(/\bcm3\b/g, 'cm³')
          .replace(/\bm\/s2\b/g, 'm/s²');
        return { ...op, texto };
      });

      // Grade-specific fixes:
      if (grado === 7) {
        if (pCopy.orden === 10) {
          pCopy.opciones = [
            { letra: 'A', texto: '592 m²' },
            { letra: 'B', texto: '612 m²' },
            { letra: 'C', texto: '656 m²' },
            { letra: 'D', texto: '684 m²' }
          ];
          modified = true;
        }
      }

      if (grado === 8) {
        if (pCopy.orden === 1) {
          pCopy.enunciado = 'En una ciudad, la temperatura por la mañana era de -3 °C. Al mediodía la temperatura subió 8 °C y por la noche bajó 5 °C. ¿Cuál fue la temperatura final por la noche?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '0 °C' },
            { letra: 'B', texto: '-10 °C' },
            { letra: 'C', texto: '10 °C' },
            { letra: 'D', texto: '2 °C' }
          ];
          modified = true;
        }
        if (pCopy.orden === 2) {
          pCopy.enunciado = 'María compró 3/4 de kilo de arroz y luego usó 1/2 kilo para la cena. ¿Qué cantidad de arroz le quedó?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '1/8 de kilo' },
            { letra: 'B', texto: '1/4 de kilo' },
            { letra: 'C', texto: '1/2 de kilo' },
            { letra: 'D', texto: '2/3 de kilo' }
          ];
          modified = true;
        }
        if (pCopy.orden === 8) {
          pCopy.enunciado = 'Un terreno rectangular tiene un largo de 12 m y un ancho de 5 m. ¿Cuál es el perímetro y el área del terreno, respectivamente?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: 'Perímetro = 17 m, Área = 60 m²' },
            { letra: 'B', texto: 'Perímetro = 34 m, Área = 60 m²' },
            { letra: 'C', texto: 'Perímetro = 60 m, Área = 34 m²' },
            { letra: 'D', texto: 'Perímetro = 34 m, Área = 30 m²' }
          ];
          modified = true;
        }
        if (pCopy.orden === 10) {
          pCopy.enunciado = 'Una bolsa contiene 5 bolas rojas, 3 bolas azules y 2 bolas verdes. Si se saca una bola al azar, ¿cuál es la probabilidad de sacar una bola azul?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '1/2' },
            { letra: 'B', texto: '3/10' },
            { letra: 'C', texto: '3/7' },
            { letra: 'D', texto: '1/5' }
          ];
          modified = true;
        }
      }

      if (grado === 9) {
        if (pCopy.orden === 1) {
          pCopy.enunciado = 'Un terreno rectangular tiene un largo de (3x + 2) metros y un ancho de (2x - 1) metros. ¿Cuál es la expresión que representa el perímetro total del terreno?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: '5x + 1' },
            { letra: 'B', texto: '6x² + x - 2' },
            { letra: 'C', texto: '10x + 2' },
            { letra: 'D', texto: '6x + 2' }
          ];
          modified = true;
        }
        if (pCopy.orden === 2) {
          pCopy.enunciado = 'Al restar el polinomio (5x² - 3x + 4) del polinomio (8x² + 2x - 1), se obtiene:';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '3x² + 5x - 5' },
            { letra: 'B', texto: '3x² - x + 3' },
            { letra: 'C', texto: '13x² - x + 3' },
            { letra: 'D', texto: '3x² + 5x + 3' }
          ];
          modified = true;
        }
        if (pCopy.orden === 4) {
          pCopy.enunciado = 'El área de una lámina metálica está dada por la expresión 6x² + 11x - 10. Si el área se calcula multiplicando la base por la altura, ¿cuáles son las dimensiones de la lámina?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: '(6x - 5)(x + 2)' },
            { letra: 'B', texto: '(3x + 5)(2x - 2)' },
            { letra: 'C', texto: '(2x + 5)(3x - 2)' },
            { letra: 'D', texto: '(2x - 5)(3x + 2)' }
          ];
          modified = true;
        }
        if (pCopy.orden === 5) {
          pCopy.enunciado = 'Se requiere factorizar la expresión x² - 9x + 20 para encontrar las raíces de una función. ¿Cuál es la factorización correcta?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '(x - 5)(x - 4)' },
            { letra: 'B', texto: '(x + 5)(x + 4)' },
            { letra: 'C', texto: '(x - 10)(x - 2)' },
            { letra: 'D', texto: '(x - 20)(x - 1)' }
          ];
          modified = true;
        }
        if (pCopy.orden === 6) {
          pCopy.enunciado = 'Una empresa de telefonía cobra un cargo fijo mensual de $15.000 más $100 por cada minuto consumido (x). ¿Cuál es la función que modela el costo total C(x) y cuál es la pendiente m de la recta?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: 'C(x) = 15.000x + 100, con m = 15.000' },
            { letra: 'B', texto: 'C(x) = 100x + 15.000, con m = 100' },
            { letra: 'C', texto: 'C(x) = 100x - 15.000, con m = -15.000' },
            { letra: 'D', texto: 'C(x) = 15.100x, con m = 15.100' }
          ];
          modified = true;
        }
        if (pCopy.orden === 8) {
          pCopy.enunciado = 'Para colocar una antena de comunicación de 12 m de altura, se sujeta un cable desde la punta superior de la antena hasta un punto en el suelo ubicado a 9 m de la base. ¿Cuál es la longitud del cable?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '15 m' },
            { letra: 'B', texto: '21 m' },
            { letra: 'C', texto: '225 m' },
            { letra: 'D', texto: '13 m' }
          ];
          modified = true;
        }
        if (pCopy.orden === 9) {
          pCopy.enunciado = 'Un depósito con forma de cilindro circular recto tiene un radio de 3 m en su base y una altura de 10 m. Utilizando la fórmula V = π·r²·h, ¿cuál es el volumen exacto en términos de π?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: '30π m³' },
            { letra: 'B', texto: '60π m³' },
            { letra: 'C', texto: '90π m³' },
            { letra: 'D', texto: '300π m³' }
          ];
          modified = true;
        }
      }

      if (grado === 10) {
        if (pCopy.orden === 1) {
          pCopy.enunciado = 'En una estación meteorológica, la temperatura a las 5:00 a. m. era de -4 °C. Durante la mañana la temperatura subió 11 °C y por la tarde descendió 6 °C. ¿Cuál fue la temperatura al final de la tarde?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '1 °C' },
            { letra: 'B', texto: '-1 °C' },
            { letra: 'C', texto: '13 °C' },
            { letra: 'D', texto: '-11 °C' }
          ];
          modified = true;
        }
        if (pCopy.orden === 2) {
          pCopy.enunciado = 'Un estudiante obtuvo las siguientes calificaciones en cinco evaluaciones de Matemáticas: 3,5; 4,0; 4,5; 3,0 y 5,0. ¿Cuál es el promedio (media aritmética) de sus calificaciones?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '3,8' },
            { letra: 'B', texto: '4,0' },
            { letra: 'C', texto: '4,2' },
            { letra: 'D', texto: '4,5' }
          ];
          modified = true;
        }
        if (pCopy.orden === 3) {
          pCopy.enunciado = 'Al restar el polinomio (3x² - 5x + 2) del polinomio (7x² + 2x - 4), ¿cuál es el resultado simplificado?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '4x² + 7x - 6' },
            { letra: 'B', texto: '4x² - 3x - 2' },
            { letra: 'C', texto: '10x² - 3x - 2' },
            { letra: 'D', texto: '4x² + 7x + 2' }
          ];
          modified = true;
        }
        if (pCopy.orden === 4) {
          pCopy.enunciado = 'El plano de un jardín cuadrado indica que cada uno de sus lados mide (2x + 3) metros. ¿Cuál es la expresión que representa el área total del jardín?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '4x² + 9' },
            { letra: 'B', texto: '4x² + 12x + 9' },
            { letra: 'C', texto: '4x + 6' },
            { letra: 'D', texto: '2x² + 6x + 9' }
          ];
          modified = true;
        }
        if (pCopy.orden === 5) {
          pCopy.enunciado = 'La superficie rectangular de un tablero metálico está representada por la expresión 9x² - 16. Al factorizarla como una diferencia de cuadrados para hallar sus dimensiones, se obtiene:';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '(9x - 4)(x + 4)' },
            { letra: 'B', texto: '(3x + 4)(3x - 4)' },
            { letra: 'C', texto: '(3x - 4)²' },
            { letra: 'D', texto: '3(3x² - 5)' }
          ];
          modified = true;
        }
        if (pCopy.orden === 6) {
          pCopy.enunciado = 'En la cafetería de un colegio ofrecen 3 tipos de emparedados (pollo, carne, queso) y 4 tipos de bebidas (mora, lulo, mango, agua). ¿Cuántas combinaciones diferentes de 1 emparedado y 1 bebida puede elegir un estudiante?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '7 combinaciones' },
            { letra: 'B', texto: '12 combinaciones' },
            { letra: 'C', texto: '14 combinaciones' },
            { letra: 'D', texto: '24 combinaciones' }
          ];
          modified = true;
        }
        if (pCopy.orden === 7) {
          pCopy.enunciado = 'Un cine vendió 45 entradas entre adultos (x) y niños (y), recaudando un total de $360.000. Si la entrada de adulto cuesta $10.000 y la de niño $7.000, ¿cuántas entradas de adulto y de niño se vendieron?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: '20 de adulto y 25 de niño' },
            { letra: 'B', texto: '25 de adulto y 20 de niño' },
            { letra: 'C', texto: '15 de adulto y 30 de niño' },
            { letra: 'D', texto: '30 de adulto y 15 de niño' }
          ];
          modified = true;
        }
        if (pCopy.orden === 8) {
          pCopy.enunciado = 'Al resolver la ecuación cuadrática t² - 7t + 10 = 0 para calcular el tiempo en segundos en que un objeto alcanza cierta posición, se obtienen los valores:';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: 't = 1 y t = 10' },
            { letra: 'B', texto: 't = 2 y t = 5' },
            { letra: 'C', texto: 't = -2 y t = -5' },
            { letra: 'D', texto: 't = 3 y t = 4' }
          ];
          modified = true;
        }
        if (pCopy.orden === 9) {
          pCopy.enunciado = 'Una rampa de alineación mide 10 m de largo y se apoya sobre una plataforma cuya base mide 8 m de distancia horizontal. ¿Cuál es la altura de la plataforma?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '4 m' },
            { letra: 'B', texto: '6 m' },
            { letra: 'C', texto: '8 m' },
            { letra: 'D', texto: '12 m' }
          ];
          modified = true;
        }
        if (pCopy.orden === 10) {
          pCopy.enunciado = 'Desde un punto situado en el suelo, se observa la parte superior de una torre. Si la distancia horizontal desde el observador hasta la base de la torre es de 12 m (cateto adyacente) y la altura de la torre es de 5 m (cateto opuesto), ¿cuál es el valor de la tangente (tan θ) del ángulo de elevación θ?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '5/12' },
            { letra: 'B', texto: '12/5' },
            { letra: 'C', texto: '5/13' },
            { letra: 'D', texto: '12/13' }
          ];
          modified = true;
        }
      }

      if (grado === 11) {
        if (pCopy.orden === 1) {
          pCopy.enunciado = 'Las temperaturas máximas registradas durante una semana en una ciudad fueron: 18 °C, 20 °C, 22 °C, 20 °C, 25 °C, 20 °C y 22 °C. ¿Cuál es la moda y el rango de este conjunto de datos?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: 'Moda = 20 °C, Rango = 7 °C' },
            { letra: 'B', texto: 'Moda = 22 °C, Rango = 7 °C' },
            { letra: 'C', texto: 'Moda = 20 °C, Rango = 25 °C' },
            { letra: 'D', texto: 'Moda = 21 °C, Rango = 5 °C' }
          ];
          modified = true;
        }
        if (pCopy.orden === 2) {
          pCopy.enunciado = 'Para determinar el tiempo (en segundos) en que una pelota toca el suelo, se plantea la ecuación h(t) = -5t² + 15t = 0. ¿En qué instantes la pelota está a nivel del suelo?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: 't = 1 y t = 2' },
            { letra: 'B', texto: 't = 0 y t = 3' },
            { letra: 'C', texto: 't = -1 y t = 3' },
            { letra: 'D', texto: 't = 2 y t = 4' }
          ];
          modified = true;
        }
        if (pCopy.orden === 3) {
          pCopy.enunciado = 'Un poste vertical de 8 m de altura se sostiene con un cable tirante desde su extremo superior hasta una estaca en el suelo ubicada a 6 m de la base. ¿Cuál es la longitud del cable?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '10 m' },
            { letra: 'B', texto: '8 m' },
            { letra: 'C', texto: '14 m' },
            { letra: 'D', texto: '6 m' }
          ];
          modified = true;
        }
        if (pCopy.orden === 4) {
          pCopy.enunciado = 'Dada la función real f(x) = 1 / (x - 2), ¿cuál es el dominio de la función?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: 'Todos los números reales' },
            { letra: 'B', texto: 'Todos los números reales excepto 0' },
            { letra: 'C', texto: 'Todos los números reales excepto 2' },
            { letra: 'D', texto: 'Todos los números reales mayores que 0' }
          ];
          modified = true;
        }
        if (pCopy.orden === 5) {
          pCopy.enunciado = 'En una urna hay 4 bolas rojas y 2 bolas azules. Si se extraen dos bolas consecutivamente con reemplazo (se devuelve la primera bola antes de sacar la segunda), ¿cuál es la probabilidad de que ambas bolas sean rojas?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: '4/9' },
            { letra: 'B', texto: '2/3' },
            { letra: 'C', texto: '1/9' },
            { letra: 'D', texto: '5/9' }
          ];
          modified = true;
        }
        if (pCopy.orden === 6) {
          pCopy.enunciado = 'Un tanque esférico tiene un radio r. ¿Cuáles son el área de su superficie (A) y su volumen (V) exactos en términos de π y r?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: 'Área = 4πr², Volumen = (4/3)πr³' },
            { letra: 'B', texto: 'Área = 2πr², Volumen = (4/3)πr³' },
            { letra: 'C', texto: 'Área = 4πr², Volumen = 2πr³' },
            { letra: 'D', texto: 'Área = 2πr², Volumen = 4πr³' }
          ];
          modified = true;
        }
        if (pCopy.orden === 7) {
          pCopy.enunciado = '¿Cuál es la forma punto-pendiente de la ecuación de la recta que pasa por el punto (x₁, y₁) y tiene una pendiente m?';
          pCopy.respuestaCorrecta = 'A';
          pCopy.opciones = [
            { letra: 'A', texto: 'y - y₁ = m(x - x₁)' },
            { letra: 'B', texto: 'y = mx + b' },
            { letra: 'C', texto: 'Ax + By + C = 0' },
            { letra: 'D', texto: 'x/a + y/b = 1' }
          ];
          modified = true;
        }
        if (pCopy.orden === 8) {
          pCopy.enunciado = 'Una señal circular de tránsito tiene su centro en el punto (h, k) y un radio r. ¿Cuál es su ecuación canónica u ordinaria?';
          pCopy.respuestaCorrecta = 'C';
          pCopy.opciones = [
            { letra: 'A', texto: 'x² + y² = r²' },
            { letra: 'B', texto: 'Ax + By + C = 0' },
            { letra: 'C', texto: '(x - h)² + (y - k)² = r²' },
            { letra: 'D', texto: '(x + h)² + (y + k)² = r²' }
          ];
          modified = true;
        }
        if (pCopy.orden === 9) {
          pCopy.enunciado = 'En un triángulo ABC se conocen los ángulos A = 30°, B = 45° y el lado a = 10 cm. Aplicando la Ley de Senos: (a / sen A) = (b / sen B), ¿cuánto mide el lado b?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: '10 cm' },
            { letra: 'B', texto: '10√2 cm' },
            { letra: 'C', texto: '20 cm' },
            { letra: 'D', texto: '5√2 cm' }
          ];
          modified = true;
        }
        if (pCopy.orden === 10) {
          pCopy.enunciado = 'Al simplificar la expresión trigonométrica sen(x) / tan(x), recordando que tan(x) = sen(x) / cos(x) para todo x donde esté definida, ¿cuál es el resultado equivalente?';
          pCopy.respuestaCorrecta = 'B';
          pCopy.opciones = [
            { letra: 'A', texto: 'sen(x)' },
            { letra: 'B', texto: 'cos(x)' },
            { letra: 'C', texto: 'tan(x)' },
            { letra: 'D', texto: '1' }
          ];
          modified = true;
        }
      }

      return pCopy;
    });

    await db.collection('ex_examenes').updateOne(
      { _id: ex._id },
      { $set: { preguntas: nuevasPreguntas } }
    );
    console.log(`✓ Examen ${ex.titulo} actualizado exitosamente.`);
  }

  console.log('\n¡Todos los exámenes de admisión fueron verificados y corregidos!');
  await client.close();
}

fixAdmissionExams().catch(console.error);
