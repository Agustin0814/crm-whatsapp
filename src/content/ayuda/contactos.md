---
titulo: Contactos y ficha del cliente
temas: contactos, ficha, persona, clasificación, prospecto, cliente, proveedor, sin clasificar, inactivo, compras, contador, etiquetas, teléfono duplicado, nuevo contacto, entrega, dirección de entrega, referencias, ubicación, mapa, origen, anuncio, importar, exportar, csv, excel, plantilla
---
En **Contactos** ves a las personas y a las empresas juntas.

## La pantalla
- Tres tarjetas arriba: **Contactos** (personas), **Clientes** (personas y empresas, con cuántos están inactivos) y **Empresas**. Al pulsar una tarjeta se filtra la lista.
- Hay buscador, pestañas por clasificación, filtros de etiquetas, funciones y **origen**, y el botón **Nuevo**.
- Columnas: nombre, teléfono, clasificación, compras (con la última compra), etiquetas y **Escribió** (la última vez que el cliente te escribió por WhatsApp; «Nunca» si no ha escrito).
- El repartidor no tiene esta pantalla: solo ve los datos del cliente dentro de sus chats en Reparto.
- Al hacer clic en una fila se abre la ficha en un panel lateral, sin cambiar de pantalla. Si la persona tiene conversación aparece **Abrir chat**.

## Clasificación
Cada contacto es «Sin clasificar», «Prospecto», «Cliente» o «Proveedor». Se cambia en la ficha con el selector; el icono de historial muestra quién la cambió, cuándo y por qué.
- **Posible prospecto:** si un contacto sin clasificar escribe una palabra de interés (se configuran en Configuración → Contactos y ventas), el chat muestra «Posible prospecto». Tú decides si aceptarlo o descartarlo. El sistema nunca clasifica solo.
- **Inactivo:** un cliente sin compras en los días configurados (90 por defecto) se marca «Inactivo».

## Compras
En la ficha, fila **Compras**: − número +.
- **+** suma una compra con la fecha de hoy. Si el contacto estaba «Sin clasificar» o «Prospecto», pasa a «Cliente». Aparece «Compra registrada · Deshacer» unos segundos.
- **−** resta una (nunca baja de 0). También puedes escribir el número directamente.
- Qué compró no se guarda en el contador: escríbelo como nota interna del chat.
- El CRM no lleva pedidos, montos, pagos ni facturas.

## Teléfonos repetidos
Dos personas no pueden tener el mismo teléfono: el sistema lo bloquea y ofrece abrir o editar el contacto que ya lo tiene. Si el número es de una empresa, te ofrece vincular a la persona con esa empresa.

## Entrega y origen
En la ficha, sección **Entrega** (vendedores y administradores la editan; el repartidor solo la ve):
- **Dirección de entrega** y **Referencias** (por ejemplo «portón verde»).
- **Ubicación**: si el cliente manda su ubicación por WhatsApp, en el chat aparece una tarjeta con **Abrir en Maps** y **Usar como ubicación de entrega**, que la guarda en la ficha (y llena la dirección solo si estaba vacía). También puedes escribirla como «latitud, longitud». **Abrir en Maps** usa la ubicación o, si no hay, la dirección escrita.
- **Origen del contacto**: Anuncio, Recomendación, Redes sociales, Llamada, Visita u Otro. Si el cliente llegó desde un anuncio de WhatsApp, se marca «Anuncio» solo (si el origen estaba vacío).
- **Sugerido por Notas**: si el Asistente de notas detecta una dirección en el chat y la ficha no tiene una, la propone. **Usar** la guarda (nunca reemplaza una dirección que ya escribiste) y **Descartar** la quita.
- Si el cliente comparte un contacto por WhatsApp, el chat muestra una tarjeta con su nombre y teléfono y el botón **Crear contacto** si aún no existe.

## Importar y exportar (solo administradores)
- **Exportar** descarga un archivo CSV que Excel abre con acentos correctos: nombre, teléfono, clasificación, etiquetas, dirección, referencias, origen, última compra y fecha de alta. Queda registrado quién exportó y cuándo.
- **Importar** acepta CSV o Excel (.xlsx) de hasta 2,000 filas y 2 MB, con la primera fila de encabezados. Pasos: elegir archivo → revisar qué columna va en cada campo → vista previa (nada se guarda todavía) → importar → resumen con lo creado, actualizado, omitido y los errores por fila.
- Hay una **plantilla de ejemplo** para descargar. Los teléfonos de México se aceptan con o sin +52 / 521; un número de otro país con lada se acepta con aviso; uno incompleto es error.
- Si un teléfono ya existe, eliges **Omitirlos** o **Completar solo sus campos vacíos** (nunca cambia la clasificación ni lo que ya estaba escrito). Las etiquetas deben existir.
- Los importados no tienen WhatsApp hasta que escriben; entonces se vinculan solos por el teléfono.
