# Ingreso con usuario y contraseña

Proyecto: `iibbavjuqescenbwonfp`.

## Recuperar contraseña desde la página

1. Abre `/admin` y pulsa **Olvidé mi contraseña**.
2. Escribe tu usuario o el correo asociado a tu cuenta. Para el superadministrador inicial, el usuario es **admin** y el correo es **planetnodesarrolloguapi@gmail.com**.
3. Pulsa **Enviar enlace de recuperación** y revisa el correo, incluida la carpeta de spam.
4. Abre el enlace. El sitio muestra **Crear nueva contraseña** antes de abrir el panel.
5. Escribe y repite una contraseña de entre 10 y 128 caracteres. Después de guardarla, vuelve a entrar con tu usuario y la nueva contraseña.

Recuperar una contraseña no requiere comandos ni claves de Supabase. El servidor debe tener su configuración de acceso instalada. Las respuestas no revelan si una cuenta existe y las solicitudes tienen un límite para evitar envíos repetidos. Solo se solicitan correos para accesos activos de los tres perfiles; no se crean cuentas ni se cambian sus permisos.

Los usuarios sin un correo asociado pueden pedir al superadministrador que cambie su contraseña desde **Accesos**. Al crear usuarios nuevos se puede registrar un correo para habilitar la recuperación.

### Configuración del envío y los enlaces

En Supabase → Authentication → URL Configuration, autoriza las direcciones de retorno de cada entorno, incluyendo `http://127.0.0.1:5173/admin?recuperar=1` durante desarrollo y la dirección HTTPS del sitio publicado. El retorno local del proyecto fue verificado sin enviar correos.

El servicio de correo incluido con Supabase solo entrega a integrantes autorizados del proyecto y tiene límites reducidos. Para que los encuestadores y responsables comunitarios reciban correos en sus propias direcciones, configura un proveedor SMTP en Authentication. Consulta la [documentación oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Instalación técnica del servidor, una sola vez

1. Instala las migraciones pendientes:

   ```powershell
   npm run db:apply
   ```

   Usa la cadena de **Connect → Session pooler** y la contraseña de base de datos, como en las instalaciones anteriores.

2. Configura el usuario inicial:

   ```powershell
   npm run admin:setup
   ```

   El programa pide la **Secret key** de **Supabase → Settings → API Keys → Secret keys**. Comienza por `sb_secret_`. Se introduce oculta y se guarda únicamente en `.env.server.local`, excluido del repositorio. Después pide que definas y repitas la contraseña del usuario `admin`.

   La contraseña debe tener entre 10 y 128 caracteres. Se muestran asteriscos al escribir o pegarla. Pulsa Enter al terminar cada entrada. Si es demasiado corta, demasiado larga o no coincide al repetirla, el programa permite corregirla sin volver a pedir la Secret key.

   La Secret key, la contraseña de base de datos y la contraseña del usuario admin son datos diferentes. No los pegues en el chat.

3. Arranca o reinicia el sitio:

   ```powershell
   npm run dev
   ```

4. Abre `http://127.0.0.1:5173/admin`. Escribe **admin** y la contraseña que acabas de definir.

El ingreso diario consiste únicamente en usuario y contraseña. No requiere correos de acceso. Ejecutar de nuevo `npm run admin:setup` restablece la contraseña del superadministrador inicial con acceso de servidor.

## Personal

En **Accesos**, el superadministrador crea el usuario, define la contraseña y asigna uno de los tres perfiles. El encuestador y el responsable comunitario requieren una comunidad asignada.

El correo de recuperación es opcional al crear la cuenta. Si se registra, se usa como identidad de Supabase Auth, conservando el nombre de usuario para el inicio de sesión. No se vincula automáticamente una dirección que ya pertenezca a otra cuenta. Las cuentas anteriores sin correo conservan el cambio de contraseña por el superadministrador.

La edición de un usuario permite cambiar su perfil, comunidad o contraseña. El campo de contraseña vacío conserva la actual. La lista permite activar y desactivar cuentas. El superadministrador puede cambiar su propia contraseña; su propio perfil debe administrarlo otro superadministrador.

Los usuarios y contraseñas locales antiguos no se cargan ni se importan. Las cuentas nuevas se crean en Supabase Auth desde el servidor mediante `auth.admin.createUser`; las contraseñas no se guardan en las tablas públicas ni en la configuración del proyecto.

## Servidor y publicación

`vite.config.js` atiende las rutas `/api/platform` durante desarrollo y vista previa. Para servir la versión compilada con el servicio de usuarios:

```powershell
npm run build
npm start
```

En el alojamiento configura `SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` como variables del servidor. La última nunca debe tener prefijo `VITE_` ni incluirse en el código del navegador. Si se necesita escuchar fuera del equipo, configura `HOST=0.0.0.0` y `PORT`; publica mediante HTTPS.

Este ingreso requiere el servidor Node o un servicio equivalente: subir únicamente la carpeta dist a un alojamiento estático no incluye las rutas de autenticación.

## Datos y permisos

Los módulos usan Supabase y conservan las restricciones de los tres perfiles. La sesión se mantiene mediante Supabase Auth. Las personas de la página pública no obtienen acceso administrativo al enviar un formulario.

Consulta [ACCESS.md](./ACCESS.md) para funciones y [DATABASE.md](./DATABASE.md) para las tablas. Los registros anteriores del navegador siguen fuera de la base de datos.

## Pruebas

- `npm run test:database`: tablas, roles, usuarios únicos y funciones de configuración reservadas al servicio.
- `npm run test:auth`: ingreso, creación, cambio de contraseña, desactivación y límites de intentos.
- `npm run test:frontend`: contratos y renderizado de rutas.
- `npm run test:ui`: navegador con Supabase y servicio de usuarios simulados; requiere Vite en 5173.
- `node tests/server-smoke.mjs`: servidor de producción y archivos compilados.
- `npm run build`: compilación.

Referencias de implementación: [Auth con contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) y [creación de usuarios desde el servidor](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
