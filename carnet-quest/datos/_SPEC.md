# SPEC de generación de preguntas — CARNET QUEST (DGT, permiso B)

Eres el **profesor de autoescuela (30 años)** + el **especialista en normativa DGT** + el **copywriter**.
Generas preguntas tipo test ORIGINALES (nunca copiadas de tests oficiales) con el estilo real de la DGT.

## Formato de salida (OBLIGATORIO)

Escribe UN archivo JSON en la ruta exacta que se te indique. Estructura:

```json
{
  "tema": 5,
  "nombre": "Velocidad",
  "preguntas": [
    {
      "id": "VEL-001",
      "tema": 5,
      "subtema": "limites-genericos",
      "dificultad": 2,
      "esTrampa": true,
      "pregunta": "Enunciado con el matiz típico DGT…",
      "opciones": ["Opción A", "Opción B", "Opción C"],
      "correcta": 0,
      "explicacion": "2–3 líneas en lenguaje llano explicando el PORQUÉ.",
      "mnemotecnia": "Regla memorable o cadena vacía \"\"",
      "imagen": ""
    }
  ]
}
```

### Reglas de los campos
- `id`: prefijo de 3 letras del tema + número correlativo de 3 cifras (ej. `VEL-001`). Usa el prefijo que se te indique.
- `tema`: número del mundo (1–15).
- `subtema`: slug corto en kebab-case.
- `dificultad`: 1 (fácil), 2 (media), 3 (difícil/trampa fina). Reparte: ~30% nivel 1, ~45% nivel 2, ~25% nivel 3.
- `esTrampa`: `true` si el enunciado usa una trampa DGT (matices "salvo…", "excepto…", "como norma general…", dobles negaciones, cifras muy parecidas). **Mínimo 20% de las preguntas con `esTrampa:true`.**
- `opciones`: EXACTAMENTE 3, todas plausibles. Nada de "todas son correctas" salvo que sea realista.
- `correcta`: índice 0, 1 o 2. **Reparte el índice correcto de forma equilibrada** entre 0/1/2 (no siempre 0).
- `explicacion`: 2–3 líneas, tono cercano, explica el porqué. Que lo entienda un chaval de 12 años.
- `mnemotecnia`: regla memorable cuando ayude; si no, `""`.
- `imagen`: `""` salvo que uses una señal del catálogo de abajo (usa la clave EXACTA).

### Cantidad
- **40 preguntas** por archivo (mínimo 40).
- Español. Estilo DGT real: "Como norma general…", "Salvo señalización en sentido contrario…", "¿Está permitido…?".

## Catálogo de señales (claves válidas para `imagen`)
Usa SOLO estas claves (o `""`):
`r1-ceda`, `r2-stop`, `r101-entrada-prohibida`, `r301-30`, `r301-50`, `r301-90`, `r301-120`,
`r305-adelantamiento`, `r307-parada`, `r308-estacionamiento`, `r402-glorieta`, `r400-sentido`,
`p13-curva`, `p20-peatones`, `p21-ninos`, `p50-otros`, `p1-interseccion`, `s13-paso-peatones`, `s1-autopista`, `semaforo`

## DATOS NORMATIVOS VERIFICADOS (usar como fuente de verdad — vigentes 2024/2025)

### Velocidades genéricas (turismo, permiso B)
- Vía urbana: **20 km/h** en calles de plataforma única (calzada y acera al mismo nivel); **30 km/h** en vías de un único carril por sentido; **50 km/h** en vías de dos o más carriles por sentido.
- Travesía: **50 km/h** general.
- Carretera convencional (fuera de poblado): **90 km/h**.
- Autovía y autopista: **120 km/h**.
- Desde 2022 **NO existe** el margen de +20 km/h para adelantar en convencional: hay que respetar el límite.

### Alcohol (tasas máximas)
- General: **0,25 mg/l** en aire espirado / **0,5 g/l** en sangre.
- Noveles (< 2 años de carnet) y profesionales: **0,15 mg/l** aire / **0,3 g/l** sangre.
- Delito penal (art. 379 CP): **0,60 mg/l** aire / **1,2 g/l** sangre.

### Permiso por puntos
- Conductor general: **12 puntos**. Conductor novel (o recupera tras pérdida): **8 puntos**.
- Sin sanciones 3 años → 15 puntos (tope). Pérdida total → no conducir + curso de sensibilización.
- Usar el móvil en la mano conduciendo: **6 puntos**. No usar cinturón/casco/SRI: **4 puntos** (actualización 2022).

### Distancia de seguridad
- Regla de los **3 segundos** (cuenta desde que el de delante pasa un punto). Con lluvia, duplícala.
- Prohibido circular tan cerca que no permita detenerse sin colisión ante un frenazo.

### Alumbrado
- Cortas (cruce): de noche en vía iluminada, en túneles, con niebla/lluvia intensa.
- Largas (carretera): fuera de poblado sin iluminación suficiente y sin cruzarse con otros.
- Antiniebla delantera: niebla, lluvia o nieve intensas. Trasera: solo niebla densa o nieve (deslumbra mucho).

### Seguridad (ocupantes)
- Cinturón: obligatorio en **todos** los asientos, delante y detrás.
- Sistema de retención infantil (SRI) obligatorio para menores de **135 cm** de estatura.
- Los menores de 135 cm van **detrás**; solo pueden ir delante en casos tasados (sin plazas traseras, etc.).
- Casco homologado: obligatorio en motos y ciclomotores (conductor y pasajero).

### ITV (turismos)
- Primera inspección a los **4 años**; de 4 a 10 años, cada **2 años**; a partir de 10 años, **anual**.

### Prioridad
- Rotonda/glorieta: tiene prioridad **quien circula por dentro**; el que entra cede el paso.
- Sin señales ni agente: por la **derecha** tiene prioridad (salvo excepciones: raíles, vehículos de emergencia, salir de propiedad, etc.).
- Orden de prioridad: agente > semáforo > señal vertical > norma general (marcas viales dentro de su rango).

### Adelantamientos
- Prohibido adelantar en: cambios de rasante de visibilidad reducida, curvas de visibilidad reducida, túneles y pasos a nivel (salvo carriles suficientes), intersecciones y sus proximidades.
- Debes volver a tu carril sin obligar al adelantado a frenar bruscamente.

### Maniobras
- Marcha atrás: solo como maniobra complementaria, el menor recorrido posible; prohibida en autovía/autopista.
- Parada: máx 2 minutos, sin abandonar el vehículo. Estacionamiento: más tiempo o abandonando el vehículo.

### Factor humano / PAS
- Conducta **PAS**: **P**roteger, **A**visar (112), **S**ocorrer. No mover heridos salvo peligro; no quitar el casco a un motorista salvo que no respire.
- Fatiga y sueño: parar cada 2 horas aprox. El sueño no se combate con trucos: hay que parar.

### Usuarios vulnerables / VMP
- VMP (patinete eléctrico): prohibido en acera, en vías interurbanas, travesías y autovías; no requiere carnet pero sí respetar tasa de alcohol; casco según ordenanza municipal.
- Ciclistas en grupo: pueden circular en paralelo (columna de a dos). Al adelantar a un ciclista fuera de poblado debes dejar **1,5 m** y puedes invadir el carril contrario si es necesario.

Si un dato NO está en esta lista y no estás 100% seguro, márcalo en la explicación con `[VERIFICAR CON DGT]` en vez de inventar cifras.
