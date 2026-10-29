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
      "detenido por el superadmin"
    ],
    "body": "En **Agentes** están los asistentes de IA del CRM: el **Asistente de respuestas**, el **Asistente de notas** y el **Asistente del sistema**.\n\n## Encender o apagar\nEn la lista, el control **Estado** cambia entre **Activo** e **Inactivo**. Solo un administrador puede cambiarlo. Si dice «Detenido por el superadmin», el superadmin lo pausó y no se puede encender desde aquí.\n\n## Modo (solo el Asistente de respuestas)\n- **Sugerencia** (por defecto): el asistente prepara la respuesta y una persona la envía, la edita o la descarta.\n- **Automático**: envía la respuesta directo.\n\nEl de notas dice «Solo notas internas» y el del sistema no tiene modo.\n\n## Configurar\nEl botón **Configurar** abre un panel lateral con las opciones de cada asistente, en secciones. Cada pestaña se guarda con su botón **Guardar**; si cierras con cambios pendientes, el panel te avisa.\n\n## Uso y registro (solo administradores)\n- Arriba hay tres tarjetas del mes que suman todos los asistentes: respuestas, tokens usados contra el límite y costo estimado.\n- Los avisos sin leer aparecen debajo de las tarjetas.\n- **Registro de actividad** (arriba a la derecha) muestra cada decisión de los asistentes con su motivo."
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
    "body": "El **Asistente de respuestas** contesta a los clientes en WhatsApp.\n\n## Cómo activarlo\n1. Ve a **Agentes**.\n2. En la fila del Asistente de respuestas, cambia **Estado** a **Activo** (solo administradores).\n3. Elige el **Modo**: **Sugerencia** o **Automático**.\n4. Pulsa **Configurar** para ajustar cómo responde y pulsa **Guardar**.\n\n## Qué se configura\n- **Nombre:** cómo aparece en el chat (por defecto «Asistente»).\n- **Tono:** tú o usted, cercano o formal, emojis y largo de las respuestas.\n- **Cuándo responde:** siempre, fuera de horario o en un horario propio, y cuánto espera antes de contestar (Rápido 15 s, Normal 30 s, Pausado 2 min u otra). Si el cliente sigue escribiendo, la espera vuelve a empezar.\n- **A quién le responde:** por clasificación (por defecto Sin clasificar y Prospecto) y etiquetas excluidas.\n- **Límites:** respuestas seguidas (por defecto 5) y tope por día.\n- **Respuestas rápidas que puede usar:** solo las que enciendas. Las marcadas «Solo tu equipo» no se pueden encender.\n- **Avisos:** al pasar un chat a una persona, al llegar al límite del día y al acercarse al del mes.\n\n## En el chat\n- En modo Sugerencia aparece «Sugerencia del asistente» sobre el cuadro de escritura, con **Enviar**, **Editar** y **Descartar**.\n- El interruptor del encabezado del chat pausa o reanuda el asistente en ese chat.\n- El asistente se pausa solo cuando una persona responde, cuando se asigna el chat, cuando llega al límite de respuestas seguidas o cuando el chat pasa a **Reparto** («En reparto»). Al **Marcar entregado** se reanuda; si el chat se **Devuelve a Ventas**, sigue pausado.\n- Si el cliente pide una persona, o el asistente no sabe la respuesta, **pasa el chat a una persona**, se pausa y el chat entra a la etapa **Ventas** (los vendedores reciben un aviso).\n- Solo responde dentro de la ventana de 24 horas."
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
      "emoji",
      "etapas",
      "ventas",
      "reparto",
      "tomar",
      "pasar a reparto",
      "entregado",
      "devolver a ventas",
      "repartidor",
      "llamar",
      "avisos"
    ],
    "body": "La **Bandeja** (primera opción del menú) muestra las conversaciones de WhatsApp. Hay una conversación por contacto.\n\n## Etapas: Sin asignar, Ventas y Reparto\nCada chat está en una etapa. Arriba de la lista hay pestañas con el número de chats de cada una: **Sin asignar**, **Ventas**, **Reparto** y **Todos**. Bajo el encabezado del chat se ve su etapa y los botones que te corresponden:\n\n- **Tomar** (chat sin asignar; vendedores y administradores): te lo asigna y pasa a Ventas. Asignar a alguien un chat sin asignar también lo pasa a Ventas.\n- **Pasar a Reparto** (vendedores y administradores): muestra el resumen del cliente y las últimas notas para que revises dirección y cantidad. Puedes elegir un repartidor; si no eliges, lo ven todos los repartidores. El Asistente de respuestas se pausa en ese chat mientras está en reparto.\n- **Marcar entregado** (todos): el chat vuelve a Sin asignar, se quita la asignación y el Asistente de respuestas se reanuda.\n- **Devolver a Ventas** (todos), con un motivo opcional: el asistente sigue pausado.\n- Si el Asistente de respuestas pasa el chat a una persona, el chat entra a Ventas.\n\nCada cambio queda como una línea discreta en el chat, por ejemplo «Pasó a Reparto por Ana · 10:42». Solo la ve el equipo.\n\n## Avisos\nCon el sonido de siempre y un aviso en pantalla (con **Abrir**): los vendedores, cuando un chat entra a Ventas; los repartidores, cuando entra uno a Reparto. Nunca te avisa de lo que hiciste tú.\n\n## Bandeja del repartidor\nEl repartidor ve una sola lista con sus chats en Reparto, primero los que llevan más tiempo esperando. En el chat tiene el botón **Llamar** con el teléfono del cliente; si la ventana de 24 horas está cerrada, el teléfono se muestra destacado. La ficha del contacto es de solo lectura y muestra la dirección de entrega, las referencias y **Abrir en Maps**.\n\nAl **Pasar a Reparto**, la ventana de confirmación muestra también la dirección y las referencias de la ficha.\n\n## Buscar y filtrar\n- El buscador encuentra por nombre, teléfono o texto de los mensajes.\n- Filtros rápidos: **Todas**, **No leídas**, **Mías** y **Sin asignar** (sin persona asignada).\n- En **Filtros** puedes elegir estado, etiquetas (cualquiera de las elegidas), persona asignada y un rango de fechas del último mensaje.\n- Las conversaciones archivadas no aparecen salvo que elijas ese estado.\n\n## Dentro de un chat\n- Escribe en el cuadro de abajo y pulsa **Enter** o el botón de enviar.\n- Con el clip adjuntas archivos (también puedes arrastrarlos o pegarlos). Máximo 50 MB por archivo.\n- Escribe **/** para abrir las respuestas rápidas (solo aparecen las de tu rol).\n- En **Más acciones** puedes **Fijar arriba**, **Marcar como no leída**, cambiar el estado (Abierta, Pendiente, Resuelta, Archivada) y **Asignar a** alguien del equipo. El repartidor no tiene este menú.\n- El botón de notas cambia la vista a las notas internas del chat (ver «Notas internas»).\n- Si el cliente manda su **ubicación**, se ve como tarjeta con **Abrir en Maps** y, para vendedores y administradores, **Usar como ubicación de entrega**. Un **contacto compartido** se ve con su nombre, teléfono y **Crear contacto** (ver «Contactos y ficha del cliente»).\n- Si abres un enlace a un chat que no te corresponde, verás «No tienes acceso a este chat».\n\n## Ventana de 24 horas\nWhatsApp solo deja escribir texto libre durante las 24 horas siguientes al último mensaje del cliente. Si la ventana está cerrada, el chat lo avisa («La ventana de 24 h está cerrada») y bloquea el texto libre para todos los roles: hay que esperar a que el cliente escriba de nuevo o llamarle.\n\n## Contactos sin WhatsApp\nUn contacto creado a mano sin número de WhatsApp no puede recibir mensajes desde el CRM."
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
      "nuevo contacto",
      "entrega",
      "dirección de entrega",
      "referencias",
      "ubicación",
      "mapa",
      "origen",
      "anuncio",
      "importar",
      "exportar",
      "csv",
      "excel",
      "plantilla"
    ],
    "body": "En **Contactos** ves a las personas y a las empresas juntas.\n\n## La pantalla\n- Tres tarjetas arriba: **Contactos** (personas), **Clientes** (personas y empresas, con cuántos están inactivos) y **Empresas**. Al pulsar una tarjeta se filtra la lista.\n- Hay buscador, pestañas por clasificación, filtros de etiquetas, funciones y **origen**, y el botón **Nuevo**.\n- Columnas: nombre, teléfono, clasificación, compras (con la última compra), etiquetas y **Escribió** (la última vez que el cliente te escribió por WhatsApp; «Nunca» si no ha escrito).\n- El repartidor no tiene esta pantalla: solo ve los datos del cliente dentro de sus chats en Reparto.\n- Al hacer clic en una fila se abre la ficha en un panel lateral, sin cambiar de pantalla. Si la persona tiene conversación aparece **Abrir chat**.\n\n## Clasificación\nCada contacto es «Sin clasificar», «Prospecto», «Cliente» o «Proveedor». Se cambia en la ficha con el selector; el icono de historial muestra quién la cambió, cuándo y por qué.\n- **Posible prospecto:** si un contacto sin clasificar escribe una palabra de interés (se configuran en Configuración → Contactos y ventas), el chat muestra «Posible prospecto». Tú decides si aceptarlo o descartarlo. El sistema nunca clasifica solo.\n- **Inactivo:** un cliente sin compras en los días configurados (90 por defecto) se marca «Inactivo».\n\n## Compras\nEn la ficha, fila **Compras**: − número +.\n- **+** suma una compra con la fecha de hoy. Si el contacto estaba «Sin clasificar» o «Prospecto», pasa a «Cliente». Aparece «Compra registrada · Deshacer» unos segundos.\n- **−** resta una (nunca baja de 0). También puedes escribir el número directamente.\n- Qué compró no se guarda en el contador: escríbelo como nota interna del chat.\n- El CRM no lleva pedidos, montos, pagos ni facturas.\n\n## Teléfonos repetidos\nDos personas no pueden tener el mismo teléfono: el sistema lo bloquea y ofrece abrir o editar el contacto que ya lo tiene. Si el número es de una empresa, te ofrece vincular a la persona con esa empresa.\n\n## Entrega y origen\nEn la ficha, sección **Entrega** (vendedores y administradores la editan; el repartidor solo la ve):\n- **Dirección de entrega** y **Referencias** (por ejemplo «portón verde»).\n- **Ubicación**: si el cliente manda su ubicación por WhatsApp, en el chat aparece una tarjeta con **Abrir en Maps** y **Usar como ubicación de entrega**, que la guarda en la ficha (y llena la dirección solo si estaba vacía). También puedes escribirla como «latitud, longitud». **Abrir en Maps** usa la ubicación o, si no hay, la dirección escrita.\n- **Origen del contacto**: Anuncio, Recomendación, Redes sociales, Llamada, Visita u Otro. Si el cliente llegó desde un anuncio de WhatsApp, se marca «Anuncio» solo (si el origen estaba vacío).\n- **Sugerido por Notas**: si el Asistente de notas detecta una dirección en el chat y la ficha no tiene una, la propone. **Usar** la guarda (nunca reemplaza una dirección que ya escribiste) y **Descartar** la quita.\n- Si el cliente comparte un contacto por WhatsApp, el chat muestra una tarjeta con su nombre y teléfono y el botón **Crear contacto** si aún no existe.\n\n## Importar y exportar (solo administradores)\n- **Exportar** descarga un archivo CSV que Excel abre con acentos correctos: nombre, teléfono, clasificación, etiquetas, dirección, referencias, origen, última compra y fecha de alta. Queda registrado quién exportó y cuándo.\n- **Importar** acepta CSV o Excel (.xlsx) de hasta 2,000 filas y 2 MB, con la primera fila de encabezados. Pasos: elegir archivo → revisar qué columna va en cada campo → vista previa (nada se guarda todavía) → importar → resumen con lo creado, actualizado, omitido y los errores por fila.\n- Hay una **plantilla de ejemplo** para descargar. Los teléfonos de México se aceptan con o sin +52 / 521; un número de otro país con lada se acepta con aviso; uno incompleto es error.\n- Si un teléfono ya existe, eliges **Omitirlos** o **Completar solo sus campos vacíos** (nunca cambia la clasificación ni lo que ya estaba escrito). Las etiquetas deben existir.\n- Los importados no tienen WhatsApp hasta que escriben; entonces se vinculan solos por el teléfono."
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
    "body": "Cada asistente tiene límites para cuidar el costo:\n\n- **Por día:** respuestas del Asistente de respuestas, pasadas del Asistente de notas y preguntas por persona del Asistente del sistema. Al llegar al límite se detiene hasta el día siguiente (hora de Hermosillo).\n- **Por mes:** hay un límite de uso. Si se alcanza, el asistente se detiene hasta el mes siguiente.\n- **Avisos:** en el panel de cada asistente eliges si avisar al llegar al límite del día o al acercarse al del mes. Los avisos aparecen en la página Agentes (solo administradores).\n- Los límites máximos los fija el superadmin del sistema; en el panel solo puedes elegir dentro de ese rango."
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
      "barra",
      "visible para",
      "vendedores",
      "repartidores"
    ],
    "body": "Las **respuestas rápidas** son textos guardados para no escribir lo mismo cada vez.\n\n- Se administran en Configuración → **Respuestas rápidas**. Crearlas, editarlas y borrarlas es solo para administradores.\n- Cada una tiene un **Atajo** (minúsculas, números, guiones y guion bajo), un **Texto** y **Visible para** (casillas **Vendedores** y **Repartidores**; al menos una). Las que ya existían quedaron visibles para ambos.\n- En el menú **/** del chat cada persona solo ve las de su rol; los administradores las ven todas. Al enviar, el sistema vuelve a comprobarlo.\n- Variables que se reemplazan solas: `{{nombre}}`, `{{primer_nombre}}`, `{{telefono}}` y `{{empresa}}`. El editor muestra una vista previa con un contacto de ejemplo.\n- En el chat, escribe **/** y elige con ↑ ↓ y Enter (Esc cierra el menú).\n- El Asistente de respuestas solo puede usar las que el administrador encienda en su panel (ver «Asistente de respuestas»). Las nuevas nacen apagadas para el asistente."
  },
  {
    "slug": "usuarios-y-roles",
    "title": "Usuarios y roles",
    "topics": [
      "usuarios",
      "roles",
      "vendedor",
      "repartidor",
      "administrador",
      "superadmin",
      "permisos",
      "invitar usuario",
      "invitación",
      "desactivar",
      "reactivar",
      "puesto",
      "mi perfil",
      "avatar",
      "contraseña",
      "olvidé mi contraseña",
      "recuperar contraseña",
      "código",
      "código de 6 dígitos",
      "activar cuenta"
    ],
    "body": "Hay cuatro roles:\n\n- **Vendedor:** ve todos los chats y contactos, toma chats, los pasa a Reparto, escribe notas y usa las respuestas rápidas para vendedores. Si el administrador lo permite, también usa el Asistente.\n- **Repartidor:** solo ve los chats que están en **Reparto** (y, si un vendedor eligió a un repartidor en concreto, solo ese repartidor). Ve el historial, las notas, el resumen del cliente y su teléfono. Puede marcar **Entregado** o **Devolver a Ventas**. No ve la lista de contactos, ni agentes, ni estadísticas, ni usuarios.\n- **Administrador:** todo lo anterior y además usuarios, agentes, estadísticas y la configuración general (etiquetas, respuestas rápidas, funciones, contactos y ventas).\n- **Superadmin:** quien da soporte técnico al sistema. No aparece en la lista de usuarios.\n\n## Administrar usuarios\nEn Configuración → **Usuarios** (solo administradores):\n\n- **Invitar usuario:** escribe el correo, el nombre, el rol y, si quieres, el puesto (solo informativo). Le llega un correo con un **código de 6 dígitos** y la dirección de la página **Activa tu cuenta**. Ahí escribe su correo y el código y crea su contraseña. Si no le llegó o venció (dura unos 15 minutos), en el menú **…** de su fila está **Reenviar invitación**.\n- **Cambiar rol:** con el selector de su fila (Vendedor, Repartidor o Administrador).\n- **Cambiar puesto:** en el menú **…** de su fila.\n- **Desactivar / Reactivar:** en el menú **…**. Al desactivar se cierra su sesión en todos sus dispositivos y ya no puede entrar; sus mensajes, notas e historial se conservan. Nunca se borran usuarios.\n- No puedes desactivarte ni quitarte el rol a ti mismo, y el sistema nunca se queda sin al menos un administrador activo.\n\n## Mi perfil\nEn el menú de tu usuario (abajo en la barra lateral) → **Mi perfil**: cambia tu nombre, el color o el emoji de tu avatar y tu contraseña (mínimo 8 caracteres, con al menos una letra y un número). El rol y el puesto los cambia un administrador.\n\n## Olvidé mi contraseña\nEn la pantalla de inicio de sesión, pulsa **¿La olvidaste?**:\n\n1. Escribe tu correo y pulsa **Enviar código**. Siempre verás el mismo mensaje, exista o no la cuenta.\n2. Escribe (o pega) el **código de 6 dígitos** que te llegó por correo. Vence en unos 15 minutos. Si no llegó, revisa el spam o pulsa **Reenviar código** (se puede cada 60 segundos).\n3. Escribe tu contraseña nueva dos veces (el ojo la muestra u oculta) y pulsa **Guardar**. Entras directo y se cierran tus sesiones en otros dispositivos.\n\nSi te equivocas de código 5 veces, tienes que esperar 15 minutos. Los correos ya no traen enlaces: si abres un enlace de un correo anterior, la página te pide un código nuevo. Una cuenta desactivada no puede recuperar la contraseña ni activarse."
  }
];
