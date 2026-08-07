# Lista de verificación de un módulo

Escrita el 2026-08-07 después de la Fase 6. **Vale para las Fases 7–14 y para cualquier reestructuración.**

## Por qué existe

En la Fase 6 di el módulo de Usuarios por funcionando cuando lo único verificado era que compilaba y que el backend respondía. Después de eso salieron **trece arreglos**, cuatro de ellos rompían el módulo entero:

| Lo que fallaba | Por qué no se vio antes |
|---|---|
| 404 en todo el módulo | `VITE_API_URL` ya trae `/api/v1` y las rutas nuevas lo repetían. El login no lo notaba: llama sin prefijo. **Nunca se probó una llamada real.** |
| 500 al abrir la lista | La consulta de conteos recibía seis parámetros y nombraba cinco. El typecheck no ve dentro de una cadena SQL. |
| Recargar echaba al tablero | El guardia de rutas leía los permisos antes de que `/me` los cargara. |
| Los conteos se contradecían | Los tres salían del mismo filtro: al marcar un rol, los demás caían a 0. |
| 403 en la consola en todas las pantallas | Un componente global del sistema viejo seguía consultando Supabase directo. |
| Textos montados unos sobre otros | Nunca se miró la pantalla con datos largos. |
| Botón invisible en modo oscuro | Nunca se abrió la aplicación en oscuro. |
| Modales torcidos en móvil | Nunca se miró en móvil. |

Ninguno era difícil. Todos se habrían encontrado mirando. **El cliente no es el banco de pruebas.**

---

## Antes de decir que un módulo está listo

### 1. Funciona de verdad

- [ ] Cada endpoint probado **por HTTP contra dev**, no solo compilado. Sin token debe dar 401, no 404.
- [ ] Cada consulta SQL nueva **ejecutada contra `PVCAR_Dev` por MCP** antes de subirla. TypeScript no mira dentro de las cadenas: un parámetro de más es un 500 en producción.
- [ ] El recorrido completo del CRUD: crear, ver, editar, dar de baja, reactivar, eliminar. Cada uno con su caso que debe fallar (duplicado, sin permiso, con historial).
- [ ] Recargar la página (F5) en cada ruta del módulo. Debe quedarse donde estaba.
- [ ] La consola del navegador **sin un solo error** al cargar y al operar.
- [ ] La pestaña de red: ninguna llamada a Supabase directa que no sea de sesión.

### 2. Los números cuadran

- [ ] Cada contador dice de dónde sale y **qué filtro ignora a propósito**. Si dos contadores se pisan, se contradicen en pantalla.
- [ ] La suma de las partes contra el total: si no cuadra, hay un caso sin representar (en Usuarios eran los que no tienen ningún rol) — se muestra, no se esconde.
- [ ] Contar siempre en SQL. Nunca `array.filter().length` sobre una página.

### 3. Se ve bien

- [ ] **Modo claro y modo oscuro**, pantalla por pantalla y modal por modal.
- [ ] Nada de `bg-gray-*`, `text-white` ni colores fijos: tokens del tema. La excepción es el rojo de marca, y va por la variante `brand` del botón.
- [ ] **Móvil (360 px), tablet y escritorio.** Modales incluidos.
- [ ] Datos largos: un correo de 45 caracteres, un nombre de 60. Nada se monta ni empuja columnas — `min-w-0` + `truncate` en tablas, `break-words` en fichas.
- [ ] Los contadores dentro de botones seleccionados se leen en los dos temas.

### 4. El código queda limpio

- [ ] Borrado lo que el módulo nuevo dejó sin usar: hooks, componentes, envoltorios de una línea. Buscarlos, no suponerlos.
- [ ] Ningún componente que solo pase props a otro sin decidir nada.
- [ ] Nada duplicado: dos copias del mismo markup (móvil y escritorio) acaban divergiendo — en Usuarios, la de móvil se había quedado sin los números.
- [ ] Cero `any` en la capa de datos. Los tipos los define el backend.
- [ ] Los números mágicos, por constante con nombre (`ROL.ENTRENADOR`, no `3`).
- [ ] `typecheck`, `lint`, `test` y `build` en los dos workspaces.

### 5. Solo entonces

- [ ] Se le pide al cliente que pruebe, **con la lista de lo que ya está verificado** y de lo que no.

---

## Trampas ya pagadas, no repetirlas

- **`VITE_API_URL` incluye `/api/v1`.** Las rutas del cliente van sin él. `apiFetch` lo quita si se cuela, pero no hay que escribirlo.
- **Railway solo despliega si el commit toca sus rutas vigiladas.** Un cambio de frontend no lo mueve, y eso *no* es un fallo.
- **Vercel salta el build si el commit no toca `frontend/**`.**
- **Los modales se centran con `translate`**: un `mx-4` no los encoge, los desplaza. El ancho debe descontar el margen.
- **La variante `default` del botón trae `dark:bg-primary`**, que en oscuro es casi blanco. Pintar el fondo por `className` no la desactiva: tailwind-merge no cruza modificadores.
- **`DebouncedSearchInput` ya debounce.** Envolverlo en `useDebounce` duplica la espera.
- **Componentes globales del sistema viejo** (montados en `App.tsx`) consultan Supabase en todas las pantallas. Al empezar un módulo, comprobar qué se monta fuera de la ruta.
