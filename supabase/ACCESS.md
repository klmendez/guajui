# Personas autorizadas

El acceso administrativo requiere un usuario y una contraseña asignados por el superadministrador. La identidad se valida mediante Supabase Auth. Los perfiles y las comunidades asignadas se verifican en la base de datos en cada operación.

| Función | Superadministrador | Encuestador | Responsable comunitario |
| --- | --- | --- | --- |
| Ámbito | Todas las comunidades | Una comunidad asignada | Una comunidad; una persona activa |
| Autorizar y desactivar personal | Sí | No | No |
| Consultar censo | Completo | Comunidad asignada | Comunidad asignada |
| Registrar viviendas y varias familias | Sí, mediante solicitudes | Sí, mediante solicitudes | Sí, mediante solicitudes |
| Proponer correcciones del censo | Sí | Sí | Sí |
| Aprobar solicitudes y archivar personas | Sí | No | No |
| Consultar estadísticas censales | Todas | Consulta del censo asignado | Su comunidad |
| Crear y cerrar encuestas | Sí | No | No |
| Diligenciar encuestas | Sí | Su comunidad | Su comunidad |
| Resultados de encuestas | Todos | Sus respuestas | Su comunidad |
| Registrar novedades familiares | Sí | No | Su comunidad |
| Verificar novedades y actualizar fallecimientos | Sí | No | No |
| Publicaciones, agenda, proyectos y El Churo | Crea, revisa y publica | No | Propone desde su comunidad |
| Cambiar publicaciones aprobadas | Sí | No | Solicita revisión al superadministrador |
| Crear reuniones y consultar asistentes | Sí | No | No |
| Consultar apuntes, hojas de vida, docentes y junta | Sí | No | No |
| Expedir y revocar certificados | Sí | No | No |
| Administrar contacto, inscripciones, archivos, páginas y grupos | Sí | No | No |
| Consultar auditoría | Sí | No | No |

## Asignar un acceso

En **Administración → Accesos**, el superadministrador crea un usuario y una contraseña, selecciona el perfil y asigna la comunidad si corresponde. Puede registrar un correo para recuperar la contraseña. Cada persona entra con su usuario y contraseña.

El superadministrador puede cambiar la contraseña desde **Editar**. Dejar el campo vacío conserva la contraseña actual. Las cuentas con correo asociado también pueden usar **Olvidé mi contraseña**. No hay registro libre de personal.

Para reemplazar al responsable de una comunidad, desactiva al actual y crea o activa al nuevo. La base impide dos responsables activos en la misma comunidad. Un superadministrador no puede desactivar su propio acceso; sí puede cambiar su contraseña.

El usuario inicial es **admin**. Puede recuperar su contraseña desde **Olvidé mi contraseña** mediante el correo **planetnodesarrolloguapi@gmail.com**, como explica [CONNECT.md](./CONNECT.md). El comando `npm run admin:setup` queda disponible para la instalación técnica inicial o recuperación de emergencia por el responsable del servidor.

Los perfiles anteriores de consejo, censo, comunicaciones, grupos y revisión no forman parte del sistema. Sus referencias históricas se conservan sin concederles acceso.


