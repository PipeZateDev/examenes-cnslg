const fs = require('fs');
const { MongoClient } = require('mongodb');

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

async function fixAllSharedReadings() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('examenes-cnslg');

  // =========================================================================
  // 1. GRADO 11°
  // =========================================================================
  const g11 = await db.collection('ex_examenes').findOne({ titulo: /Grado 11/i, esAdmision: true });
  if (g11) {
    console.log('Actualizando Grado 11...');

    const textoOspina = `# RESUELVE LAS PREGUNTAS 11 A 15 DE ACUERDO AL SIGUIENTE TEXTO.

**En tiempos de peligro**

Tendemos a pensar que los grandes inventos de la humanidad son los de nuestra época; <u>**por eso**</u> está bien que alguien nos recuerde que las edades de los grandes inventos fueron aquellas en que inventamos el lenguaje, domesticamos el fuego y las semillas, convertimos en compañeros de aventura al caballo y al perro, la vaca y la oveja, inventamos el amor y la amistad, el hogar y la cocción de los alimentos, en que adivinamos o presentimos a los dioses y alzamos nuestros primeros templos, cuando descubrimos el consuelo y la felicidad del arte tallando gruesas Venus de piedra, pintando bisontes y toros y nuestras propias manos en las entrañas de las grutas. Los grandes inventos no son los artefactos, ni las cosas que nos hacen más eficaces, más veloces, más capaces de destrucción y de intimidación, de acumulación y de egoísmo. Los grandes inventos son los que nos hicieron humanos en el sentido más silvestre del término: el que utilizamos para decir que alguien es generoso, compasivo, cordial, capaz de inteligencia serena y de solidaridad. Todos advertimos que hay en el proceso de humanización, no como una conquista plena sino como una tendencia, la búsqueda de la lucidez, de la cordialidad, de la responsabilidad, de la gratitud, de la generosidad, de la celebración de los dones del mundo. Es inquietante saber que no es tanto la ignorancia sino el conocimiento lo que nos va volviendo tan peligrosos. “Allí donde crece el peligro crece también la salvación”, dijo Hölderlin. Entonces estos tiempos, los de ahora, son los mejores: porque llaman a la renovación de la historia. Y si es en la cultura donde surge el peligro, es allí donde tenemos que buscar la salvación.

*Adaptado de: Ospina, W. (15 de julio de 2012). En tiempos de peligro. Recuperado el 04 de agosto, de periódico El Espectador: http://www.elespectador.com/opinion/columna-359788-tiempos-de-peligro.*`;

    const textoBenedetti = `# RESPONDE LAS PREGUNTAS 16 A 18 DE ACUERDO CON EL SIGUIENTE TEXTO.

**La noche de los feos**

Ambos somos feos. Ni siquiera vulgarmente feos. Ella tiene un pómulo hundido. Desde los ocho años, cuando le hicieron la operación. Yo tengo una quemadura grande, de cuando era chico, en la mejilla izquierda.

Vivimos en una ciudad donde hay demasiados hombres y mujeres que son hermosos. A veces siento animadversión por mi rostro y por Dios que me lo dio; en cambio a ella le gustan sus ojos, que son hermosos, faros de justificación en medio de tanta fealdad. Pero no me quejo de mi fealdad. Los feos tenemos nuestro propio orgullo, una extraña aristocracia. No somos como Narciso, que se enamoraba de su imagen en el agua. Nosotros sabemos que el espejo es un enemigo implacable, pero cuando nos miramos el uno al otro, nos comprendemos sin palabras.

*Benedetti, Mario. (1968). La noche de los feos. En La muerte y otras sorpresas.*`;

    const textoSentidoVida = `# RESPONDE LAS PREGUNTAS 19 Y 20 DE ACUERDO CON EL SIGUIENTE TEXTO.

**El sentido de la vida**

A menudo se dice que la vida carece de sentido porque somos seres diminutos en la inmensidad del cosmos, o porque todo lo que hagamos carecerá de importancia dentro de millones de años. Sin embargo, el sentido de nuestra vida presente no depende del tamaño de nuestro cuerpo en relación con las galaxias ni del futuro lejano, sino del valor intrínseco que otorgamos a nuestras acciones, afectos y propósitos en el aquí y el ahora.`;

    const g11Preguntas = g11.preguntas.map(p => {
      // 11-15
      if (p.orden === 11) {
        return {
          ...p,
          enunciado: `${textoOspina}\n\nDe acuerdo con la referencia bibliográfica, es posible afirmar que el texto de William Ospina forma parte de:`
        };
      }
      if (p.orden === 12) {
        return {
          ...p,
          enunciado: `${textoOspina}\n\nEl autor utiliza la expresión “…por eso está bien que alguien nos recuerde…”, con el fin de:`
        };
      }
      if (p.orden === 13) {
        return {
          ...p,
          enunciado: `${textoOspina}\n\nSegún el autor, a diferencia de lo que la mayoría piensa, los grandes inventos:`
        };
      }
      if (p.orden === 14) {
        return {
          ...p,
          enunciado: `${textoOspina}\n\nSegún el contenido del texto, puede concluirse que el autor busca que el lector:`
        };
      }
      if (p.orden === 15) {
        return {
          ...p,
          enunciado: `${textoOspina}\n\nEl conector <u>subrayado</u> en el texto anterior (**<u>por eso</u>**) es de tipo:`,
          respuestaCorrecta: 'B',
          opciones: [
            { letra: 'A', texto: 'de contraste.' },
            { letra: 'B', texto: 'causa-efecto / consecuencia.' },
            { letra: 'C', texto: 'adición.' },
            { letra: 'D', texto: 'negación.' }
          ]
        };
      }

      // 16-18
      if (p.orden === 16) {
        return {
          ...p,
          enunciado: `${textoBenedetti}\n\nCuando el narrador afirma que en ocasiones siente “animadversión” por su rostro y por Dios, hace alusión a un sentimiento de:`
        };
      }
      if (p.orden === 17) {
        return {
          ...p,
          enunciado: `${textoBenedetti}\n\nEl autor hace alusión a Narciso, personaje de la mitología griega, quien:`
        };
      }
      if (p.orden === 18) {
        return {
          ...p,
          enunciado: `${textoBenedetti}\n\nEn el segundo párrafo, la metáfora “faros de justificación”:`
        };
      }

      // 19-20
      if (p.orden === 19) {
        return {
          ...p,
          enunciado: `${textoSentidoVida}\n\nA partir del texto anterior se puede construir el siguiente argumento: Si nuestra vida no tiene sentido debido a que ocupamos un minúsculo lugar en el universo, entonces al ocupar un lugar de grandes proporciones nuestra vida tendría más sentido. No obstante, la vida no tendría más sentido al ocupar un lugar de grandes proporciones. En conclusión, no es verdad que la vida no tenga sentido debido al tamaño del espacio que ocupamos en el universo. El anterior argumento es:`
        };
      }
      if (p.orden === 20) {
        return {
          ...p,
          enunciado: `${textoSentidoVida}\n\nConsidere el siguiente enunciado: “La felicidad es el fin último de la vida”. Este enunciado permite:`
        };
      }

      return p;
    });

    await db.collection('ex_examenes').updateOne(
      { _id: g11._id },
      { $set: { preguntas: g11Preguntas } }
    );
    console.log('✓ Grado 11 actualizado exitosamente con lecturas completas y conectores subrayados.');
  }

  // =========================================================================
  // 2. GRADO 8°
  // =========================================================================
  const g8 = await db.collection('ex_examenes').findOne({ titulo: /Grado 8/i, esAdmision: true });
  if (g8) {
    console.log('Actualizando Grado 8...');

    // Extract texts from P11, P15, P18, P21, P26, P41, P46, P51
    const p11Full = g8.preguntas.find(p => p.orden === 11)?.enunciado || '';
    const textoCadenaPerpetua = p11Full.split('¿Cuál es la tesis')[0].trim();

    const p15Full = g8.preguntas.find(p => p.orden === 15)?.enunciado || '';
    const textoChivo = p15Full.split('¿A qué tipo de texto pertenece')[0].trim();

    const p18Full = g8.preguntas.find(p => p.orden === 18)?.enunciado || '';
    const textoEvolucion = p18Full.split('¿Cuál de las siguientes afirmaciones es CORRECTA')[0].trim();

    const p21Full = g8.preguntas.find(p => p.orden === 21)?.enunciado || '';
    const textoIntegracion = p21Full.split('¿Cuál de las siguientes afirmaciones sobre los acuerdos')[0].trim();

    const p26Full = g8.preguntas.find(p => p.orden === 26)?.enunciado || '';
    const textoImperialismo = p26Full.split('Se puede afirmar que el colonialismo')[0].trim();

    const p41Full = g8.preguntas.find(p => p.orden === 41)?.enunciado || '';
    const textoEducation = p41Full.split('Choose the correct word')[0].trim();

    const p46Full = g8.preguntas.find(p => p.orden === 46)?.enunciado || '';
    const textoBeeStops = p46Full.split('Choose the correct word')[0].trim();

    const p51Full = g8.preguntas.find(p => p.orden === 51)?.enunciado || '';
    const textoEgypt = p51Full.split('What was Egypt’s natural')[0].trim();

    const g8Preguntas = g8.preguntas.map(p => {
      // 11-13 (Cadena Perpetua)
      if (p.orden === 12) {
        return {
          ...p,
          enunciado: `${textoCadenaPerpetua}\n\nSegún el autor, ¿qué se puede hacer para reducir la violación a menores?`
        };
      }
      if (p.orden === 13) {
        return {
          ...p,
          enunciado: `${textoCadenaPerpetua}\n\n¿Es necesario buscar información en los medios de comunicación para enriquecer la postura frente al tema?`
        };
      }

      // 15-16 (La fiesta del Chivo)
      if (p.orden === 16) {
        return {
          ...p,
          enunciado: `${textoChivo}\n\n¿Por qué la novela es el género usado por Mario Vargas Llosa para exponer un momento histórico como la dictadura de Rafael Trujillo?`
        };
      }

      // 18-19 (Evolución)
      if (p.orden === 19) {
        return {
          ...p,
          enunciado: `${textoEvolucion}\n\n¿Cuál es el tema principal del texto sobre la evolución humana?`
        };
      }

      // 21-25 (Integración Económica)
      if (p.orden === 22) {
        return {
          ...p,
          enunciado: `${textoIntegracion}\n\nAunque los acuerdos de integración comercial no eliminan la soberanía de los países miembros, ¿qué aspecto se ve condicionado por estos acuerdos?`
        };
      }
      if (p.orden === 23) {
        return {
          ...p,
          enunciado: `${textoIntegracion}\n\n¿Cuál puede ser un argumento que permita justificar la creación de bloques comerciales entre países?`
        };
      }
      if (p.orden === 24) {
        return {
          ...p,
          enunciado: `${textoIntegracion}\n\n¿En qué debe consistir el trato que deben brindarle las autoridades de los países receptores a los migrantes laborales?`
        };
      }
      if (p.orden === 25) {
        return {
          ...p,
          enunciado: `${textoIntegracion}\n\n¿A qué tipo de situaciones pueden estar expuestos los migrantes según el texto?`
        };
      }

      // 26-30 (Imperialismo)
      if (p.orden === 27) {
        return {
          ...p,
          enunciado: `${textoImperialismo}\n\n¿Qué implica el imperialismo según el texto?`
        };
      }
      if (p.orden === 28) {
        return {
          ...p,
          enunciado: `${textoImperialismo}\n\n¿Por qué se acentuó la configuración imperialista durante la segunda mitad del siglo XIX?`
        };
      }
      if (p.orden === 29) {
        return {
          ...p,
          enunciado: `${textoImperialismo}\n\n¿Cuál fue la consecuencia del enorme crecimiento de la producción europea en el siglo XIX, según el texto?`
        };
      }
      if (p.orden === 30) {
        return {
          ...p,
          enunciado: `${textoImperialismo}\n\n¿Qué contribuyó al proceso de integración cultural del mundo bajo la hegemonía de Europa Occidental, según el texto?`
        };
      }

      // 41-45 (Education and work)
      if (p.orden >= 42 && p.orden <= 45) {
        const gapNum = p.orden;
        return {
          ...p,
          enunciado: `${textoEducation}\n\nComplete the text 'Education and work'. Choose the correct word for gap (${gapNum}):`
        };
      }

      // 46-50 (Dutch Bee Stops)
      if (p.orden >= 47 && p.orden <= 50) {
        const gapNum = p.orden;
        return {
          ...p,
          enunciado: `${textoBeeStops}\n\nComplete the text 'Dutch Bee Stops'. Choose the correct word for gap (${gapNum}):`
        };
      }

      // 51-60 (Ancient Egypt)
      if (p.orden === 52) {
        return { ...p, enunciado: `${textoEgypt}\n\nWho could afford to ride horses in Ancient Egypt?` };
      }
      if (p.orden === 53) {
        return { ...p, enunciado: `${textoEgypt}\n\nWhat were chariots used for?` };
      }
      if (p.orden === 54) {
        return { ...p, enunciado: `${textoEgypt}\n\nWhat plant were the first Egyptian boats made from?` };
      }
      if (p.orden === 55) {
        return { ...p, enunciado: `${textoEgypt}\n\nFrom which two places did the Egyptians get special wood for making ships?` };
      }
      if (p.orden === 56) {
        return { ...p, enunciado: `${textoEgypt}\n\nWhy was riding horses only for rich Egyptians?` };
      }
      if (p.orden === 57) {
        return { ...p, enunciado: `${textoEgypt}\n\nHow might the addition of sails have changed trade in Ancient Egypt?` };
      }
      if (p.orden === 58) {
        return { ...p, enunciado: `${textoEgypt}\n\nWhy would scientists be interested in old boat drawings?` };
      }
      if (p.orden === 59) {
        return { ...p, enunciado: `${textoEgypt}\n\nDo you think the River Nile was more important for transport in Ancient Egypt than roads are today?` };
      }
      if (p.orden === 60) {
        return { ...p, enunciado: `${textoEgypt}\n\nIf Ancient Egyptians had today’s transportation technology, would they still have used boats on the Nile?` };
      }

      return p;
    });

    await db.collection('ex_examenes').updateOne(
      { _id: g8._id },
      { $set: { preguntas: g8Preguntas } }
    );
    console.log('✓ Grado 8 actualizado exitosamente con todas las lecturas propagadas.');
  }

  // =========================================================================
  // 3. GRADO 7°
  // =========================================================================
  const g7 = await db.collection('ex_examenes').findOne({ titulo: /Grado 7/i, esAdmision: true });
  if (g7) {
    console.log('Actualizando Grado 7...');
    const p41Full = g7.preguntas.find(p => p.orden === 41)?.enunciado || '';
    const tablaHanna = p41Full.split('Hanna can:')[0].trim();

    const g7Preguntas = g7.preguntas.map(p => {
      if (p.orden === 42) {
        return {
          ...p,
          enunciado: `${tablaHanna}\n\nMark can:`
        };
      }
      if (p.orden === 43) {
        return {
          ...p,
          enunciado: `${tablaHanna}\n\nAmy can:`
        };
      }
      return p;
    });

    await db.collection('ex_examenes').updateOne(
      { _id: g7._id },
      { $set: { preguntas: g7Preguntas } }
    );
    console.log('✓ Grado 7 actualizado exitosamente.');
  }

  console.log('\n¡Todos los exámenes de admisión tienen ahora sus lecturas completas y formatos vinculados!');
  await client.close();
}

fixAllSharedReadings().catch(console.error);
