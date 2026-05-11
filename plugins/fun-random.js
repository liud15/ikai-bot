// ═══════════════════════════════════════════════
// 🎲 FUN RANDOM — Generadores de situaciones
// Comandos: fraseanime, excusa, consejo, mision, titulo
// Sin APIs externas — todo local y con humor latino
// ═══════════════════════════════════════════════

// --- FRASES ANIME (con atribución) ---
const FRASES_ANIME = [
    // Shonen clásico
    '🔥 "¡Voy a ser el rey de los piratas!" — *Monkey D. Luffy, One Piece* (Ep 1... y cada ep después también)',
    '💨 "Puedo usar el 100% de mi poder." — *Mob, Mob Psycho 100* (segundos antes de que todo explote)',
    '⚡ "Limitación... ¡Retirada!" — *Kakashi Hatake, Naruto* (mientras deja que Naruto se encargue)',
    '🌀 "¡Kaioken por 20!" — *Goku, Dragon Ball Z* (ignorando completamente su cuerpo)',
    '🦅 "La llama de la juventud nunca se apaga." — *Rock Lee, Naruto* (llorando mientras hace 1000 flexiones)',
    '⚔️ "Nada puede cortar lo que no puede ser cortado." — *Roronoa Zoro, One Piece* (perdido en el barco aún)',
    '🌊 "El mar... es vasto." — *Zoro, One Piece* (se perdió otra vez, mismo arco)',
    '🩸 "Yo no me muero." — *Shanks, One Piece* (perforado, cortado y aún sonriendo)',
    '💪 "¡Mis movimientos son los que no se pueden ver!" — *Saitama, One Punch Man* (tampoco puede verse su motivación)',
    '🥊 "Si estoy muerto, no puedo cumplir mis promesas." — *Gaara, Naruto* (antes del arco donde casi muere)',
    '🌙 "El poder de la amistad..." — *Todos los protagonistas Shonen juntos, al mismo tiempo, siempre*',
    '🎭 "Este poder oscuro... No fue elegido por mí. Pero sí comprado en DLC." — *Berserk remaster 2.0*',

    // Seinen / Maduro
    '🧠 "En este mundo, los más poderosos son los que no necesitan razones para matar." — *Johan Liebert, Monster* (susurrando suavemente)',
    '🌸 "Hay momentos en la vida que no puedes recuperar. Como el tiempo que gasté leyendo esta cita." — *Gintoki Sakata, Gintama*',
    '🍡 "Soy el perro más fuerte del universo." — *Gintoki, Gintama* (mientras come parfait llorando)',
    '☠️ "Bienvenidos al infierno." — *Griffith, Berserk* (antes de arruinar todo. Literalmente todo.)',
    '🍺 "Los hombres mueren. Los héroes viven para siempre... en el merch." — *Gendo Ikari, Evangelion* (parafraseo)',
    '🤖 "¿Quieres continuar?" — *HAL 9000-kun, cualquier mecha de los 90s*',
    '🌿 "Todo tiene un precio. El tuyo es bajo." — *Izaya Orihara, Durarara!!* (mientras manipula a todos en la cafetería)',
    '🔪 "Apégate a tus instintos. Mi instinto me dice que coma y duerma." — *Levi Ackerman, Attack on Titan* (probablemente no)',

    // Isekai / Sobrenatural
    '🏆 "Conquisté el mundo en 3 días con una hoja de cálculo." — *Protagonista Isekai promedio, ${año actual}*',
    '📊 "Mi nivel es literalmente infinito. Mira, el número se desbordó." — *Ainz Ooal Gown, Overlord* (nervioso internamente)',
    '🌟 "Como el gran mago que soy, calculo que... no sé nada y voy a improvisar." — *Ainz, Overlord Ep 3*',
    '👑 "Con mis 7 millones de seguidores en otra dimensión, puedo permitirme no trabajar aquí tampoco." — *Every Isekai MC*',
    '🧙 "Adquirí el poder supremo del universo. Ahora lo uso para abrir frascos." — *Rimuru Tempest, slime isekai*',
    '💎 "Fui reencarnado como la piedra más poderosa del mundo." — *Manga que existe realmente, 2023*',

    // Romance / Slice of life
    '💌 "Si me gustas, te lo digo en el capítulo 87. O en el 144. Ya veremos." — *Todo protagonista de romance anime*',
    '🌺 "La distancia entre nosotros es de 0.3 milímetros. Un océano emocional." — *Oregairu, tono exacto*',
    '😤 "¡No es que me gustes o algo! B-baka." — *Tsundere #4721, sin nombre*',
    '🫀 "Mi corazón late más rápido ¿será amor? ¿o el café que tomé?" — *Takagi-san, pensamiento interno*',
    '🌻 "Siempre estaré aquí para ti." — *Personaje querido que muere en 2 capítulos, Clannad/AnoHana/etc*',
    '🌈 "El amor más puro... ¿pero de cuál de las 6 chicas el MC no se da cuenta?" — *Cada harem 2015-presente*',

    // Psicológico / horror
    '🧩 "¿Realmente estás seguro de que esto es real? ¿O solo crees que lo es?" — *Rin Shiori (OC de Reddit)*',
    '🃏 "El verdadero monstruo... eras tú durante todo este tiempo. Y tus impuestos." — *Villain genérico revelado*',
    '♟️ "Calculé 127 futuros. En 126 pierdes. En el 127 también, pero con más estilo." — *Doctor Strange versión anime*',
    '🌑 "La oscuridad no es la ausencia de luz. Es la ausencia de electricidad pagada." — *Kaneki Ken, Tokyo Ghoul*',
    '😈 "Todos tienen su precio. El tuyo incluía un café con leche y un croissant." — *Light Yagami, Death Note* (hubiera anotado)',

    // Filosóficos absurdos
    '🌍 "Este mundo es cruel. Y también tiene mucho lag." — *Kirito, Sword Art Online* (offline)',
    '🔮 "El destino no existe. Solo existen las malas decisiones que tomas a las 3 AM." — *Homura Akemi, Madoka* (retrocedió en el tiempo por esto)',
    '🌀 "El tiempo es relativo. Especialmente cuando esperas el siguiente capítulo del manga." — *Berserk fan haciendo las paces*',
    '💫 "Si el protagonista puede, yo también puedo. Aunque él tenga plot armor y yo no." — *Personaje secundario que muere primero*',
    '🎌 "La diferencia entre un héroe y un villano... es quién tiene el opening más épico." — *Análisis académico, Twitter*',
    '🌸 "Siempre regreso. Como el relleno de Naruto, siempre regreso." — *Orochimaru, siendo consistente al menos*',
    '🍥 "¡Cree en mí que cree en ti!" — *Kamina, Gurren Lagann* (antes de... no, spoilers)',
    '⚡ "Ni siquiera en mi muerte me quedo quieto." — *Lelouch vi Britannia, Code Geass* (spoiler verificado)',
    '🌊 "El mar que separa mi corazón de la respuesta es de doble tilde azul." — *Nami, versión moderna*',
    '🎵 "Fly me to the moon." — *Misato Katsuragi, Evangelion* (sacado de contexto, pero siempre aplica)',

    // --- Originales (estilo meme sin filtro) ---
    '🌸 "Si no puedes protegerlos, ¿qué clase de protagonista eres?" — Tío del harem genérico, cap 1',
    '⚔️ "Yo no peleo para ganar. Peleo porque tengo WiFi ilimitado y nada que hacer." — Shounen promedio',
    '🔥 "El poder verdadero no se entrena. Se consigue comprando el pase de batalla." — DLC Shaman',
    '💀 "Antes muerto que volver a ser personaje de relleno." — Episodio 7, sin nombre ni backstory',
    '🌙 "La oscuridad en mi corazón es de 16GB sin expandir." — Protagonista edgy de turno',
    '😤 "¡NADIE ME PUEDE PARAR!" *pierde con el primer boss del tutorial* — Todo isekai, sin excepción',
    '🌀 "Este poder... no lo pedí. Pero sí lo farmé 47 horas seguidas." — Reencarnado OP',
    '💔 "Mi único amor verdadero fue el servidor que cerró en 2019." — Otaku profesional, llorando',
    '🗡️ "¡No renunciaré! Aunque ya van 3 temporadas y todavía no hay resolución!" — Continuará...',
    '🧠 "Después de pensar exactamente 0.3 segundos, calculé todas las posibilidades del universo." — Genio de 14 años',
    '🥹 "Las lágrimas no son debilidad. Son el opening lento que suena dentro de mí." — Arco de relleno cap 67',
    '😭 "¡Nooooo, el filler dura otro mes más!" — La fanbase entera, simultáneamente',
    '🎌 "Mi mayor villano siempre fue el capítulo de los flashbacks." — Todos los fans, todos los animes',
    '🍜 "La ramen me salvó la vida. Y el opening también. Y la waifu secundaria que merecía más screen time." — Protagonista tipo',
    '👊 "¡MAS ALLAAAAA!" *recibe una bofetada de la realidad inmediatamente después* — Estudiante de UA',
    '🌊 "El agua moja a todos... excepto al plot armor del héroe principal." — Antagonista derrotado, ep final',
    '🎭 "La justicia es relativa. Pero el fanservice es absolutamente constante." — Sensei, 2B energy',
    '🃏 "Le temo a pocas cosas en este mundo: al spoiler, al hiatus y al canon que mató a mi favorito." — Fan veterano',
    '💫 "Cada episodio de relleno me quita exactamente 3 años de vida. Ya voy en -12 en total." — Veterano del anime',
    '😏 "Quien domina el maratón de 47 episodios en un fin de semana sin dormir, domina el mundo." — Sabio del streaming',
    '🎵 "Hacer skip al opening después de 3 temporadas es una traición que no me perdono a mí mismo." — Fan honesto',
    '📱 "El peor jutsu de todos es el de hacer spoilers en Twitter 2 horas después del estreno." — Ninja de la desgracia',
    '🌸 "Dios dijo: hágase la waifu. Y vio que era bueno. Pero el mangaka la mató igual en el capítulo 89." — Génesis Otaku',
    '🤡 "Mi nivel de poder es inversamente proporcional a mi cantidad de amigos reales." — Autopercepción isekai, honesta',
]

// --- EXCUSAS (más creíbles) ---
const EXCUSAS = [
    // Transporte / logística
    '🚌 Salí a tiempo pero el bus pasó 3 minutos antes de lo normal. No hubo nada que pudiera hacer.',
    '🚦 Me agarró un semáforo larguísimo en avenida principal y de ahí todo se atrasó en cadena.',
    '🅿️ No encontré estacionamiento por 40 minutos. Para cuando encontré, ya no tenía caso llegar.',
    '⛽ El tanque marcó reserva en el camino. Paré a echar gasolina y la fila en la grifo era interminable.',
    '🛣️ Había un accidente en la vía de acceso y desviaron todo el tráfico. Mapas no actualizó a tiempo.',
    '🚗 El carro de mi vecino estaba bloqueando el mío y no contestaba el teléfono.',
    '🚇 El metro tuvo "demora por operaciones" por 25 minutos exactos. Sin avisar en la app.',
    '☔ Llovió justo cuando iba a salir y esperé que pasara. Pasó 2 horas después.',
    '🏗️ Cerraron la calle por obras municipales sin previo aviso. Tuve que dar una vuelta enorme.',
    '📱 Se descargó el GPS y no sé la ciudad lo suficiente para ir sin él.',

    // Salud / cuerpo
    '🤧 Me levanté con la garganta rasposa y decidí no arriesgar a los demás por precaución.',
    '😵 Me dolió la cabeza fuerte cuando iba saliendo. Tomé algo y esperé a que bajara el dolor.',
    '🤢 Comí algo en el desayuno que no me cayó bien. Preferí no salir para evitar problemas.',
    '👁️ Me picó mucho el ojo toda la mañana, me lo froté y quedó todo rojo. No quería ir así.',
    '😴 No pude dormir bien anoche y me quedé dormido en la alarma sin darme cuenta.',
    '🩹 Me di un golpe tonto en el dedo del pie y casi no podía caminar cómodo.',
    '💊 Tomé un medicamento que me cayó duro al estómago y me tuvo mal un buen rato.',
    '🦶 Me salió una ampolla en el pie con los zapatos nuevos. No podía caminar bien.',

    // Responsabilidades / imprevistos
    '📞 Me llamó un familiar con un problema urgente justo cuando salía. No podía ignorarlo.',
    '🔑 No encontraba las llaves y busqué por todos lados. Las encontré en el lugar más obvio, pero ya era tarde.',
    '💻 Se me olvidó algo importante en la computadora y tuve que volver a buscarlo.',
    '📦 Tenía que esperar al delivery que ya llevaba dos horas tarde. Llegó justo cuando tenía que salir.',
    '🐕 El perro se escapó al abrir la puerta y tardé en atraparlo porque se emocionó demasiado.',
    '🔌 Se fue la luz en el edificio y el ascensor no funcionaba. Para cuando volvió, se me fue el tiempo.',
    '💧 Se reventó una caño en casa y tuve que quedarme hasta que llegara el gasfitero.',
    '📋 Tenía una llamada de trabajo que se extendió mucho más de lo previsto y no pude cortarla.',
    '🏦 Fui al banco y la cola era enorme. Me llevó el doble de tiempo de lo que calculé.',
    '🧾 Tuve que resolver un trámite online que no dejaba avanzar y seguí intentando hasta resolverlo.',
    '👶 Tuve que quedarme con el pequeño de imprevisto porque cambiaron los planes del adulto a cargo.',
    '🧺 Se me olvidó poner la lavadora y la ropa que iba a usar estaba mojada. Tuve que cambiar.',
    '📮 Llegó un sobre importante que requería firma y no podía irme hasta recibirlo.',
    '🌡️ Tuve que llevar al animal de la casa al veterinario porque amaneció con algo raro.',

    // Tecnología
    '📵 El teléfono se apagó de la noche a la mañana aunque lo cargué. No vi las notificaciones hasta tarde.',
    '🔇 Tenía el volumen en silencio sin darme cuenta y no escuché las llamadas ni las alarmas.',
    '🖥️ Se actualizó el sistema solo en el peor momento y quedó reiniciando 30 minutos.',
    '📶 Me quedé sin señal en un punto muerto justo cuando necesitaba coordinar cómo llegar.',
    '🔋 La aplicación de mapas se cerró sola con el teléfono al 15% y no sabía el camino de memoria.',
    '💳 La tarjeta no pasó en el terminal de pago al comprar el pasaje y perdí tiempo resolviendo eso.',

    // Confusiones / errores
    '📅 Tenía apuntado mal el horario. Juro que decía una hora diferente en mi calendario.',
    '🗺️ Fui al lugar equivocado porque no verifiqué bien la dirección. Cuando llegué al correcto ya era tarde.',
    '🔄 Esperé en el punto de siempre sin saber que habían cambiado el punto de reunión.',
    '📬 No recibí el mensaje de cambio de planes hasta que ya estaba en camino.',
    '⏱️ Calculé mal el tiempo de viaje. No conté con el tráfico típico de esa hora.',

    // --- Originales (más absurdas pero divertidas) ---
    '🐱 No fui porque un gato me miró fijo 10 segundos exactos y entendí que no era mi día.',
    '🌧️ No llegué porque llovió y mi cabello tiene más derechos laborales que yo.',
    '📱 No pude salir porque estaba en el capítulo 47 y era humanamente imposible cortarlo ahí.',
    '🌐 Mi WiFi entró en duelo colectivo por la muerte de un personaje y se negó a funcionar toda la tarde.',
    '🪑 No fui porque me senté a "descansar solo 5 minutos" y desperté 4 horas después en el sillón.',
    '🐕 Vi un perro callejero con cara triste y no pude irme. Nadie puede irse si hay un perro triste cerca.',
    '🎮 Estaba en medio de una raid con mi equipo y la lealtad digital tiene un precio real.',
    '🧦 Busqué mi calcetín izquierdo por 45 minutos. No lo encontré. Ya no tenía sentido salir.',
    '🔋 Mi cargador llegó al 1% justo al salir. Esperé a que llegara al 100% por respeto al dispositivo.',
    '🌙 Me puse a pensar si los peces sienten sed y perdí la noción del tiempo por completo.',
    '🕳️ Caí en un agujero de YouTube de tutoriales de habilidades que nunca voy a usar. Fue inevitable.',
    '🛌 La cama me pidió "5 minutos más" por décima vez consecutiva y di mi consentimiento informado.',
    '📦 Esperé el delivery toda la tarde y el señor llegó exactamente cuando abrí la puerta para salir.',
    '🪞 Me miré al espejo, tomé algunas malas decisiones y volví a la cama a replantearme todo.',
    '🎭 Tuve una crisis existencial leve a las 11 AM. Estas cosas no respetan horarios ni compromisos.',
    '🦗 Había un mosquito en el cuarto y la cacería se extendió hasta cubrir toda la tarde disponible.',
    '🌡️ Tuve fiebre de exactamente 36.8°C. Clínicamente estaba bien. Emocionalmente no era el caso.',
    '📚 Iba a estudiar, abrí el libro en la página correcta y lo cerré de inmediato por instinto de supervivencia.',
    '🍕 Esperé que la pizza se enfriara "solo un poquito" y me quedé dormido esperando el momento óptimo.',
    '🤯 Lo intenté de verdad pero el universo me envió exactamente 3 señales claras de que no era el momento.',
    '✋ No lo hice porque primero tenía que terminar el otro pendiente... que tampoco complété. Es un sistema.',
    '🧠 Mi cerebro se actualizó solo en medio de la tarea y quedó en modo "reiniciando... 79%" indefinidamente.',
    '🥱 Tenía todas las ganas del mundo pero el cuerpo votó en contra por mayoría simple e irrefutable.',
    '🗓️ Lo dejé para mañana. Ese mañana lleva acumulando tres semanas siendo mañana sin avanzar.',

    // --- Clásicas que siempre creen ---
    '🤒 No me sentí bien desde la noche anterior. Preferí no arriesgarme y quedarme en casa por precaución.',
    '🌡️ Amanecí con fiebre. No era alta pero tampoco quería empeorar estando afuera.',
    '🤧 Llevo dos días con gripe y ya me está bajando, pero aún no estoy al 100%.',
    '🍽️ Comí algo que no me cayó bien anoche. Esta mañana amaneció el estómago revuelto todavía.',
    '💊 El médico me dijo que descansara hoy. No era nada grave pero fue recomendación suya.',
    '😵‍💫 Me mareé de repente cuando iba saliendo. Me senté un momento y se me fue el tiempo.',
    '🦷 Tengo una cita con el dentista que no podía cancelar, llevaba semanas esperándola.',
    '🏥 Tuve que acompañar a un familiar al médico de urgencia. No era yo pero igual no podía dejarlo solo.',
    '👶 La persona que cuida a los niños canceló de último momento y no encontré reemplazo.',
    '🧓 Tuve que quedarme con mi abuela/abuelo porque no estaba bien y no había nadie más.',
    '🚿 Se fue el agua en casa y no pude ducharme. No iba a salir así.',
    '🔌 Hubo un corte de luz y perdí todo lo que tenía avanzado. Tuve que rehacer varias horas de trabajo.',
    '🌊 Se inundó la calle de mi casa y el carro no podía salir sin riesgo.',
    '🐾 Mi mascota amaneció mal y tuve que llevarla de urgencia al veterinario.',
    '📝 Tenía un trámite urgente que vence hoy y no podía aplazarlo de ninguna forma.',
    '🏦 El banco me bloqueó la cuenta y tuve que ir a resolverlo en persona. La cola fue enorme.',
    '🔧 Se averió algo en casa y tuve que esperar al técnico toda la mañana. Llegó tarde.',
    '🚪 Se me trabó la cerradura y no podía salir ni abrir. Tuve que llamar a alguien para que me ayude.',
    '📋 Me llamaron del trabajo/colegio por un asunto urgente que no podía esperar.',
    '💼 Me salió una reunión de último momento que no podía rechazar ni mover.',

    // --- Transporte y logística creíbles ---
    '🚌 El transporte estaba en huelga y no había cómo llegar en tiempo razonable.',
    '⛽ Me quedé sin gasolina en una zona sin grifo cerca. Tardé bastante en resolverlo.',
    '🚗 El carro no encendió esta mañana. Batería descargada de la noche a la mañana.',
    '🔑 Se me olvidaron las llaves del carro dentro de casa y ya había cerrado con doble vuelta.',
    '🛞 Pinché una llanta camino. Sin herramientas encima y sin señal para llamar.',
    '🚦 Hubo un accidente grande en la autopista y cerraron varios carriles. No había salida.',
    '🚧 Estaban haciendo obras en la única ruta y desviaron todo el tráfico por calles secundarias.',
    '🚇 El metro estuvo parado casi 30 minutos por incidente técnico. Sin previo aviso.',
    '✈️ El vuelo/bus interprovincial llegó con retraso y todo lo demás se corrió.',
    '🅿️ Llegué al lugar pero no había estacionamiento disponible en un radio razonable.',
    '🌫️ Había neblina densa en la carretera y tuve que manejar muy despacio por seguridad.',
    '🌊 La vía estaba cerrada por deslizamiento. Sin ruta alternativa conocida disponible.',

    // --- Familiares / personales creíbles ---
    '👨‍👩‍👧 Hubo un problema familiar de urgencia y tuve que estar presente. No era opcional.',
    '📞 Recibí una llamada importante que llevaba días esperando y no podía cortarla.',
    '📮 Llegó una carta certificada que debía firmar personalmente y no podía salir sin recibirla.',
    '🏠 El casero/administrador vino de improviso por algo urgente del apartamento.',
    '🔐 Me quedé sin llave y un cerrajero tardó casi dos horas en llegar y abrir.',
    '🌡️ Uno de los niños amaneció con fiebre y no podía dejarlo solo.',
    '💉 Tenía una cita médica programada que no podía perder porque tardé un mes en conseguirla.',
    '🧾 Me notificaron de un trámite legal urgente que requería atención inmediata.',
    '🔋 Se quedó sin batería el carro eléctrico a mitad de camino y tuve que esperar remolque.',
    '📦 El paquete que esperaba llegó justo cuando iba saliendo y requería firma obligatoria.',

    // --- Trabajo / estudio creíbles ---
    '💻 Se me cayó el sistema en el peor momento y perdí el trabajo que tenía que entregar.',
    '📡 No tuve internet en todo el día y todo dependía de conexión para poder avanzar.',
    '🖨️ La impresora no funcionó justo cuando tenía que imprimir los documentos necesarios.',
    '📧 No recibí el correo con los detalles de la reunión/clase y no sabía bien dónde era.',
    '🗂️ Me pedieron algo adicional de último momento y tuve que quedarme a terminarlo.',
    '📊 La presentación tuvo un error técnico justo al abrirla y tuve que rehacer varias partes.',
    '🖥️ El programa se corruptó y perdí el archivo. Tardé horas en recuperar lo que pude.',
    '📁 No encontré el documento que necesitaba y busqué en todos lados sin resultado.',
    '🧑‍💻 Me asignaron una tarea urgente que bloqueaba el trabajo de todo el equipo.',
    '📲 Me llegó una alerta importante del sistema justo antes de salir que requería atención inmediata.',

    // --- Universales que nadie cuestiona ---
    '🤷 Me surgió algo de último momento que no podía ignorar ni delegar.',
    '😔 No estaba en condiciones de salir hoy. No siempre hay una razón concreta, pero era necesario quedarse.',
    '🌀 Todo se alineó mal hoy. Un inconveniente tras otro desde que me levanté.',
    '⚡ Hubo un corte de luz que dejó sin señal todo el edificio y perdí la comunicación.',
    '🏗️ La empresa de servicios vino a hacer reparaciones urgentes y tuve que supervisar todo.',
    '🩹 Tuve un pequeño accidente doméstico. Nada grave, pero necesité tiempo para atenderlo.',
    '📵 El teléfono cayó al agua y estuvo apagado todo el día. No recibí nada hasta que lo recuperé.',
    '🧳 Traspapeló algo importante y lo busqué horas hasta encontrarlo. Era urgente tenerlo.',
    '🚑 Hubo una emergencia médica cerca y quedé bloqueado/a sin poder moverme por bastante tiempo.',
    '🌪️ El clima estuvo muy malo y salir representaba un riesgo real innecesario.',
]

// --- CONSEJOS ---
const CONSEJOS = [
    // Productividad
    '📊 Divide tu proyecto en tareas más pequeñas. Ahora tienes 47 tareas pequeñas. Sigue igual de bloqueado pero organizado.',
    '⏰ La clave de la productividad es hacer primero lo más difícil. La clave real es convencerte de que lo hiciste.',
    '📋 Escribe tus metas. La energía de haberlas escrito ya cuenta como 30% de progreso.',
    '🎯 Enfócate en el proceso, no en el resultado. Así cuando no hay resultado, te sientes bien igual.',
    '📵 Desactiva las notificaciones mientras trabajas. Actívalas para ver si alguien notó que las desactivaste.',
    '🧠 Trabaja en bloques de 25 minutos con descansos de 5. En la práctica: trabaja 5 minutos y descansa 25.',
    '🌅 El mejor momento para empezar fue ayer. El segundo mejor es mañana. Hoy es un horario complicado.',
    '📚 Lee 20 páginas diarias. Cualquier libro. Incluso el mismo si no hay otro disponible. El hábito importa.',
    '🏆 El éxito se construye con hábitos pequeños y constantes. O con herencia familiar. Depende del caso.',
    '✅ Al terminar el día, escribe tus 3 logros. "Respiré", "comí" y "no procrastiné tanto" también cuentan.',
    '🔇 Silencia los distractores. El más difícil de silenciar eres tú mismo pensando en silenciar distractores.',
    '📈 Mide tu progreso semanalmente. La semana que viene ya verás. Esta semana quedaste en verlo.',
    '💡 Las mejores ideas vienen en la ducha. El problema es que no puedes escribirlas. Moleskine impermeable pendiente.',
    '🧩 Si no sabes por dónde empezar, empieza por cualquier parte. Seguramente es la parte equivocada. Aprenderás.',

    // Relacionales
    '👂 Escucha más de lo que hablas. Asiente seguido. Funciona igual aunque no estés escuchando.',
    '💬 Antes de enviar ese mensaje, léelo tres veces. Si sigue pareciendo buena idea, espera 4 horas más.',
    '🤝 Para resolver conflictos, pregunta: "¿Qué necesita la otra persona?" Luego olvídalo y haz lo que ibas a hacer.',
    '❤️ Expresa gratitud a las personas importantes. Con palabras, no solo con memes compartidos sin comentario.',
    '📞 Llama a alguien que no hablas hace mucho. No mandas mensaje, Llamas. Sí, con audio real. Aquí el reto.',
    '🌱 Las relaciones se riegan con tiempo y atención. Las que riegan solo con stickers se ponen mustias.',
    '🙏 Aprende a pedir perdón bien. Sin "pero", sin "es que", sin "si te ofendiste". Solo: "me equivoqué, lo siento".',
    '🧃 Sé la persona que aparece cuando todo está bien Y cuando está mal. Las segundas se recuerdan más.',
    '🎭 No tomes tan en serio lo que dices en chiste. A veces es lo que más duele sin que lo notes.',
    '🌟 Celebra los logros de los demás como si fueran tuyos. Algún día lo serán por asociación karmica.',

    // Filosóficos absurdos
    '🌍 Cada problema tiene solución. La solución puede ser que aprendas a vivir con el problema.',
    '🔮 No puedes controlar el futuro. Pero sí puedes preocuparte por él con enorme detalle y precisión.',
    '🌊 Fluir con la corriente está bien... desde que confirmas que la corriente va en la dirección correcta.',
    '💎 Lo que no te mata... tiene segunda oportunidad de hacerlo. Cuídate igualmente.',
    '🌅 Cada día es una nueva oportunidad. Llevas 7,000 oportunidades. El promedio mejora lentamente.',
    '🔑 La felicidad no está en las cosas materiales. Está en cosas materiales, pero específicas.',
    '🎯 El camino al éxito no es recto. Tampoco es curvado de manera interesante. Es un laberinto sin salida señalada.',
    '🧘 La paz interior se consigue cuando dejas de esperar que las cosas sean diferentes. O cuando descargas Spotify Premium.',
    '🦋 Pequeños cambios, grandes resultados. Por ejemplo: agrega un emoji a tu firma de correo. Transformador.',
    '🌿 Vivir en el presente es liberador. El presente, sin embargo, tiene sus propios problemas. Muy presentes.',
    '🎵 La música sana el alma. Sobre todo a volumen máximo cuando tienes vecinos que ponen cumbia a las 7 AM.',
    '🌙 El descanso es productivo. Repítelo hasta creerlo. El descanso es productivo. El descanso es productivo.',
    '⚡ Haz hoy lo que el tú del futuro te va a agradecer. El tú del futuro dice que lo hagas mañana.',

    // Salud
    '💧 Toma 8 vasos de agua al día. Cada vez que dices "ya voy" sin ir, cuenta el doble.',
    '🏃 Mueve el cuerpo al menos 30 minutos diarios. Buscar el control remoto cuenta si hubo urgencia.',
    '😴 Duerme 7-8 horas. Esto lo dicen los mismos que te asignan proyectos para el día siguiente.',
    '🥗 Come más verduras. Así como suena. No como guarnición. Como protagonistas del plato.',
    '🧘 Medita 10 minutos al día. Los primeros 9 pensarás en todo lo que tienes que hacer. El minuto 10 ya pasó.',
    '🌞 Sal al sol 20 minutos diarios. Tu vitamina D te lo agradecerá con un leve mejor humor que probablemente no notes.',

    // --- Originales ---
    '📊 Divide tu problema en partes más pequeñas. Ahora tienes más problemas. Enhorabuena, igualmente.',
    '⏰ La mejor hora para hacer algo que postergaste es "ya pasó, olvidémoslo". Es un método válido.',
    '💡 Haz una lista de pendientes. Agrega "hacer lista de pendientes" como ítem 1. Chúlalo. Hoy fuiste productivo.',
    '🔋 Recarga energías durmiendo. Si ya dormiste 10 horas y sigues cansado, duerme 10 más por las dudas.',
    '🚀 Sal de tu zona de confort. La zona de incomodidad también da miedo, pero al menos es variado el paisaje.',
    '🌱 El crecimiento personal llega cuando menos lo esperas. Generalmente cuando estás durmiendo o en el baño.',
    '💬 Si no entiendes algo que te dijeron, asiente lentamente. El 80% de las conversaciones se resuelven así.',
    '🤝 Para hacer amigos: sé tú mismo. Si no funciona, sé otro. Prueba varios hasta encontrar uno que funcione.',
    '❤️ El amor verdadero llega cuando dejas de buscarlo. También cuando estás en el baño, así que ojo siempre.',
    '👥 Rodéate de personas que te eleven. Si no las encuentras, quédate con gente más torpe que tú para sentirte bien.',
    '📞 Si alguien no te responde, mándale otro mensaje. Si tampoco responde, mándale 3 más. Ya te odian de igual forma.',
    '🙈 Ignora las críticas no constructivas. Ignora también las constructivas si te incomodan. El filtro es tu ego.',
    '🌍 Todo pasa por algo. Ese algo generalmente es karma, mala suerte o haber ignorado las señales más evidentes.',
    '💎 El diamante nació bajo presión extrema. Tú también puedes convertirte en algo valioso si te aplastas suficiente.',
    '🌅 Cada amanecer es una nueva oportunidad de cometer errores completamente nuevos y distintos. Aprovéchala.',
    '🔮 El futuro no está escrito. El pasado sí, y es un poco vergonzoso si lo miramos con honestidad.',
    '🌊 Fluye como el agua: sin forma fija y mojando absolutamente todo lo que tocas. Incluyendo los muebles.',
]

// --- MISIONES ---
const MISIONES = [
    // Sociales
    '🕵️ **Misión**: Convencer a alguien de que la coma después del "hola" es señal de mala vibra. Hazlo con confianza.',
    '🎭 **Misión**: Responde el próximo mensaje de voz con otro de voz más largo. Sin importar el tema. Escala la duración.',
    '📱 **Misión**: Manda un sticker completamente fuera de contexto y el próximo sticker que te manden, ignóralo.',
    '🤝 **Misión**: Di "sí, claro" a algo sin preguntar qué era. Hoy descubres en qué te metiste.',
    '📣 **Misión**: Manda "buenas" en el grupo sin nada más. Espera. Observa quién responde primero.',
    '🧪 **Misión**: Recomienda un anime sin revelar el género. Solo di "te va a encantar". Sin más contexto.',
    '⏳ **Misión**: Deja en visto a alguien por exactamente 12 minutos. Luego responde como si no hubiera pasado tiempo.',
    '📞 **Misión**: Llama a alguien (llamada de voz real, no mensaje). Di lo que tenías que decir por mensaje. Cuélga.',
    '🎤 **Misión**: Manda un audio de exactamente 2 segundos con una sola frase misteriosa y no lo expliques.',
    '🌀 **Misión**: En la próxima conversación, responde todo con preguntas. Sin afirmar nada. Solo preguntas.',
    '🗣️ **Misión**: Di algo con total seguridad que no estés seguro de que sea verdad. Evalúa si alguien lo cuestiona.',
    '🏳️ **Misión**: Cede en una discusión donde tengas razón. Observa si alguien nota que estás cediendo demasiado fácil.',

    // Personales épicas
    '🌄 **Misión**: Levántate sin ver el teléfono los primeros 10 minutos. Solo tus pensamientos. Eso es todo. Solo 10 minutos.',
    '📚 **Misión**: Lee 5 páginas de algo que no sea una pantalla. Libro, revista, folleto del supermercado. Lo que sea.',
    '🍳 **Misión**: Cocina algo con más de 3 ingredientes sin seguir exactamente ninguna receta. Improvisa.',
    '🧹 **Misión**: Limpia una superficie pequeña que llevas días ignorando. Una sola. No tienes que hacer todo hoy.',
    '🏃 **Misión**: Camina 15 minutos sin destino definido. Sin teléfono en mano. Solo caminar.',
    '📵 **Misión**: No veas el feed de ninguna red social por 2 horas. Si fallas, reinicia el contador. Sin trampas.',
    '💤 **Misión**: Esta noche, apaga la pantalla 30 minutos antes de dormirte. Solo 30 minutos de diferencia.',
    '🔕 **Misión**: Termina la próxima conversación sin mandar el último mensaje. Deja que el otro tenga la última palabra.',
    '🎨 **Misión**: Dibuja algo en papel. Lo que quieras. No lo muestres a nadie si no quieres. Solo dibuja.',
    '🌿 **Misión**: Toma agua. Ahora mismo. Deja de leer esto y ve por un vaso. Ya. Esta es la misión.',

    // Absurdas épicas  
    '🌮 **Misión**: Come algo sin que se te caiga nada. Si es taco, la dificultad se multiplica por 3.',
    '📡 **Misión**: Encuentra el cable del cargador que desapareció esta semana. Está en un lugar obvio. Aún no lo has visto.',
    '☕ **Misión**: Toma el primer sorbo de algo caliente sin quemarte. Las estadísticas no te favorecen.',
    '📺 **Misión**: Mira "solo un episodio" y que sea verdad. Control total. Un episodio. YA.',
    '🧩 **Misión**: Encuentra el par del calcetín que lleva sin pareja más de una semana. Meréce reunion.',
    '🔍 **Misión**: Ordena 5 cosas que están en el lugar equivocado en este momento. Ahora. 5 cosas.',
    '🌀 **Misión**: Explícale a alguien mayor qué es un meme y por qué es gracioso. Sin perder la paciencia.',
    '🎲 **Misión**: Juega algo y acepta el resultado sin excusas. Ni lag, ni falla del sistema, ni "no estaba concentrado".',
    '🧠 **Misión**: Memoriza un número de teléfono importante sin guardarlo en el celular. La humanidad lo hacía rutinariamente.',
    '🌙 **Misión**: Identifica esa canción que no recuerdas cómo se llama, solo cómo suena. Tararéala. Shazam si necesitas.',
    '🔇 **Misión**: Escucha un audio largo sin adelantarlo. Nada de 1.5x. Velocidad normal. Respeta el mensaje.',
    '🦆 **Misión**: Di algo amable genuino a alguien hoy sin que sea en respuesta a algo. Solo porque sí.',
    '📬 **Misión**: Responde ese mensaje que llevas días viendo y sin contestar. Ya sabes cuál es. Sí, ese.',
    '🎯 **Misión**: Haz una sola cosa a la vez durante los próximos 20 minutos. Sin multitasking. Imposible para algunos.',
    '🌊 **Misión**: Cierra todas las pestañas que no estás usando ahora mismo. Todas. El cementerio de pestañas espera.',

    // --- Originales ---
    '🕵️ **Misión**: Convencer a alguien de que el agua mojada es un invento relativamente reciente. Presupuesto: 0. Credibilidad: sacrificable.',
    '🎭 **Misión**: Responde "ya llegué" cuando alguien te pregunte dónde estás. No importa dónde estés físicamente.',
    '📱 **Misión**: Dejar en visto a alguien importante exactamente 47 minutos. Luego responde como si no hubiera pasado ningún tiempo.',
    '🤝 **Misión**: Entrar a una reunión, decir "totalmente de acuerdo" sin saber de qué trata, y retirarte con plena dignidad.',
    '🎤 **Misión**: Cantar el opening de tu anime favorito completo antes del mediodía de hoy. Público opcional pero muy recomendado.',
    '🥸 **Misión**: Fingir que entiendes un meme que no entiendes. Ríe con toda la confianza del mundo en 3, 2, 1...',
    '📣 **Misión**: Manda un audio de más de 5 minutos a alguien que solo manda stickers. El sticker es el jefe final.',
    '🧪 **Misión**: Recomienda un anime sin mencionar que el protagonista muere en el capítulo 1. Tú sabes cuál.',
    '🕹️ **Misión**: Reta a alguien a un juego en el que claramente vas a perder. Pierde con estilo e impunidad.',
    '🛒 **Misión**: Ve al mercado por "una sola cosa" y vuelve con absolutamente todo menos esa cosa específica.',
    '🦆 **Misión**: Encuentra un pato en la vía pública. Si no hay patos en tu zona, el objetivo vendrá a ti eventualmente.',
    '🎲 **Misión**: Juega un juego y acepta el resultado honestamente sin decir que fue el lag el culpable de nada.',
    '🌮 **Misión**: Comer un taco sin que se le caiga el relleno al primer mordisco. Premio: respeto eterno.',
    '📺 **Misión**: Ver "un solo capítulo más" y que sea real y verdad. Las estadísticas históricas no te apoyan.',
]

// --- TÍTULOS NOBILIARIOS (formales pero absurdos) ---
const TITULOS = [
    // Tecnología / Conectividad
    '🌐 *Distinguido/a Señor/a del Ancho de Banda Compartido sin Consentimiento y Primer Barón/a de las Claves WiFi Adivinadas por Deducción Estratégica*',
    '📱 *Excelentísimo/a Duque/sa de los Mensajes Vistos y No Respondidos y Gran Escudero/a del "ahorita te contesto" desde hace tres semanas*',
    '🔋 *Ilustrísimo/a Marqués/a del Cargador al 1% y Noble Defensor/a de los Dispositivos con Batería en Estado Terminal Crónico*',
    '💾 *Archivero/a Imperial de los Capturas de Pantalla Almacenadas para Ocasiones que nunca Llegaron y Custodio/a de los Memes del 2017 aún sin Enviar*',
    '🖥️ *Venerable Gran Maestro/a de las Cuarenta y Siete Pestañas Abiertas, ninguna de las cuales se cierra por si acaso*',
    '📡 *Almirante Supremo/a del Lag Eterno y Alto Comisionado/a del "es que mi internet está raro hoy", todos los días desde el 2019*',
    '🔔 *Príncipe/sa Soberano/a de las Notificaciones en modo Silencio y Gran Elector/a del No Molestar activado con carácter permanente e irrevocable*',
    '🎧 *Archiduque/sa del Episodio Final que llevas tres semanas sin terminar porque emocionalmente no estás listo/a*',
    '📲 *Señor/a Feudal de los Stickers Enviados Fuera de Contexto y Conde/sa de los GIFs que nadie pidió pero que llegaron con mucha energía*',
    '🔇 *Gran Visir del Estado de "escribiendo..." que desapareció sin mensaje alguno y Alto Inquisidor/a del Doble Check Azul sin Respuesta*',
    '🖨️ *Distinguido/a Barón/a del Documento Enviado por WhatsApp porque la impresora llevaba tres días en huelga técnica*',

    // Gastronomía / alimentación
    '🍜 *Gran Visir del Ramen Preparado a las Dos de la Madrugada y Protector/a de los Fideos Instantáneos en Tiempos de Incertidumbre Económica*',
    '🍕 *Almirante de la Pizza Consumida Fría al Día Siguiente y Defensor/a Hereditario/a del Borde que nadie solicita pero que sigue llegando al plato*',
    '☕ *Barón/a del Café Recalentado hasta en Tres Ocasiones y Caballero/a de la Taza que ya no Quema pero tampoco está en su punto óptimo*',
    '🥚 *Marqués/a del Huevo Frito Servido en toda Ocasión y Gran Patrón/a de la Planificación Gastronómica con lo que Quedaba en la Nevera*',
    '🌮 *Señor/a Feudal del Taco Desarmado en el Primer Mordisco y Alto Comisionado/a del Relleno Caído sobre Ropa Recién Lavada*',
    '🛒 *Virrey/reina de las Compras Realizadas sin Lista y Archivero/a del Producto Urgente que fue lo único que no se trajo del mercado*',
    '🍫 *Ilustrísimo/a Conde/sa del Chocolate Oculto en el Estante Superior y Custodio/a de las Reservas de Emergencia Emocional*',
    '🧃 *Distinguido/a Señor/a del Jugo que era de Todos pero que Nadie Etiquetó y que por tanto se consumió en silencio y sin culpa*',
    '🥩 *Gran Maestro/a del Pollo que "sale en 5 minutos" desde hace cuarenta y se sirve cuando el hambre ya es histórica*',
    '🍰 *Excelentísimo/a Barón/a de la Porción de Pastel Apartada con Nombre y la cual devoró alguien cuyo nombre no se menciona por paz familiar*',

    // Sueño / Procrastinación  
    '😴 *Gran Sultán/a de la Siesta Iniciada como Descanso de Diez Minutos y que se extendió hasta convertirse en el eje del día*',
    '🛌 *Señor/a Supremo/a del Despertador Desactivado sin Recordarlo y Conde/sa del Snooze Ejecutado en Estado de Semiconsciencia Plena*',
    '📋 *Barón/a de los Diecisiete Pendientes Históricos y Gran Conde/sa de la Lista de Tareas Actualizada principalmente para agregar tareas*',
    '🌙 *Archiduque/sa de las Tres de la Madrugada Despierto/a sin Razón Aparente y Guardián/a de los Videos de YouTube de Nicho Extremo*',
    '⏳ *Señor/a de la Última Hora y Protector/a del Principio de que Todo Sale Mejor con Presión Temporal Severa e Inminente*',
    '🥱 *Príncipe/sa del Cansancio Profundo Sin Causa Establecida Médicamente y Noble del Bostezo en Reunión Importante con Cámara Encendida*',
    '⏰ *Gran Duque/sa del "me levanto en 5 minutos más" repetido exactamente nueve veces antes de levantarse efectivamente*',
    '🗓️ *Distinguido/a Marqués/a de la Fecha Agendada en el Calendario que no se revisó el día antes ni el mismo día*',
    '📅 *Excelentísimo/a Conde/sa del Proyecto Pospuesto al Próximo Lunes durante un período documentado de cinco lunes consecutivos*',

    // Anime / Cultura / Entretenimiento
    '🎌 *Gran Daimyo del Anime Iniciado y Abandonado en el Episodio Tres y Señor/a de los Finales de Temporada sin Segunda Temporada Confirmada*',
    '📖 *Barón/a del Manga Abandonado Justo en el Arco más Intenso y Regente del Hiatus del Autor que lleva más de dos años sin actualizar*',
    '🎮 *Señor/a del Videojuego Comprado en Oferta y Jamás Instalado y Archiduque/sa de la Biblioteca de Cuarenta Títulos al 0% de Progreso*',
    '🃏 *Duque/sa del Spoiler Soltado sin Advertencia Previa y Conde/sa del "¿cómo no lo habías visto ya si salió hace tres años?"*',
    '🌸 *Gran Maestro/a de las Waifus y Protector/a Constitucional del Husbando ante cualquier forma de crítica infundada o fundada*',
    '📺 **Distinguido/a Vizconde/sa del Episodio de Relleno Visto Completo por Respeto al Proceso Narrativo y no por falta de filtro*',
    '🎵 *Alto Comisionado/a del "esta canción me la sé toda" cuya letra real resulta ser completamente distinta a la recordada*',
    '🎭 *Señor/a Imperial de los Shows Comenzados en Temporada Final sin ver las anteriores y del Contexto Reconstruido por Intuición Pura*',

    // Social / Personalidad
    '🤫 *Señor/a del Silencio Estratégico en Reuniones y Barón/a de la Respuesta Excelente que llegó Treinta Minutos Después de que el Tema Cambió*',
    '😂 *Archiduque/sa del Meme Enviado sin Contexto Adicional y Príncipe/sa de la Carcajada Explicada que pierde toda la gracia al explicarse*',
    '📣 *Gran Vocal del Argumento Sostenido con Uno Mismo en el Baño y Señor/a del Discurso Perfecto Preparado para una Discusión ya Terminada*',
    '🌀 *Barón/a de las Decisiones Tomadas con Plena Convicción a las Once de la Noche y Regente del Arrepentimiento Sereno del Día Siguiente*',
    '🤝 *Señor/a de los Compromisos de Reunión Pendientes desde el Primer Trimestre del Año y Conde/sa del "cualquier día de estos nos juntamos"*',
    '🎭 *Duque/sa del Drama Contenido con Esfuerzo Visible y Conde/sa de la Indirecta Enviada con tanta elegancia que nadie la captó*',
    '👁️ *Gran Inquisidor/a del Perfil Revisado sin dejar Rastro y Barón/a del "no lo vi pero revisé todo lo del último mes por si acaso"*',
    '🌟 *Excelentísimo/a Señor/a de las Opiniones Formadas Completamente de la Nada y Protector/a del Criterio basado en Intuición Firme*',
    '🏡 *Gran Marqués/a del "en mi casa lo hacemos diferente" y Alto Custodio/a de Tradiciones Familiares de Dudoso Origen pero Fuerte Arraigo*',
    '✋ *Distinguido/a Conde/sa del Consejo No Solicitado Entregado con Genuina Voluntad de Ayuda y Completa Falta de Invitación para Hacerlo*',
    '📸 *Señor/a Supremo/a de la Foto de Grupo donde Sales Mal Tú Específicamente y Defensor/a del Derecho al Retake Ilimitado hasta Quedar Bien*',
    '🎤 *Almirante del Karaoke sin Dominio Técnico de la Canción y Príncipe/sa de la Seguridad Escénica Inversamente Proporcional al Talento Real*',
    '🌈 *Gran Barón/a de las Opiniones Cambiadas sin Anuncio Previo y Custodio/a de la Coherencia Entendida como un Concepto Dinámico y Flexible*',

    // --- Originales ---
    '🌐 *Señor/a del WiFi Prestado y Barón/a de los Megas Compartidos sin Pedirlos ni Agradecerlos*',
    '📱 *Duque/sa de los Audios No Escuchados y Conde/sa de los Mensajes Vistos sin Responder jamás*',
    '🔋 *Marqués/a del 1% de Batería y Noble de la Carga al 100% realizada justo antes de salir corriendo*',
    '💾 *Archivero/a Imperial de Screenshots Jamás Necesarios y Protector/a de los Memes de 2018 aún vigentes*',
    '🖥️ *Gran Maestro/a de las 47 Pestañas Abiertas y ninguna de ellas cerrada por si acaso se necesitan*',
    '📡 *Caudillo/a del Lag Eterno y Embajador/a del "es que mi internet está mal" en toda ocasión competitiva*',
    '🔔 *Príncipe/sa de las Notificaciones Ignoradas y Elector/a del Modo No Molestar Permanente sin excepciones*',
    '🎧 *Archiduque/sa del "un cap más" y Barón/a del Maratón de 6 horas completamente no planificado*',
    '📲 *Señor/a de los Stickers sin Contexto y Conde/sa de los GIFs Mandados en el Momento Incorrecto*',
    '🍜 *Gran Visir del Ramen Instantáneo y Protector/a de los Fideos Preparados a Medianoche con Honor*',
    '🍕 *Almirante de la Pizza Fría al Día Siguiente y Defensor/a del Borde que nadie quiere pero sigue llegando*',
    '☕ *Barón/a del Café Recalentado por Tercera Vez y Caballero/a de la Taza que ya no Quema ni calienta*',
    '🥚 *Marqués/a del Huevo Frito a toda Hora y Patrón/a de la Comida Completamente Improvisada*',
    '🛒 *Virrey/reina de las Compras sin Lista y Archiduque/sa del Producto Olvidado que era el único importante*',
    '😴 *Gran Sultán/a de la Siesta No Planeada y Regente del "5 Minutos Más" repetido hasta el atardecer*',
    '🛌 *Señor/a Supremo/a del Despertador Ignorado y Conde/sa del Snooze Infinito sin culpa ni vergüenza*',
    '📋 *Barón/a de los Pendientes Históricos y Conde/sa de la Lista que nunca avanza pero sí crece*',
    '🌙 *Archiduque/sa de las 3 AM sin Sueño y Guardián/a de los Videos de YouTube de Agujero Profundo*',
    '⏳ *Señor/a de la Última Hora y Protector/a del "ya lo hago mañana" elevado a sistema de vida*',
    '🥱 *Príncipe/sa del Cansancio Sin Razón Aparente y Noble del Bostezo en Reunión con Cámara Activa*',
    '🎌 *Gran Daimyo del Anime Inconcluso y Señor/a de los Finales Abiertos que no cerraron nunca*',
    '📖 *Barón/a del Manga Abandonado en el Mejor Momento y Regente del Hiatus que lleva años sin resolverse*',
    '🎮 *Señor/a del Juego sin Terminar y Archiduque/sa de la Biblioteca de Steam Completamente Intocada*',
    '🃏 *Duque/sa del Spoiler Involuntario y Conde/sa del "¿cómo no lo viste ya si salió hace tres años?"*',
    '🌸 *Gran Maestro/a de las Waifus y Protector/a del Husbando en Tiempos de Crítica Masiva Infundada*',
    '🤫 *Señor/a del Silencio en Reuniones y Barón/a de la Respuesta Excelente que llegó 30 minutos tarde*',
    '😂 *Archiduque/sa del Meme Fuera de Contexto y Príncipe/sa de la Carcajada sin Explicación posible*',
    '🌀 *Barón/a de las Decisiones Impulsivas y Regente del Arrepentimiento Profundo de las 2 AM*',
    '🎤 *Almirante del Karaoke sin Conocer la Letra Real y Príncipe/sa de la Confianza Escénica Sin Base*',
    '👁️ *Gran Inquisidor/a del Stalkeo Inocente y Barón/a del "lo vi pero deliberadamente no di like"*',
]


// --- Cooldown por comando, 20 segundos ---
const COOLDOWN_MS = 20_000
const cooldowns = new Map()

// Función auxiliar: elemento aleatorio
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

// Mapas de datos y emojis por comando
const DATOS = {
    fraseanime: { pool: FRASES_ANIME, header: '🎌 *Frase Épica del Día*' },
    excusa: { pool: EXCUSAS, header: '😅 *Tu Excusa del Día*' },
    consejo: { pool: CONSEJOS, header: '💡 *Consejo del Día*' },
    mision: { pool: MISIONES, header: '📜 *Tu Misión de Hoy*' },
    titulo: { pool: TITULOS, header: '🏅 *Tu Título Nobiliario*' },
}

let handler = async (m, { conn, command }) => {
    const data = DATOS[command]
    if (!data) return

    // --- Cooldown anti-spam ---
    const key = `${command}:${m.sender}`
    const now = Date.now()
    const lastUsed = cooldowns.get(key) || 0
    if (now - lastUsed < COOLDOWN_MS) {
        const restante = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000)
        return m.reply(`⏳ Espera *${restante}s* para volver a usar este comando.`)
    }
    cooldowns.set(key, now)

    const userName = conn.getName(m.sender)
    const resultado = pick(data.pool)

    const texto = `${data.header}\n\n> 👤 *${userName}*\n\n${resultado}`

    await conn.sendMessage(m.chat, {
        text: texto,
        mentions: [m.sender]
    }, { quoted: m })
}

handler.help = ['fraseanime', 'excusa', 'consejo', 'mision', 'titulo']
handler.tags = ['fun']
handler.command = ['fraseanime', 'excusa', 'consejo', 'mision', 'titulo']
handler.group = true

export default handler
