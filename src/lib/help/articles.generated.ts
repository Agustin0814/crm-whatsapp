// Archivo generado por scripts/generar-ayuda.mjs. No editar a mano:
// edita src/content/ayuda/*.md y ejecuta `npm run ayuda`.

export type HelpArticle = { slug: string; title: string; topics: string[]; body: string };

export const HELP_ARTICLES: HelpArticle[] = [
  {
    "slug": "agentes",
    "title": "Agentes de IA (página Agentes)",
    "topics": [
      "agentes",
      "asistentes",
      "encender",
      "apagar",
      "activo",
      "inactivo",
      "modo",
      "sugerencia",
      "automático",
      "configurar",
      "registro de actividad",
      "tarjetas de uso",
      "detenido por el proveedor"
    ],
    "body": "En **Agentes** están los asistentes de IA del CRM: el **Asistente de respuestas**, el **Asistente de notas** y el **Asistente del sistema**.\n\n## Encender o apagar\nEn la lista, el control **Estado** cambia entre **Activo** e **Inactivo**. Solo un administrador puede cambiarlo. Si dice «Detenido por el proveedor», el proveedor lo pausó y no se puede encender desde aquí.\n\n## Modo (solo el Asistente de respuestas)\n- **Sugerencia** (por defecto): el asistente prepara la respuesta y una persona la envía, la edita o la descarta.\n- **Automático**: envía la respuesta directo.\n\nEl de notas dice «Solo notas internas» y el del sistema no tiene modo.\n\n## Configurar\nEl botón **Configurar** abre un panel lateral con las opciones de cada asistente, en secciones. Cada pestaña se guarda con su botón **Guardar**; si cierras con cambios pendientes, el panel te avisa.\n\n## Uso y registro (solo administradores)\n- Arriba hay tres tarjetas del mes que suman todos los asistentes: respuestas, tokens usados contra el límite y costo estimado.\n- Los avisos sin leer aparecen debajo de las tarjetas.\n- **Registro de actividad** (arriba a la derecha) muestra cada decisión de los asistentes con su motivo."
  },
  {
    "slug": "asistente-notas",
    "title": "Asistente de notas",
    "topics": [
      "asistente de notas",
      "activar notas",
      "notas automáticas",
      "resumen",
      "qué anota",
      "minutos de silencio",
      "pasadas por día"
    ],
    "body": "El **Asistente de notas** nunca escribe al cliente. Lee los mensajes nuevos y deja notas internas útiles (entrega, productos, solicitudes, quejas, datos de contacto) y el **Resumen del cliente**.\n\n## Cómo activarlo\nEn **Agentes**, cambia su **Estado** a **Activo** y pulsa **Configurar**.\n\n## Qué se configura\n- **Nombre:** cómo firma sus notas.\n- **Qué anota:** cinco casillas (Datos de entrega, Productos y medidas de interés, Solicitudes especiales, Quejas o problemas, Otros datos de contacto).\n- **Cuándo anota:** después de unos minutos de silencio del cliente (10, 15 o 30 min, 1 h u otro). También puede anotar al pasar el chat a una persona.\n- **De quién anota:** por clasificación y etiquetas excluidas.\n- **Límite:** pasadas máximas por día.\n- **Avisos:** al llegar al límite del día o acercarse al del mes.\n\nNunca guarda tarjetas, contraseñas ni identificaciones. Si no hay nada relevante (solo saludos), no anota nada.\n\nTambién puedes pedirle al **Asistente del sistema** que anote una conversación en ese momento (ver «Asistente del sistema»)."
  },
  {
    "slug": "asistente-respuestas",
    "title": "Asistente de respuestas",
    "topics": [
      "asistente de respuestas",
      "activar asistente",
      "encender asistente",
      "responder automático",
      "sugerencia del asistente",
      "tono",
      "horario",
      "espera",
      "alcance",
      "límites",
      "respuestas seguidas",
      "pausar asistente",
      "traspaso",
      "transferir a una persona"
    ],
    "body": "El **Asistente de respuestas** contesta a los clientes en WhatsApp.\n\n## Cómo activarlo\n1. Ve a **Agentes**.\n2. En la fila del Asistente de respuestas, cambia **Estado** a **Activo** (solo administradores).\n3. Elige el **Modo**: **Sugerencia** o **Automático**.\n4. Pulsa **Configurar** para ajustar cómo responde y pulsa **Guardar**.\n\n## Qué se configura\n- **Nombre:** cómo aparece en el chat (por defecto «Asistente»).\n- **Tono:** tú o usted, cercano o formal, emojis y largo de las respuestas.\n- **Cuándo responde:** siempre, fuera de horario o en un horario propio, y cuánto espera antes de contestar (Rápido 15 s, Normal 30 s, Pausado 2 min u otra). Si el cliente sigue escribiendo, la espera vuelve a empezar.\n- **A quién le responde:** por clasificación (por defecto Sin clasificar y Prospecto) y etiquetas excluidas.\n- **Límites:** respuestas seguidas (por defecto 5) y tope por día.\n- **Respuestas rápidas que puede usar:** solo las que enciendas. Las marcadas «Solo tu equipo» no se pueden encender.\n- **Avisos:** al pasar un chat a una persona, al llegar al límite del día y al acercarse al del mes.\n\n## En el chat\n- En modo Sugerencia aparece «Sugerencia del asistente» sobre el cuadro de escritura, con **Enviar**, **Editar** y **Descartar**.\n- El interruptor del encabezado del chat pausa o reanuda el asistente en ese chat.\n- El asistente se pausa solo cuando una persona responde, cuando se asigna el chat o cuando llega al límite de respuestas seguidas.\n- Si el cliente pide una persona, o el asistente no sabe la respuesta, **pasa el chat a una persona** y se pausa.\n- Solo responde dentro de la ventana de 24 horas."
  },
  {
    "slug": "asistente-sistema",
    "title": "Asistente del sistema (este asistente)",
    "topics": [
      "asistente del sistema",
      "burbuja",
      "chat temporal",
      "chats guardados",
      "asistente",
      "preguntas por día",
      "pedir tareas",
      "pausar desde el asistente",
      "anotar esta conversación",
      "gráfica"
    ],
    "body": "El **Asistente del sistema** ayuda a tu equipo a usar el CRM y a consultar datos. Nunca escribe a clientes ni cambia datos por sí mismo.\n\n## Dónde está\n- **Burbuja:** el círculo abajo a la derecha abre un chat rápido. Ese chat **no se guarda**: se borra al cerrarlo, recargar la página o cerrar sesión. Puedes guardarlo con un nombre si los chats guardados están activos.\n- **Sección Asistente** del menú: chats guardados con nombre. Son **compartidos** con el equipo; los ve cualquiera con el rol suficiente. Si en un chat se consultaron costos, solo los administradores lo ven.\n\n## Qué puede hacer\n- Explicar cómo se usa el CRM (con este manual).\n- Contar mensajes, contactos y conversaciones; listar respuestas rápidas; buscar contactos; leer y resumir una conversación con sus notas.\n- Mostrar el estado de los asistentes y, a administradores, el consumo y costo del mes, con gráficas.\n- Si tienes un chat abierto, «esta conversación» se refiere a ese chat.\n\n## Pedir tareas a otros asistentes\nPuede pedir que el Asistente de notas anote un chat en ese momento, o pausar y reanudar el Asistente de respuestas en un chat. Siempre muestra una tarjeta con **Confirmar** y **Cancelar**; nada pasa hasta que confirmas. La tarjeta caduca en unos minutos.\n\n## Configuración (administradores)\nEn **Agentes → Asistente del sistema → Configurar**: nombre, quién puede usarlo, burbuja y chats guardados encendidos o apagados, días antes de borrar chats sin actividad, qué tareas puede pedir, preguntas por persona al día y avisos."
  },
  {
    "slug": "bandeja",
    "title": "Bandeja de conversaciones",
    "topics": [
      "bandeja",
      "chat",
      "conversación",
      "mensajes",
      "buscar",
      "filtros",
      "no leídas",
      "mías",
      "sin asignar",
      "asignar",
      "fijar",
      "estado",
      "resolver",
      "archivar",
      "ventana 24 horas",
      "plantilla",
      "adjuntar",
      "archivo",
      "emoji"
    ],
    "body": "La **Bandeja** (primera opción del menú) muestra todas las conversaciones de WhatsApp. Hay una conversación por contacto.\n\n## Buscar y filtrar\n- El buscador encuentra por nombre, teléfono o texto de los mensajes.\n- Arriba de la lista están los filtros rápidos: **Todas**, **No leídas**, **Mías** y **Sin asignar**.\n- En **Filtros** puedes elegir estado, etiquetas (cualquiera de las elegidas), agente asignado y un rango de fechas del último mensaje.\n- Las conversaciones archivadas no aparecen salvo que elijas ese estado.\n\n## Dentro de un chat\n- Escribe en el cuadro de abajo y pulsa **Enter** o el botón de enviar.\n- Con el clip adjuntas archivos (también puedes arrastrarlos o pegarlos). Máximo 50 MB por archivo.\n- Escribe **/** para abrir las respuestas rápidas.\n- En **Más acciones** puedes **Fijar arriba**, **Marcar como no leída**, cambiar el estado (Abierta, Pendiente, Resuelta, Archivada) y **Asignar a** alguien del equipo.\n- El botón de notas cambia la vista a las notas internas del chat (ver «Notas internas»).\n\n## Ventana de 24 horas\nWhatsApp solo deja escribir texto libre durante las 24 horas siguientes al último mensaje del cliente. Si la ventana está cerrada, el chat lo avisa («La ventana de 24 h está cerrada») y bloquea el texto libre: hay que esperar a que el cliente escriba de nuevo o usar una plantilla aprobada por Meta.\n\n## Contactos sin WhatsApp\nUn contacto creado a mano sin número de WhatsApp no puede recibir mensajes desde el CRM."
  },
  {
    "slug": "contactos",
    "title": "Contactos y ficha del cliente",
    "topics": [
      "contactos",
      "ficha",
      "persona",
      "clasificación",
      "prospecto",
      "cliente",
      "proveedor",
      "sin clasificar",
      "inactivo",
      "compras",
      "contador",
      "etiquetas",
      "teléfono duplicado",
      "nuevo contacto"
    ],
    "body": "En **Contactos** ves a las personas y a las empresas juntas.\n\n## La pantalla\n- Tres tarjetas arriba: **Contactos** (personas), **Clientes** (personas y empresas, con cuántos están inactivos) y **Empresas**. Al pulsar una tarjeta se filtra la lista.\n- Hay buscador, pestañas por clasificación, filtros de etiquetas y funciones, y el botón **Nuevo**.\n- Al hacer clic en una fila se abre la ficha en un panel lateral, sin cambiar de pantalla. Si la persona tiene conversación aparece **Abrir chat**.\n\n## Clasificación\nCada contacto es «Sin clasificar», «Prospecto», «Cliente» o «Proveedor». Se cambia en la ficha con el selector; el icono de historial muestra quién la cambió, cuándo y por qué.\n- **Posible prospecto:** si un contacto sin clasificar escribe una palabra de interés (se configuran en Configuración → Contactos y ventas), el chat muestra «Posible prospecto». Tú decides si aceptarlo o descartarlo. El sistema nunca clasifica solo.\n- **Inactivo:** un cliente sin compras en los días configurados (90 por defecto) se marca «Inactivo».\n\n## Compras\nEn la ficha, fila **Compras**: − número +.\n- **+** suma una compra con la fecha de hoy. Si el contacto estaba «Sin clasificar» o «Prospecto», pasa a «Cliente». Aparece «Compra registrada · Deshacer» unos segundos.\n- **−** resta una (nunca baja de 0). También puedes escribir el número directamente.\n- Qué compró no se guarda en el contador: escríbelo como nota interna del chat.\n- El CRM no lleva pedidos, montos, pagos ni facturas.\n\n## Teléfonos repetidos\nDos personas no pueden tener el mismo teléfono: el sistema lo bloquea y ofrece abrir o editar el contacto que ya lo tiene. Si el número es de una empresa, te ofrece vincular a la persona con esa empresa."
  },
  {
    "slug": "empresas",
    "title": "Empresas y vínculos",
    "topics": [
      "empresa",
      "empresas",
      "vincular",
      "desvincular",
      "funciones",
      "propietario",
      "comprador",
      "razón social",
      "rfc",
      "teléfono de oficina"
    ],
    "body": "Las **empresas** viven en Contactos (pestaña o tarjeta **Empresas**). Su ficha se abre en el mismo panel lateral que la de una persona.\n\n- Una persona puede estar vinculada a varias empresas, con una o más **funciones** (por ejemplo Propietario, Comprador autorizado o Responsable de pagos). El catálogo de funciones está en Configuración → Funciones.\n- **Desvincular** desactiva el vínculo y conserva el historial. Borrar un vínculo solo lo puede hacer un administrador.\n- Las empresas también tienen clasificación y contador de compras, con las mismas reglas que las personas.\n- Varias empresas pueden compartir un teléfono de oficina; el sistema avisa «Posible duplicado» y te deja decidir.\n- Si una persona escribe desde el teléfono de una empresa con la que no está vinculada, el chat muestra un aviso para vincularla o descartarlo."
  },
  {
    "slug": "limites-y-avisos",
    "title": "Límites y avisos de los asistentes",
    "topics": [
      "límites",
      "avisos",
      "tope diario",
      "límite del mes",
      "tokens",
      "costo",
      "alerta",
      "detenido",
      "preguntas máximas"
    ],
    "body": "Cada asistente tiene límites para cuidar el costo:\n\n- **Por día:** respuestas del Asistente de respuestas, pasadas del Asistente de notas y preguntas por persona del Asistente del sistema. Al llegar al límite se detiene hasta el día siguiente (hora de Hermosillo).\n- **Por mes:** hay un límite de uso. Si se alcanza, el asistente se detiene hasta el mes siguiente.\n- **Avisos:** en el panel de cada asistente eliges si avisar al llegar al límite del día o al acercarse al del mes. Los avisos aparecen en la página Agentes (solo administradores).\n- Los límites máximos los fija el proveedor del sistema; en el panel solo puedes elegir dentro de ese rango."
  },
  {
    "slug": "notas",
    "title": "Notas internas y resumen del cliente",
    "topics": [
      "notas",
      "nota interna",
      "notas generales",
      "resumen del cliente",
      "editar nota",
      "borrar nota",
      "contadores"
    ],
    "body": "Las **notas internas** son mensajes que solo ve tu equipo, dentro del chat. El cliente nunca las ve.\n\n- Abre las notas con el botón de notas del chat. Cada nota guarda automáticamente su autor, fecha y hora.\n- Puedes editar o borrar tus notas; un administrador puede editar o borrar las de cualquiera.\n- Las notas del **Asistente de notas** llevan un icono de robot y su nombre. Nadie las edita, pero cualquiera las puede borrar.\n- Arriba de las notas está el **Resumen del cliente** (lo mantiene el Asistente de notas). Lo puedes corregir con el lápiz; el asistente respeta lo que escribe una persona.\n- Las **Notas generales** de la ficha del contacto son otra cosa: un solo texto libre que se edita en la ficha."
  },
  {
    "slug": "respuestas-rapidas",
    "title": "Respuestas rápidas",
    "topics": [
      "respuestas rápidas",
      "atajo",
      "plantilla de texto",
      "variables",
      "nombre",
      "primer nombre",
      "insertar",
      "barra"
    ],
    "body": "Las **respuestas rápidas** son textos guardados para no escribir lo mismo cada vez.\n\n- Se administran en Configuración → **Respuestas rápidas**. Crearlas, editarlas y borrarlas es solo para administradores; todos las pueden usar.\n- Cada una tiene un **Atajo** (minúsculas, números, guiones y guion bajo) y un **Texto**.\n- Variables que se reemplazan solas: `{{nombre}}`, `{{primer_nombre}}`, `{{telefono}}` y `{{empresa}}`. El editor muestra una vista previa con un contacto de ejemplo.\n- En el chat, escribe **/** y elige con ↑ ↓ y Enter (Esc cierra el menú).\n- El Asistente de respuestas solo puede usar las que el administrador encienda en su panel (ver «Asistente de respuestas»). Las nuevas nacen apagadas para el asistente."
  },
  {
    "slug": "usuarios-y-roles",
    "title": "Usuarios y roles",
    "topics": [
      "usuarios",
      "roles",
      "administrador",
      "agente",
      "proveedor",
      "permisos",
      "crear usuario",
      "contraseña temporal",
      "eliminar usuario"
    ],
    "body": "Hay tres roles:\n\n- **Agente:** usa la bandeja, contactos, etiquetas (sin borrarlas), sus notas y las respuestas rápidas. Ve la lista de asistentes, pero no los configura.\n- **Administrador:** además administra usuarios, borra etiquetas, crea y edita respuestas rápidas, configura los asistentes y ve uso, costos, avisos y el registro de actividad.\n- **Proveedor:** quien da soporte técnico al sistema. Solo otro proveedor puede asignar o quitar ese rol.\n\n## Administrar usuarios\nEn Configuración → **Usuarios** (solo administradores): **Nuevo usuario** con nombre, correo y contraseña temporal (mínimo 8 caracteres), cambiar rol y eliminar. El sistema nunca deja la cuenta sin administradores."
  }
];
