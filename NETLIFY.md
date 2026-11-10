# Publicar en Netlify con Supabase

El sitio usa Supabase para los datos, usuarios y archivos. Netlify publica `dist` y ejecuta `/api/platform/*` mediante la función `platform`. `netlify.toml` configura la compilación y las rutas, incluido `/admin`.

1. Sube el proyecto a un repositorio de GitHub y conéctalo en Netlify mediante **Import an existing project**. También puedes desplegar con Netlify CLI desde el proyecto completo. Arrastrar solamente `dist` no instala la función de acceso.
2. En Netlify, configura estas variables antes de compilar:

   | Variable | Valor | Uso |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | Compilación |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública del mismo proyecto | Compilación y funciones |
   | `SUPABASE_URL` | La misma URL de Supabase | Funciones |
   | `SUPABASE_SECRET_KEY` | Clave secreta del mismo proyecto | Solo funciones |

   Si tu plan no permite elegir ámbitos, configura las variables para el despliegue de producción. Nunca pongas la clave secreta en una variable con prefijo `VITE_`, en Git ni dentro de `dist`. Los archivos `.env.local` y `.env.server.local` están excluidos del repositorio y debes configurar sus valores en Netlify.
3. Confirma que las migraciones de `supabase/migrations` estén aplicadas al proyecto. Si faltan, revisa `supabase/CONNECT.md` y ejecuta `npm run db:apply` desde tu equipo con las credenciales de conexión. Publicar el sitio no instala la base de datos. Si aún no existe el administrador, ejecuta `npm run admin:setup` desde tu equipo.
4. En Supabase, **Authentication → URL Configuration**, establece el dominio HTTPS definitivo como **Site URL** y agrega `https://TU-SITIO.netlify.app/admin?recuperar=1` a **Redirect URLs**. Usa tu dominio propio si lo tienes. Configura SMTP para entregar recuperación a los correos de tus usuarios.
5. Despliega. Después de cambiar variables vuelve a desplegar para incorporarlas.
6. Comprueba en la URL publicada: abrir y recargar `/admin`, entrar con usuario y contraseña, consultar registros, crear un registro de prueba y verificarlo en Supabase, subir un archivo y solicitar recuperación para una cuenta con correo. Elimina después los datos de prueba.

Las pruebas locales usan servicios simulados y no certifican las credenciales, migraciones, políticas ni entrega de correo del proyecto remoto. Esa validación se completa con el sitio publicado.

El límite de intentos del servicio se guarda en memoria por instancia; Netlify puede ejecutar varias instancias o reiniciarlas. No constituye un límite global persistente. Para limitar intentos de forma global se requiere almacenamiento compartido o una regla en el borde.
