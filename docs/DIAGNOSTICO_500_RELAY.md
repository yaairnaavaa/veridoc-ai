# Cómo diagnosticar el error 500 en relay-escrow-deposit

## 1. Ver la respuesta real del servidor (cuerpo JSON)

El 500 puede ser HTML ("Internal Server Error") o JSON. Si es JSON, el cuerpo tiene el error real.

- **En el navegador:** abre DevTools (F12) → pestaña **Red** → vuelve a hacer la acción que falla → haz clic en la petición `relay-escrow-deposit` → pestaña **Respuesta** o **Response**. Ahí verás el cuerpo (por ejemplo `{ "success": false, "error": "Relay failed", "details": "..." }`).
- **Con curl:**  
  `curl -X POST https://tu-dominio.com/api/near/relay-escrow-deposit -H "Content-Type: application/json" -d '{"signedDelegateBase64":"..."}' -v`  
  El cuerpo de la respuesta aparece al final.

## 2. Endpoint de diagnóstico (variables y dependencias)

**GET** (sin autenticación):

- `https://tu-dominio.com/api/diagnose`  
  Devuelve qué variables de entorno están **set** o **missing** (sin mostrar valores).

- `https://tu-dominio.com/api/diagnose?relay=1`  
  Además intenta cargar las mismas dependencias que el relay (borsh, KeyPairSigner). Si algo falla al cargar, devuelve `relayDepsError` y opcionalmente `relayDepsStack`.

**GET al relay:**

- `https://tu-dominio.com/api/near/relay-escrow-deposit`  
  Indica si el relayer está configurado (`relayerConfigured: true/false`).

## 3. Incluir stack trace en el 500 del POST

Para que el **POST** a `relay-escrow-deposit` devuelva el `stack` en el JSON cuando falle:

- Añade el header: `x-debug: 1` o `x-diagnose: 1`, **o**
- Añade en la URL: `?diagnose=1` (si tu cliente hace POST a una URL con ese query).

Ejemplo con fetch desde consola (para probar):

```js
fetch("/api/near/relay-escrow-deposit", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-debug": "1" },
  body: JSON.stringify({ signedDelegateBase64: "TU_BASE64_AQUI" }),
}).then(r => r.json()).then(console.log);
```

El cuerpo de la respuesta incluirá `stack` con el trace completo del error.

## 4. Logs en Amplify (CloudWatch)

En la consola de AWS Amplify: tu app → **Monitoring** / **Logging** o el enlace a **CloudWatch**. Ahí aparecen los `console.error` del servidor. Busca líneas que contengan `[near/relay-escrow-deposit]`; el mensaje y el stack suelen estar justo después.

## Resumen rápido

1. Abre **Red** → petición a `relay-escrow-deposit` → pestaña **Respuesta** y anota el cuerpo.
2. Abre en el navegador `https://tu-dominio.com/api/diagnose` y `https://tu-dominio.com/api/diagnose?relay=1` y revisa si algo está **missing** o si hay `relayDepsError`.
3. Si necesitas el stack en el 500, repite la acción que falla con el header `x-debug: 1` y vuelve a mirar el cuerpo de la respuesta.
